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
  type text not null check (type in ('Llaveros', 'Peluches')),
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
create policy "shipping_admin_write" on public.shipping_rates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
  tracking_number text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_mp_preference_idx on public.orders (mp_preference_id);

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant update on public.orders to authenticated;

drop policy if exists "orders_read_own_or_admin" on public.orders;
create policy "orders_read_own_or_admin" on public.orders
for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Los pedidos se crean y confirman desde el servidor (Route Handler) usando la
-- service role key, que ignora RLS — por eso no hay política de "insert" pública.

-- Función pública de solo lectura para la página de confirmación: expone lo
-- mínimo (sin correo, teléfono ni dirección) para cualquiera con el UUID del
-- pedido, sin abrir la tabla completa a usuarios anónimos.
create or replace function public.get_order_public(order_id uuid)
returns table (id uuid, status text, region text, comuna text, items jsonb, subtotal integer, shipping_cost integer, total integer)
language sql
stable
security definer set search_path = public
as $$
  select id, status, region, comuna, items, subtotal, shipping_cost, total
  from public.orders
  where id = order_id;
$$;

revoke all on function public.get_order_public(uuid) from public;
grant execute on function public.get_order_public(uuid) to anon, authenticated;

-- Migraciones para bases ya creadas antes de este bloque:
alter table public.products add column if not exists stock integer;
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0);

-- ── Stock: reserva atómica al crear el pedido, devolución si se cancela ────

create or replace function public.reserve_order_stock(items jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item jsonb;
  affected integer;
begin
  for item in select * from jsonb_array_elements(items) loop
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
begin
  for item in select * from jsonb_array_elements(items) loop
    update public.products
    set stock = stock + (item->>'quantity')::integer
    where id = (item->>'productId')::uuid and stock is not null;
  end loop;
end;
$$;
revoke all on function public.restore_order_stock(jsonb) from public;

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
create policy "product_images_admin_write" on public.product_images
for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
for update to authenticated using (public.is_admin()) with check (true);

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
create policy "showcase_admin_write" on public.showcase_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
create policy "faqs_admin_write" on public.faqs
for all to authenticated using (public.is_admin()) with check (public.is_admin());
