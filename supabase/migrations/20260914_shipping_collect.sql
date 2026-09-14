-- Despacho por pagar y seguimiento. No crea envíos ni cobra transportes.
begin;
alter table public.orders add column if not exists shipping_payment text not null default 'prepaid'
  check (shipping_payment in ('prepaid','collect','pickup'));
alter table public.orders add column if not exists shipping_carrier text
  check (shipping_carrier is null or shipping_carrier = 'blue_express');

-- Mantener privados los datos del destinatario. Exponer solo modalidad y seguimiento.
drop function if exists public.get_order_public(uuid);
create function public.get_order_public(order_id uuid)
returns table (id uuid,status text,region text,comuna text,items jsonb,subtotal integer,shipping_cost integer,total integer,payment_method text,tracking_number text,shipping_payment text,shipping_carrier text)
language sql stable security definer set search_path = public as $$
  select o.id,o.status,o.region,o.comuna,o.items,o.subtotal,o.shipping_cost,o.total,o.payment_method,o.tracking_number,o.shipping_payment,o.shipping_carrier
  from public.orders o where o.id = order_id;
$$;
revoke all on function public.get_order_public(uuid) from public;
grant execute on function public.get_order_public(uuid) to anon,authenticated;

drop function if exists public.get_order_by_short_id_and_email(text,text);
create function public.get_order_by_short_id_and_email(short_id text,p_email text)
returns table (id uuid,status text,region text,comuna text,items jsonb,subtotal integer,shipping_cost integer,total integer,payment_method text,tracking_number text,created_at timestamptz,shipping_payment text,shipping_carrier text)
language sql stable security definer set search_path = public as $$
  select o.id,o.status,o.region,o.comuna,o.items,o.subtotal,o.shipping_cost,o.total,o.payment_method,o.tracking_number,o.created_at,o.shipping_payment,o.shipping_carrier
  from public.orders o where lower(trim(short_id)) ~ '^[0-9a-f]{8}$'
    and o.id::text like (lower(trim(short_id)) || '%') and lower(o.customer_email) = lower(trim(p_email))
  order by o.created_at desc limit 5;
$$;
revoke all on function public.get_order_by_short_id_and_email(text,text) from public;
grant execute on function public.get_order_by_short_id_and_email(text,text) to anon,authenticated;

-- Habilitar la modalidad pedida para pedidos nuevos; los antiguos conservan sus importes.
insert into public.site_content(key,value) values ('store','{"shippingCollectEnabled":true}'::jsonb)
on conflict (key) do update set value = jsonb_set(coalesce(public.site_content.value,'{}'::jsonb),'{shippingCollectEnabled}','true'::jsonb)
where not (coalesce(public.site_content.value,'{}'::jsonb) ? 'shippingCollectEnabled');
commit;
