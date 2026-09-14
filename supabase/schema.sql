-- Run this file once in the Supabase SQL Editor. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null,
  price integer not null check (price >= 0),
  color text not null default '#f3dedb',
  art text not null default '🧶',
  image_url text,
  image_position_x integer not null default 50 check (image_position_x between 0 and 100),
  image_position_y integer not null default 50 check (image_position_y between 0 and 100),
  image_zoom numeric not null default 1 check (image_zoom between 1 and 3),
  tag text,
  active boolean not null default true,
  sort_order integer not null default 0,
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_position_x integer not null default 50 check (image_position_x between 0 and 100);
alter table public.products add column if not exists image_position_y integer not null default 50 check (image_position_y between 0 and 100);
alter table public.products add column if not exists image_zoom numeric not null default 1 check (image_zoom between 1 and 3);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- Solo se invoca como trigger al crear un usuario: nadie necesita llamarla
-- directamente por API.
revoke all on function public.handle_new_user() from public;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
-- Las políticas RLS de anon/authenticated la llaman dentro de sus propias
-- consultas (products_public_read, etc.), así que ambas necesitan poder
-- ejecutarla; solo el grant genérico a PUBLIC (heredado por cualquier rol
-- futuro) sobra.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.site_content enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.site_content from anon, authenticated;
grant select on public.products, public.site_content to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.products, public.site_content to authenticated;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
for select to authenticated using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
for select to anon, authenticated using (active or public.is_admin());

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
for insert to authenticated with check (public.is_admin());
drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
for delete to authenticated using (public.is_admin());

drop policy if exists "content_public_read" on public.site_content;
create policy "content_public_read" on public.site_content
for select to anon, authenticated using (true);
drop policy if exists "content_admin_insert" on public.site_content;
create policy "content_admin_insert" on public.site_content
for insert to authenticated with check (public.is_admin());
drop policy if exists "content_admin_update" on public.site_content;
create policy "content_admin_update" on public.site_content
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "content_admin_delete" on public.site_content;
create policy "content_admin_delete" on public.site_content
for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'products' and public.is_admin());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
for update to authenticated using (bucket_id = 'products' and public.is_admin()) with check (bucket_id = 'products' and public.is_admin());
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
for delete to authenticated using (bucket_id = 'products' and public.is_admin());

insert into public.site_content (key, value)
values ('store', '{"brandName":"LÚMINA","brandTagline":"hecho a mano","heroEyebrow":"Pequeñas cosas, grandes sonrisas","heroTitle":"Un poquito de","heroHighlight":"ternura para llevar.","heroDescription":"Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.","heroCtaPrimary":"Ver la colección","heroCtaSecondary":"Conoce Lúmina","heroNote1":"Hecho a mano","heroNote2":"Materiales suaves","categoryText1":"Regalos con cariño","categoryText2":"Diseños únicos","categoryText3":"Hecho en Chile","phone":"+56 9 1234 5678","email":"hola@lumina.cl","whatsapp":"56912345678","shippingMessage":"Envío gratis sobre $45.000 · cada pieza se hace a mano","aboutTitle":"Hecho lento,","aboutHighlight":"hecho bonito.","aboutText":"Cada pieza nace en un pequeño taller, entre ovillos de colores, café calentito y muchas ganas de crear algo especial.","storyQuote":"Lo imperfecto es parte de lo encantador.","storyQuoteAuthor":"— filosofía Lúmina","footerCta":"¿Tienes una idea especial?"}'::jsonb)
on conflict (key) do nothing;

insert into public.products (name, description, type, price, color, art, tag, sort_order)
select seed.name, seed.description, seed.type, seed.price, seed.color, seed.art, seed.tag, seed.sort_order
from (values
  ('Bunny Lila', 'Llavero de conejito tejido a mano en algodón suave, orejitas bordadas a mano.', 'Llaveros', 12990, '#d8c1ec', '🐰', 'Más vendido', 1),
  ('Osito Miel', 'Peluche de osito color miel, relleno hipoalergénico, ideal para abrazar.', 'Peluches', 18990, '#f2d17c', '🐻', null, 2),
  ('Honguito Rosa', 'Llavero de honguito rosado, tejido puntada por puntada con hilo de algodón.', 'Llaveros', 10990, '#f1a2a7', '🍄', 'Nuevo', 3),
  ('Gatita Vainilla', 'Peluche de gatita tono vainilla, con bigotes bordados y lazo removible.', 'Peluches', 19990, '#f6e4c8', '🐱', null, 4),
  ('Fresa Dulce', 'Llavero de fresita dulce, perfecto para mochilas y regalos pequeños.', 'Llaveros', 9990, '#ee9a9c', '🍓', null, 5),
  ('Nube Sueño', 'Peluche de nubecita suave, textura esponjosa y colores pastel.', 'Peluches', 17990, '#c6d8e8', '☁️', null, 6)
) as seed(name, description, type, price, color, art, tag, sort_order)
where not exists (select 1 from public.products);

-- After registering the owner, replace the email and run this statement:
-- update public.profiles set role = 'admin' where email = 'TU_CORREO@EJEMPLO.COM';

-- ── Envíos y pedidos ──────────────────────────────────────────────────────

create table if not exists public.shipping_rates (
  region text primary key,
  cost integer not null check (cost >= 0),
  updated_at timestamptz not null default now()
);

alter table public.shipping_rates enable row level security;
revoke all on public.shipping_rates from anon, authenticated;
grant select on public.shipping_rates to anon, authenticated;
grant insert, update, delete on public.shipping_rates to authenticated;

drop policy if exists "shipping_public_read" on public.shipping_rates;
create policy "shipping_public_read" on public.shipping_rates
for select to anon, authenticated using (true);
drop policy if exists "shipping_admin_write" on public.shipping_rates;
drop policy if exists "shipping_admin_insert" on public.shipping_rates;
create policy "shipping_admin_insert" on public.shipping_rates
for insert to authenticated with check (public.is_admin());
drop policy if exists "shipping_admin_update" on public.shipping_rates;
create policy "shipping_admin_update" on public.shipping_rates
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "shipping_admin_delete" on public.shipping_rates;
create policy "shipping_admin_delete" on public.shipping_rates
for delete to authenticated using (public.is_admin());

insert into public.shipping_rates (region, cost) values
  ('Arica y Parinacota', 6990), ('Tarapacá', 6990), ('Antofagasta', 6990),
  ('Atacama', 5990), ('Coquimbo', 5990), ('Valparaíso', 3990),
  ('Metropolitana de Santiago', 2990), ('Libertador General Bernardo O''Higgins', 3990),
  ('Maule', 3990), ('Ñuble', 4990), ('Biobío', 4990), ('La Araucanía', 4990),
  ('Los Ríos', 5990), ('Los Lagos', 5990), ('Aysén del General Carlos Ibáñez del Campo', 8990),
  ('Magallanes y de la Antártica Chilena', 8990)
on conflict (region) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_rut text,
  region text not null,
  comuna text not null,
  address text not null,
  address_extra text,
  items jsonb not null default '[]'::jsonb,
  subtotal integer not null check (subtotal >= 0),
  shipping_cost integer not null check (shipping_cost >= 0),
  discount_code text,
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total integer not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  payment_method text not null default 'mercadopago' check (payment_method in ('mercadopago', 'transfer')),
  tracking_number text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migraciones sobre orders que deben correr ANTES de las funciones de abajo
-- (get_order_public / expire_stale_orders las referencian).
alter table public.orders add column if not exists payment_method text not null default 'mercadopago'
  check (payment_method in ('mercadopago', 'transfer'));
alter table public.orders add column if not exists customer_rut text;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_mp_preference_idx on public.orders (mp_preference_id);
create index if not exists orders_user_id_idx on public.orders (user_id);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant update on public.orders to authenticated;
grant delete on public.orders to authenticated;

drop policy if exists "orders_read_own_or_admin" on public.orders;
create policy "orders_read_own_or_admin" on public.orders
for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders
for delete to authenticated using (public.is_admin());

-- Los pedidos se crean y confirman desde el servidor (Route Handler) usando la
-- service role key, que ignora RLS — por eso no hay política de "insert" pública.

-- Función pública de solo lectura para la página de confirmación: expone lo
-- mínimo (sin correo, teléfono ni dirección) para cualquiera con el UUID del
-- pedido, sin abrir la tabla completa a usuarios anónimos.
-- DROP previo: Postgres no deja cambiar el tipo de retorno con create or replace.
drop function if exists public.get_order_public(uuid);
create or replace function public.get_order_public(order_id uuid)
returns table (id uuid, status text, region text, comuna text, items jsonb, subtotal integer, shipping_cost integer, total integer, payment_method text)
language sql
stable
security definer set search_path = public
as $$
  select id, status, region, comuna, items, subtotal, shipping_cost, total, payment_method
  from public.orders
  where id = order_id;
$$;

revoke all on function public.get_order_public(uuid) from public;
grant execute on function public.get_order_public(uuid) to anon, authenticated;

-- Rastreo de pedido sin cuenta: la compradora invitada solo tiene el código
-- corto (8 caracteres, el que aparece en sus correos/WhatsApp) y su correo.
-- Exigir ambos juntos evita abrir la tabla completa a cualquiera que solo
-- adivine un código.
create or replace function public.get_order_by_short_id_and_email(short_id text, p_email text)
returns table (id uuid, status text, region text, comuna text, items jsonb, subtotal integer, shipping_cost integer, total integer, payment_method text, tracking_number text, created_at timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select id, status, region, comuna, items, subtotal, shipping_cost, total, payment_method, tracking_number, created_at
  from public.orders
  where id::text like (lower(trim(short_id)) || '%')
    and lower(customer_email) = lower(trim(p_email))
  order by created_at desc
  limit 5;
$$;

revoke all on function public.get_order_by_short_id_and_email(text, text) from public;
grant execute on function public.get_order_by_short_id_and_email(text, text) to anon, authenticated;

-- Migraciones para bases ya creadas antes de este bloque:
alter table public.products add column if not exists stock integer;
-- Las categorías ahora las define cada tienda desde Admin → Categorías, no un
-- enum fijo en el código: se quita el check para permitir cualquier texto.
alter table public.products drop constraint if exists products_type_check;
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0);
-- Marca de tiempo del correo "tu pedido quedó sin pagar" (carrito abandonado),
-- para no enviarlo más de una vez por pedido.
alter table public.orders add column if not exists abandoned_reminded_at timestamptz;
-- Marca de tiempo del correo "vuelve" (win-back a clientes que compraron y no
-- volvieron), para no repetirlo.
alter table public.orders add column if not exists winback_sent_at timestamptz;

-- ── Stock: reserva atómica al crear el pedido, devolución si se cancela ────

create or replace function public.reserve_order_stock(items jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item jsonb;
  affected integer;
  variant_id uuid;
begin
  for item in select * from jsonb_array_elements(items) loop
    -- Si el item trae variantId, el stock que se descuenta es el de la
    -- variante (color/talla), no el del producto genérico.
    variant_id := nullif(item->>'variantId', '')::uuid;
    if variant_id is not null then
      if (select stock from public.product_variants where id = variant_id) is null then
        continue; -- stock null = sin control de stock para esta variante
      end if;
      update public.product_variants
      set stock = stock - (item->>'quantity')::integer
      where id = variant_id and stock >= (item->>'quantity')::integer;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception 'insufficient_stock:%', variant_id;
      end if;
      continue;
    end if;
    if (select stock from public.products where id = (item->>'productId')::uuid) is null then
      continue; -- stock null = sin control de stock para este producto
    end if;
    update public.products
    set stock = stock - (item->>'quantity')::integer
    where id = (item->>'productId')::uuid and stock >= (item->>'quantity')::integer;
    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'insufficient_stock:%', item->>'productId';
    end if;
  end loop;
end;
$$;
revoke all on function public.reserve_order_stock(jsonb) from public;

create or replace function public.restore_order_stock(items jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item jsonb;
  variant_id uuid;
begin
  for item in select * from jsonb_array_elements(items) loop
    variant_id := nullif(item->>'variantId', '')::uuid;
    if variant_id is not null then
      update public.product_variants
      set stock = stock + (item->>'quantity')::integer
      where id = variant_id and stock is not null;
      continue;
    end if;
    update public.products
    set stock = stock + (item->>'quantity')::integer
    where id = (item->>'productId')::uuid and stock is not null;
  end loop;
end;
$$;
revoke all on function public.restore_order_stock(jsonb) from public;

-- Pedidos "pending" (nunca pagados) que reservaron stock quedan cancelados
-- automáticamente tras 10 minutos y su stock vuelve al inventario. Se llama
-- desde el servidor (nunca expuesta a anon/authenticated): al iniciar cada
-- checkout y de forma oportunista cuando alguien visita la tienda.
create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  order_row record;
  expired_count integer := 0;
begin
  for order_row in
    -- Solo los de Mercado Pago: si en 10 min no confirmó el pago, se cae.
    -- Los de transferencia los gestiona la administradora a mano (tiene días
    -- para llegar la plata), así que no se tocan acá.
    select id, items from public.orders
    where status = 'pending'
      and payment_method = 'mercadopago'
      and created_at < now() - interval '10 minutes'
    for update skip locked
  loop
    perform public.restore_order_stock(order_row.items);
    update public.orders set status = 'cancelled', updated_at = now() where id = order_row.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;
revoke all on function public.expire_stale_orders() from public;

-- ── Galería de fotos adicionales por producto ──────────────────────────────

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;
revoke all on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
for select to anon, authenticated using (true);
drop policy if exists "product_images_admin_write" on public.product_images;
drop policy if exists "product_images_admin_insert" on public.product_images;
create policy "product_images_admin_insert" on public.product_images
for insert to authenticated with check (public.is_admin());
drop policy if exists "product_images_admin_update" on public.product_images;
create policy "product_images_admin_update" on public.product_images
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "product_images_admin_delete" on public.product_images;
create policy "product_images_admin_delete" on public.product_images
for delete to authenticated using (public.is_admin());

-- ── Variantes de producto (color/talla), cada una con su propio precio,
-- stock y foto ───────────────────────────────────────────────────────────

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color text,
  size text,
  price integer not null check (price >= 0),
  stock integer check (stock is null or stock >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);

alter table public.product_variants enable row level security;
revoke all on public.product_variants from anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "product_variants_admin_insert" on public.product_variants;
create policy "product_variants_admin_insert" on public.product_variants
for insert to authenticated with check (public.is_admin());
drop policy if exists "product_variants_admin_update" on public.product_variants;
create policy "product_variants_admin_update" on public.product_variants
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "product_variants_admin_delete" on public.product_variants;
create policy "product_variants_admin_delete" on public.product_variants
for delete to authenticated using (public.is_admin());

-- ── Códigos de descuento ────────────────────────────────────────────────────

create table if not exists public.discount_codes (
  code text primary key,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null check (value > 0),
  active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;
revoke all on public.discount_codes from anon, authenticated;
grant select, insert, update, delete on public.discount_codes to authenticated;

drop policy if exists "discount_codes_admin_all" on public.discount_codes;
create policy "discount_codes_admin_all" on public.discount_codes
for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Sin política de "select" pública: el código se valida siempre desde el
-- servidor (service role) en /api/checkout, nunca se expone la lista completa.

create or replace function public.increment_discount_use(discount_code text)
returns void
language sql
security definer set search_path = public
as $$
  update public.discount_codes set used_count = used_count + 1 where code = discount_code;
$$;
revoke all on function public.increment_discount_use(text) from public;

-- Vista previa pública de un código de descuento (para mostrar el monto antes
-- de pagar). La validación real y definitiva vuelve a ocurrir en el servidor
-- dentro de /api/checkout con la service role key.
create or replace function public.preview_discount_code(p_code text, p_subtotal integer)
returns table (valid boolean, discount_amount integer, message text)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  d public.discount_codes%rowtype;
begin
  select * into d from public.discount_codes where code = upper(p_code);
  if not found or not d.active or (d.expires_at is not null and d.expires_at <= now()) or (d.max_uses is not null and d.used_count >= d.max_uses) then
    return query select false, 0, 'Código no válido o expirado.';
    return;
  end if;
  return query select true,
    least(p_subtotal, case when d.type = 'percent' then round(p_subtotal * d.value / 100.0)::integer else d.value end),
    'Descuento aplicado.';
end;
$$;
revoke all on function public.preview_discount_code(text, integer) from public;
grant execute on function public.preview_discount_code(text, integer) to anon, authenticated;

-- ── Reseñas de productos ───────────────────────────────────────────────────

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews (user_id);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, delete on public.reviews to authenticated;
grant update on public.reviews to authenticated;

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
for select to anon, authenticated using (approved or public.is_admin());
drop policy if exists "reviews_own_insert" on public.reviews;
create policy "reviews_own_insert" on public.reviews
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "reviews_admin_update" on public.reviews;
create policy "reviews_admin_update" on public.reviews
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "reviews_own_or_admin_delete" on public.reviews;
create policy "reviews_own_or_admin_delete" on public.reviews
for delete to authenticated using ((select auth.uid()) = user_id or public.is_admin());

-- ── Permitir a la administradora ascender a otras cuentas a admin ──────────

grant update on public.profiles to authenticated;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Vitrina curada ("Trabajos recientes") ──────────────────────────────────

create table if not exists public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.showcase_items enable row level security;
revoke all on public.showcase_items from anon, authenticated;
grant select on public.showcase_items to anon, authenticated;
grant insert, update, delete on public.showcase_items to authenticated;

drop policy if exists "showcase_public_read" on public.showcase_items;
create policy "showcase_public_read" on public.showcase_items
for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "showcase_admin_write" on public.showcase_items;
drop policy if exists "showcase_admin_insert" on public.showcase_items;
create policy "showcase_admin_insert" on public.showcase_items
for insert to authenticated with check (public.is_admin());
drop policy if exists "showcase_admin_update" on public.showcase_items;
create policy "showcase_admin_update" on public.showcase_items
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "showcase_admin_delete" on public.showcase_items;
create policy "showcase_admin_delete" on public.showcase_items
for delete to authenticated using (public.is_admin());

-- ── Preguntas frecuentes ────────────────────────────────────────────────────

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.faqs enable row level security;
revoke all on public.faqs from anon, authenticated;
grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;

drop policy if exists "faqs_public_read" on public.faqs;
create policy "faqs_public_read" on public.faqs
for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "faqs_admin_write" on public.faqs;
drop policy if exists "faqs_admin_insert" on public.faqs;
create policy "faqs_admin_insert" on public.faqs
for insert to authenticated with check (public.is_admin());
drop policy if exists "faqs_admin_update" on public.faqs;
create policy "faqs_admin_update" on public.faqs
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "faqs_admin_delete" on public.faqs;
create policy "faqs_admin_delete" on public.faqs
for delete to authenticated using (public.is_admin());

-- ── Perfil: dirección de envío guardada ─────────────────────────────────────
-- Permite precargar los datos de envío en el checkout para clientes con
-- cuenta. Se editan solo mediante la función de abajo (nunca con un UPDATE
-- directo a la tabla), así una cliente nunca puede tocar su propio `role`.

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists comuna text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists address_extra text;

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_region text,
  p_comuna text,
  p_address text,
  p_address_extra text
)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles
  set full_name = p_full_name,
      phone = p_phone,
      region = p_region,
      comuna = p_comuna,
      address = p_address,
      address_extra = p_address_extra
  where id = (select auth.uid());
$$;
revoke all on function public.update_own_profile(text, text, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, text, text, text) to authenticated;

-- ── Direcciones guardadas (varias por cliente) ──────────────────────────────

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  region text not null,
  comuna text not null,
  address text not null,
  address_extra text,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses (user_id, created_at);

alter table public.addresses enable row level security;
revoke all on public.addresses from anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Guardar solo el nombre desde "Mi cuenta" (las direcciones ahora viven en
-- public.addresses, con RLS propia: no necesitan pasar por una función).
create or replace function public.update_own_name(p_full_name text)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set full_name = p_full_name where id = (select auth.uid());
$$;
revoke all on function public.update_own_name(text) from public;
grant execute on function public.update_own_name(text) to authenticated;

-- Preferencia de correos de ofertas/novedades ("vuelve"): los transaccionales
-- (confirmación, estado del pedido, transferencia, carrito abandonado) no se
-- pueden apagar porque son sobre un pedido real en curso.
alter table public.profiles add column if not exists marketing_emails_enabled boolean not null default true;

create or replace function public.update_own_notification_prefs(p_marketing_emails_enabled boolean)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set marketing_emails_enabled = p_marketing_emails_enabled where id = (select auth.uid());
$$;
revoke all on function public.update_own_notification_prefs(boolean) from public;
grant execute on function public.update_own_notification_prefs(boolean) to authenticated;

-- Eliminar la cuenta propia desde "Mi cuenta". Borra el usuario de auth.users;
-- el resto (perfil, direcciones, favoritos, mensajes) se limpia solo por los
-- "on delete cascade"/"set null" ya definidos en cada tabla. Los pedidos NO
-- se borran (obligación tributaria de conservarlos): quedan sin dueño, igual
-- que una compra de invitada.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- Favoritos con cuenta: sincronizados entre dispositivos. Las compras como
-- invitada siguen usando solo localStorage (no hay a quién asociarlos).
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists favorites_user_id_idx on public.favorites (user_id);

alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── Chat por pedido (cliente ↔ admin) ───────────────────────────────────────
-- Solo disponible para pedidos de clientes con cuenta (order.user_id no nulo);
-- las compras como invitada no tienen con quién autenticar el otro lado.

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('admin', 'customer')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;
revoke all on public.order_messages from anon, authenticated;
grant select, insert on public.order_messages to authenticated;

drop policy if exists "order_messages_read" on public.order_messages;
create policy "order_messages_read" on public.order_messages
for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
);

drop policy if exists "order_messages_insert" on public.order_messages;
create policy "order_messages_insert" on public.order_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and (
    (sender_role = 'admin' and public.is_admin())
    or (sender_role = 'customer' and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())))
  )
);

-- Habilita Supabase Realtime para esta tabla (mensajes nuevos llegan al
-- instante sin recargar). Se salta si ya estaba habilitado.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
     )
  then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;

-- Zonas de envío tipo "retiro/entrega personal" no necesitan comuna/dirección
-- para pagar (se coordina directo con la cliente, ej. por el chat del pedido).
alter table public.shipping_rates add column if not exists requires_address boolean not null default true;

-- Advertencia opcional por zona de envío (ej. "solo comuna de Pudahuel"),
-- editable desde el panel y mostrada en rojo en el checkout cuando el
-- cliente elige esa zona.
alter table public.shipping_rates add column if not exists warning text;

update public.shipping_rates
  set warning = 'Solo disponible para direcciones dentro de la comuna de Pudahuel, Región Metropolitana. Si no vives ahí, elige otra zona de envío.'
  where region ilike '%pudahuel%' and warning is null;

-- Cancelar un pedido a mano desde el panel: solo la admin puede, y devuelve
-- el stock reservado en el mismo paso (cancelar no pasa por Mercado Pago, así
-- que el stock no se libera solo como sí ocurre vía el webhook de pago).
create or replace function public.admin_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  order_row record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  select id, items, status into order_row from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;
  if order_row.status <> 'cancelled' then
    perform public.restore_order_stock(order_row.items);
  end if;
  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.admin_cancel_order(uuid) from public;
grant execute on function public.admin_cancel_order(uuid) to authenticated;

-- "Avísame cuando vuelva": cualquiera deja su correo en un producto agotado
-- (solo insert, sin poder leer los correos de otras personas). Cuando la
-- admin vuelve a poner stock, la ruta /api/products/restock-notify (con
-- llave de servicio) lee los pendientes de ese producto y les avisa.
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.stock_alerts add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;
-- coalesce(variant_id, product_id) para que "sin variante" siga contando como
-- una sola clave de "pendiente" por email, igual que antes de agregar variantes.
drop index if exists stock_alerts_unique_pending;
create unique index if not exists stock_alerts_unique_pending on public.stock_alerts (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email)) where notified_at is null;
alter table public.stock_alerts enable row level security;
revoke all on public.stock_alerts from anon, authenticated;
grant insert on public.stock_alerts to anon, authenticated;
drop policy if exists "stock_alerts_insert" on public.stock_alerts;
create policy "stock_alerts_insert" on public.stock_alerts
for insert to anon, authenticated with check (true);

-- Suscripciones a notificaciones push del navegador (Web Push), una por
-- dispositivo/instalación de la administradora. El envío real usa la llave
-- de servicio desde el worker (app/api/mercadopago/webhook y
-- app/api/orders/notify), así que aquí solo hace falta que cada quien pueda
-- gestionar sus propias filas.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
drop policy if exists "push_subscriptions_own_select" on public.push_subscriptions;
create policy "push_subscriptions_own_select" on public.push_subscriptions
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
create policy "push_subscriptions_own_insert" on public.push_subscriptions
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete" on public.push_subscriptions
for delete to authenticated using ((select auth.uid()) = user_id);

-- Integridad de checkout y pagos (2026-09-14).
-- Ejecutar una vez antes de publicar el checkout actualizado.
begin;
alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists discount_reserved boolean not null default false;
-- Backfill único: no repetir después de habilitar el trigger.
update public.orders set stock_reserved = status <> 'cancelled',
  discount_reserved = discount_code is not null and status <> 'cancelled'
where not exists (select 1 from pg_trigger where tgname = 'orders_inventory_lifecycle');
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','paid','shipped','delivered','cancelled','payment_review'));

create or replace function public.reserve_order_stock(items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; p public.products%rowtype; v public.product_variants%rowtype; qty integer;
begin
  for item in select value from jsonb_array_elements(items) order by value->>'productId', value->>'variantId' loop
    qty := (item->>'quantity')::integer;
    if qty is null or qty < 1 or qty > 99 then raise exception 'invalid_quantity'; end if;
    select * into p from public.products where id = (item->>'productId')::uuid for update;
    if not found or p.active = false then raise exception 'product_unavailable'; end if;
    if nullif(item->>'variantId','') is not null then
      select * into v from public.product_variants where id = (item->>'variantId')::uuid and product_id = p.id for update;
      if not found or v.active = false then raise exception 'variant_unavailable'; end if;
      if v.stock is not null then
        if v.stock < qty then raise exception 'insufficient_stock'; end if;
        update public.product_variants set stock = stock - qty where id = v.id;
      end if;
    else
      if exists (select 1 from public.product_variants where product_id = p.id and active) then raise exception 'variant_required'; end if;
      if p.stock is not null then
        if p.stock < qty then raise exception 'insufficient_stock'; end if;
        update public.products set stock = stock - qty where id = p.id;
      end if;
    end if;
  end loop;
end $$;

create or replace function public.order_inventory_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.discount_codes%rowtype; expected_discount integer;
begin
  if TG_OP = 'INSERT' then
    perform public.reserve_order_stock(new.items);
    new.stock_reserved := true;
    new.discount_reserved := false;
    if new.discount_code is not null then
      select * into d from public.discount_codes where code = new.discount_code for update;
      if not found or not d.active or (d.expires_at is not null and d.expires_at <= now())
        or (d.max_uses is not null and d.used_count >= d.max_uses) then raise exception 'discount_unavailable'; end if;
      expected_discount := least(new.subtotal, case when d.type = 'percent' then round(new.subtotal::numeric * d.value / 100)::integer else d.value end);
      if new.discount_amount <> expected_discount then raise exception 'discount_changed'; end if;
      update public.discount_codes set used_count = used_count + 1 where code = d.code;
      new.discount_reserved := true;
    end if;
    return new;
  end if;
  -- Las existencias y el cupón se mueven junto con el estado, bajo el lock
  -- de la fila del pedido. Webhooks repetidos no duplican la devolución.
  new.stock_reserved := old.stock_reserved;
  new.discount_reserved := old.discount_reserved;
  if new.status = 'cancelled' then
    if old.stock_reserved then perform public.restore_order_stock(old.items); new.stock_reserved := false; end if;
    if old.discount_reserved then
      update public.discount_codes set used_count = greatest(0, used_count - 1) where code = old.discount_code;
      new.discount_reserved := false;
    end if;
  elsif new.status in ('pending','paid','shipped','delivered') and not old.stock_reserved then
    begin
      perform public.reserve_order_stock(new.items);
      new.stock_reserved := true;
    exception when raise_exception then
      -- El dinero pudo llegar después de liberar la reserva. No habilitar
      -- despacho si otro cliente ya compró esas unidades.
      if new.status = 'paid' then new.status := 'payment_review';
      else raise; end if;
    end;
    if new.status in ('paid','shipped','delivered') and new.discount_code is not null and not old.discount_reserved then
      -- Pago ya recibido: conservar el descuento pactado aunque haya vencido.
      update public.discount_codes set used_count = used_count + 1 where code = new.discount_code;
      new.discount_reserved := true;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_inventory_lifecycle on public.orders;
create trigger orders_inventory_lifecycle before insert or update of status on public.orders
for each row execute function public.order_inventory_lifecycle();

create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  with stale as (select id from public.orders where status = 'pending' and payment_method = 'mercadopago'
    and created_at < now() - interval '10 minutes' for update skip locked)
  update public.orders set status = 'cancelled', updated_at = now() where id in (select id from stale);
  get diagnostics affected = row_count;
  return affected;
end $$;
create or replace function public.admin_cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id and status <> 'cancelled';
end $$;
-- Webhook: serializar eventos y no degradar pedidos despachados con avisos repetidos.
create or replace function public.apply_payment_status(p_order_id uuid, p_payment_id text, p_status text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; result_status text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if p_status not in ('paid','cancelled','pending') then raise exception 'invalid_status'; end if;
  if p_amount is null or p_amount <> o.total then raise exception 'payment_amount_mismatch'; end if;
  if o.mp_payment_id is not null and o.mp_payment_id <> p_payment_id then raise exception 'different_payment_requires_review'; end if;
  if o.status in ('paid','shipped','delivered','payment_review') and p_status in ('paid','pending') then
    return jsonb_build_object('changed',false,'status',o.status);
  end if;
  if o.status = 'cancelled' and p_status = 'pending' then return jsonb_build_object('changed',false,'status',o.status); end if;
  update public.orders set status = p_status, mp_payment_id = p_payment_id, updated_at = now() where id = o.id returning status into result_status;
  return jsonb_build_object('changed',o.status <> result_status,'status',result_status);
end $$;
revoke all on function public.apply_payment_status(uuid,text,text,numeric) from public;
grant execute on function public.apply_payment_status(uuid,text,text,numeric) to service_role;
-- No usar el antiguo incremento fuera de la transacción del pedido.
create or replace function public.increment_discount_use(discount_code text)
returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;
commit;
