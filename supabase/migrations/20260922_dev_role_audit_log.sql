-- Rol "dev" + historial de cambios con reversión (2026-09-22): una
-- colaboradora "dev" puede editar casi todo lo operativo (productos, textos,
-- envíos, descuentos, pedidos, vitrina, FAQ, reseñas, fotos/variantes) pero
-- NO puede ver/editar integration_settings (claves de Mercado Pago/Enviame),
-- ascender/degradar roles de otras cuentas, ni ver o revertir el historial de
-- auditoría. Solo "admin" puede hacer esas tres cosas.
begin;

-- 1) Ampliar el rol permitido en profiles ------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer', 'admin', 'dev'));

-- 2) Función is_staff(): admin O dev -----------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'dev')
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- 3) Reemplazar is_admin() por is_staff() en las tablas operativas ----------
-- products
drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
for insert to authenticated with check (public.is_staff());
drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
for delete to authenticated using (public.is_staff());
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
for select to anon, authenticated using (active or public.is_staff());

-- site_content
drop policy if exists "content_admin_insert" on public.site_content;
create policy "content_admin_insert" on public.site_content
for insert to authenticated with check (public.is_staff());
drop policy if exists "content_admin_update" on public.site_content;
create policy "content_admin_update" on public.site_content
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "content_admin_delete" on public.site_content;
create policy "content_admin_delete" on public.site_content
for delete to authenticated using (public.is_staff());

-- storage.objects (bucket 'products') — dev sigue pudiendo subir/editar fotos
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'products' and public.is_staff());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
for update to authenticated using (bucket_id = 'products' and public.is_staff()) with check (bucket_id = 'products' and public.is_staff());
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
for delete to authenticated using (bucket_id = 'products' and public.is_staff());

-- shipping_rates
drop policy if exists "shipping_admin_insert" on public.shipping_rates;
create policy "shipping_admin_insert" on public.shipping_rates
for insert to authenticated with check (public.is_staff());
drop policy if exists "shipping_admin_update" on public.shipping_rates;
create policy "shipping_admin_update" on public.shipping_rates
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "shipping_admin_delete" on public.shipping_rates;
create policy "shipping_admin_delete" on public.shipping_rates
for delete to authenticated using (public.is_staff());

-- product_images
drop policy if exists "product_images_admin_insert" on public.product_images;
create policy "product_images_admin_insert" on public.product_images
for insert to authenticated with check (public.is_staff());
drop policy if exists "product_images_admin_update" on public.product_images;
create policy "product_images_admin_update" on public.product_images
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "product_images_admin_delete" on public.product_images;
create policy "product_images_admin_delete" on public.product_images
for delete to authenticated using (public.is_staff());

-- product_variants
drop policy if exists "product_variants_admin_insert" on public.product_variants;
create policy "product_variants_admin_insert" on public.product_variants
for insert to authenticated with check (public.is_staff());
drop policy if exists "product_variants_admin_update" on public.product_variants;
create policy "product_variants_admin_update" on public.product_variants
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "product_variants_admin_delete" on public.product_variants;
create policy "product_variants_admin_delete" on public.product_variants
for delete to authenticated using (public.is_staff());
drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
for select to anon, authenticated using (active or public.is_staff());

-- discount_codes (política combinada "for all")
drop policy if exists "discount_codes_admin_all" on public.discount_codes;
create policy "discount_codes_admin_all" on public.discount_codes
for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- reviews (update = aprobar/ocultar; delete combina dueña-propia + admin)
drop policy if exists "reviews_admin_update" on public.reviews;
create policy "reviews_admin_update" on public.reviews
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "reviews_own_or_admin_delete" on public.reviews;
create policy "reviews_own_or_admin_delete" on public.reviews
for delete to authenticated using ((select auth.uid()) = user_id or public.is_staff());
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
for select to anon, authenticated using (approved or public.is_staff());

-- showcase_items
drop policy if exists "showcase_admin_insert" on public.showcase_items;
create policy "showcase_admin_insert" on public.showcase_items
for insert to authenticated with check (public.is_staff());
drop policy if exists "showcase_admin_update" on public.showcase_items;
create policy "showcase_admin_update" on public.showcase_items
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "showcase_admin_delete" on public.showcase_items;
create policy "showcase_admin_delete" on public.showcase_items
for delete to authenticated using (public.is_staff());
drop policy if exists "showcase_public_read" on public.showcase_items;
create policy "showcase_public_read" on public.showcase_items
for select to anon, authenticated using (active or public.is_staff());

-- faqs
drop policy if exists "faqs_admin_insert" on public.faqs;
create policy "faqs_admin_insert" on public.faqs
for insert to authenticated with check (public.is_staff());
drop policy if exists "faqs_admin_update" on public.faqs;
create policy "faqs_admin_update" on public.faqs
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "faqs_admin_delete" on public.faqs;
create policy "faqs_admin_delete" on public.faqs
for delete to authenticated using (public.is_staff());
drop policy if exists "faqs_public_read" on public.faqs;
create policy "faqs_public_read" on public.faqs
for select to anon, authenticated using (active or public.is_staff());

-- orders: dev puede leer/actualizar (gestionar pedidos), pero NO borrar
-- (se deja el borrado permanente de un registro de compra solo a admin).
drop policy if exists "orders_read_own_or_admin" on public.orders;
create policy "orders_read_own_or_admin" on public.orders
for select to authenticated using ((select auth.uid()) = user_id or public.is_staff());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- "orders_admin_delete" se deja intacta (is_admin()) a propósito.

-- order_messages: dev puede responder en el chat del pedido como "staff"
drop policy if exists "order_messages_read" on public.order_messages;
create policy "order_messages_read" on public.order_messages
for select to authenticated using (
  public.is_staff()
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
);
drop policy if exists "order_messages_insert" on public.order_messages;
create policy "order_messages_insert" on public.order_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and (
    (sender_role = 'admin' and public.is_staff())
    or (sender_role = 'customer' and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())))
  )
);

-- profiles: SOLO admin puede leer/editar el `role` de otras cuentas (sin
-- cambios, se deja is_admin() a propósito — dev NO puede ascender/degradar).

-- 4) Tabla audit_log ----------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_name_idx on public.audit_log (table_name);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
for select to authenticated using (public.is_admin());
-- Sin políticas de insert/update/delete para anon/authenticated: solo la
-- función de trigger (security definer, dueña de la tabla) puede escribir.

-- 5) Función genérica de trigger ----------------------------------------------
-- Recibe el nombre de la columna PK de la tabla como argumento del trigger
-- (TG_ARGV[0]), porque no todas las tablas usan "id" como llave primaria.
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pk_col text := TG_ARGV[0];
  rec_id text;
  old_j jsonb;
  new_j jsonb;
begin
  if TG_OP = 'DELETE' then
    old_j := to_jsonb(OLD);
    new_j := null;
    rec_id := old_j ->> pk_col;
  elsif TG_OP = 'INSERT' then
    old_j := null;
    new_j := to_jsonb(NEW);
    rec_id := new_j ->> pk_col;
  else
    old_j := to_jsonb(OLD);
    new_j := to_jsonb(NEW);
    rec_id := new_j ->> pk_col;
  end if;

  insert into public.audit_log (actor_id, table_name, record_id, action, old_data, new_data)
  values ((select auth.uid()), TG_TABLE_NAME, rec_id, lower(TG_OP), old_j, new_j);

  return coalesce(NEW, OLD);
end;
$$;
revoke all on function public.log_audit_event() from public;

-- 6) Triggers en las tablas operativas ----------------------------------------
drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products
for each row execute function public.log_audit_event('id');

drop trigger if exists site_content_audit on public.site_content;
create trigger site_content_audit after insert or update or delete on public.site_content
for each row execute function public.log_audit_event('key');

drop trigger if exists shipping_rates_audit on public.shipping_rates;
create trigger shipping_rates_audit after insert or update or delete on public.shipping_rates
for each row execute function public.log_audit_event('region');

drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders
for each row execute function public.log_audit_event('id');

drop trigger if exists product_images_audit on public.product_images;
create trigger product_images_audit after insert or update or delete on public.product_images
for each row execute function public.log_audit_event('id');

drop trigger if exists product_variants_audit on public.product_variants;
create trigger product_variants_audit after insert or update or delete on public.product_variants
for each row execute function public.log_audit_event('id');

drop trigger if exists discount_codes_audit on public.discount_codes;
create trigger discount_codes_audit after insert or update or delete on public.discount_codes
for each row execute function public.log_audit_event('code');

drop trigger if exists showcase_items_audit on public.showcase_items;
create trigger showcase_items_audit after insert or update or delete on public.showcase_items
for each row execute function public.log_audit_event('id');

drop trigger if exists faqs_audit on public.faqs;
create trigger faqs_audit after insert or update or delete on public.faqs
for each row execute function public.log_audit_event('id');

-- reviews: se registra igual que el resto (aprobar/ocultar/borrar es una
-- acción de moderación de admin/dev, distinta del insert que hace la clienta).
drop trigger if exists reviews_audit on public.reviews;
create trigger reviews_audit after insert or update or delete on public.reviews
for each row execute function public.log_audit_event('id');

-- profiles: SOLO cuando cambia el rol (evita registrar ediciones normales de
-- las clientas a su propio nombre/dirección/preferencias).
drop trigger if exists profiles_role_audit on public.profiles;
create trigger profiles_role_audit after update on public.profiles
for each row when (old.role is distinct from new.role)
execute function public.log_audit_event('id');

-- order_messages e integration_settings: sin trigger a propósito (chat sin
-- valor de reversión / secretos que no deben duplicarse en un log legible).

-- 7) RPC de reversión: solo admin ---------------------------------------------
-- Tabla-lista blanca explícita: aunque table_name solo lo escribe el trigger
-- (no llega input de usuario), se valida por si acaso para evitar SQL dinámico
-- sobre una tabla arbitraria.
create or replace function public.admin_revert_audit_log(log_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  entry public.audit_log%rowtype;
  pk_col text;
  cols_csv text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into entry from public.audit_log where id = log_id;
  if not found then
    raise exception 'audit_entry_not_found';
  end if;

  pk_col := case entry.table_name
    when 'products' then 'id'
    when 'site_content' then 'key'
    when 'shipping_rates' then 'region'
    when 'orders' then 'id'
    when 'product_images' then 'id'
    when 'product_variants' then 'id'
    when 'discount_codes' then 'code'
    when 'showcase_items' then 'id'
    when 'faqs' then 'id'
    when 'reviews' then 'id'
    when 'profiles' then 'id'
    else null
  end;
  if pk_col is null then
    raise exception 'table_not_revertible:%', entry.table_name;
  end if;

  if entry.action = 'update' then
    if entry.old_data is null then raise exception 'no_previous_value'; end if;
    select string_agg(quote_ident(column_name), ',') into cols_csv
      from information_schema.columns
      where table_schema = 'public' and table_name = entry.table_name;
    execute format(
      'update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where %I::text = $2',
      entry.table_name, cols_csv, cols_csv, entry.table_name, pk_col
    ) using entry.old_data, entry.record_id;

  elsif entry.action = 'delete' then
    if entry.old_data is null then raise exception 'no_previous_value'; end if;
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
      entry.table_name, entry.table_name
    ) using entry.old_data;

  elsif entry.action = 'insert' then
    execute format(
      'delete from public.%I where %I::text = $1',
      entry.table_name, pk_col
    ) using entry.record_id;
  end if;
end;
$$;
revoke all on function public.admin_revert_audit_log(bigint) from public;
grant execute on function public.admin_revert_audit_log(bigint) to authenticated;

commit;
