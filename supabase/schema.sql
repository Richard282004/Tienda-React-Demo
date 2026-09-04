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
