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
  tag text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists description text;

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
values ('store', '{"heroEyebrow":"Pequeñas cosas, grandes sonrisas","heroTitle":"Un poquito de","heroHighlight":"ternura para llevar.","heroDescription":"Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.","phone":"+56 9 1234 5678","email":"hola@lumina.cl","shippingMessage":"Envío gratis sobre $45.000 · cada pieza se hace a mano","aboutTitle":"Hecho lento,","aboutHighlight":"hecho bonito.","aboutText":"Cada pieza nace en un pequeño taller, entre ovillos de colores, café calentito y muchas ganas de crear algo especial."}'::jsonb)
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
