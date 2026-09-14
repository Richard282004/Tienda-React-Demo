-- Ejecutar SOLO en una base de pruebas con la migración instalada.
begin;
insert into products(id,name,price,stock) values ('11111111-1111-4111-8111-111111111111','Prueba',1000,5);
insert into discount_codes(code,type,value,max_uses) values ('TEST-INTEGRITY','percent',10,1);
do $$
declare first_id uuid; second_id uuid; result jsonb; line jsonb := '[{"productId":"11111111-1111-4111-8111-111111111111","quantity":2}]';
begin
  insert into orders(items,subtotal,total,discount_code,discount_amount) values(line,2000,1800,'TEST-INTEGRITY',200) returning id into first_id;
  assert (select stock = 3 from products limit 1), 'Reserva incorrecta';
  assert (select used_count = 1 from discount_codes where code = 'TEST-INTEGRITY'), 'Cupón no reservado';
  begin
    insert into orders(items,subtotal,total,discount_code,discount_amount) values(line,2000,1800,'TEST-INTEGRITY',200);
    raise exception 'No se bloqueó el cupón agotado';
  exception when raise_exception then
    if SQLERRM <> 'discount_unavailable' then raise; end if;
  end;
  assert (select stock = 3 from products limit 1), 'Falló rollback de stock por cupón';
  update orders set status = 'cancelled' where id = first_id;
  update orders set status = 'cancelled' where id = first_id;
  assert (select stock = 5 from products limit 1), 'Cancelación devolvió stock dos veces';
  assert (select used_count = 0 from discount_codes where code = 'TEST-INTEGRITY'), 'Cupón no liberado';
  result := apply_payment_status(first_id,'100','paid',1800);
  assert result->>'status' = 'paid', 'Pago tardío con stock';
  assert (select stock = 3 from products limit 1), 'Pago tardío no volvió a reservar';
  result := apply_payment_status(first_id,'100','paid',1800);
  assert result->>'changed' = 'false', 'Webhook repetido no es idempotente';
  update orders set status = 'shipped' where id = first_id;
  result := apply_payment_status(first_id,'100','paid',1800);
  assert result->>'status' = 'shipped', 'Webhook degradó pedido enviado';
  begin
    perform apply_payment_status(first_id,'100','paid',1);
    raise exception 'Aceptó importe distinto';
  exception when raise_exception then
    if SQLERRM <> 'payment_amount_mismatch' then raise; end if;
  end;
  insert into orders(items,subtotal,total,created_at) values(line,2000,2000,now()-interval '11 minutes') returning id into second_id;
  perform expire_stale_orders();
  assert (select status = 'cancelled' from orders where id = second_id), 'Reserva no venció';
  update products set stock = 0;
  result := apply_payment_status(second_id,'200','paid',2000);
  assert result->>'status' = 'payment_review', 'Pago sin stock habilitó despacho';
  assert (select not stock_reserved from orders where id = second_id), 'Reserva fantasma';
  begin
    update orders set status = 'shipped' where id = second_id;
    raise exception 'Permitió despachar sin stock';
  exception when raise_exception then
    if SQLERRM <> 'insufficient_stock' then raise; end if;
  end;
  update orders set status = 'cancelled' where id = second_id;
  assert (select stock = 0 from products limit 1), 'Cancelación de revisión inventó unidades';
  insert into product_variants(id,product_id,color,price,stock) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Rojo',1200,2);
  begin
    insert into orders(items,subtotal,total) values(line,2000,2000);
    raise exception 'Permitió omitir variante';
  exception when raise_exception then
    if SQLERRM <> 'variant_required' then raise; end if;
  end;
end $$;
rollback;
