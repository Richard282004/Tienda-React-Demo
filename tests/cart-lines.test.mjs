import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCartLines, removePurchasedEntries } from '../lib/cart-lines.ts';
const products = [{id:'p',active:true,stock:5}];
const variants = [{id:'v',product_id:'p',active:true,stock:2}];
test('no convierte una variante eliminada en producto general', () => {
  assert.ok(resolveCartLines(['p::deleted'],products,variants)[0].error);
  assert.ok(resolveCartLines(['p'],products,variants)[0].error);
  assert.ok(resolveCartLines(['p::v'],products,[{...variants[0],product_id:'other'}])[0].error);
});
test('bloquea opciones inactivas, cantidades excesivas y productos eliminados', () => {
  assert.ok(resolveCartLines(['p::v'],products,[{...variants[0],active:false}])[0].error);
  assert.ok(resolveCartLines(['p::v','p::v','p::v'],products,variants)[0].error);
  assert.ok(resolveCartLines(['missing'],products,variants)[0].error);
  assert.equal(resolveCartLines(['p::v','p::v'],products,variants)[0].error,null);
});
test('confirmar pago retira solo las unidades compradas y conserva las nuevas', () => {
  assert.deepEqual(removePurchasedEntries(['p::v','p::v','other'],['p::v']),['p::v','other']);
  assert.deepEqual(removePurchasedEntries(['other'],['p::v']),['other']);
});
