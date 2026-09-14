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
