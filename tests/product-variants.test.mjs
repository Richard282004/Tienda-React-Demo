import test from 'node:test';
import assert from 'node:assert/strict';
import { variantValidation, sameVariantOptions, variantForColor } from '../lib/product-variants.ts';
const option = (color, size, stock = 2) => ({ color, size, stock, price: 3000 });
test('rechaza opciones vacías y existencias inválidas', () => {
  assert.ok(variantValidation(option(' ', null)));
  assert.ok(variantValidation(option('Rosa', null, -1)));
  assert.ok(variantValidation(option('Rosa', null, 1.5)));
  assert.ok(variantValidation({ ...option('Rosa', null), price: NaN }));
  assert.equal(variantValidation(option('Rosa', null, 0)), null);
  assert.equal(variantValidation(option(null, 'Grande', null)), null);
});
test('detecta duplicados pese a espacios o mayúsculas', () => {
  assert.equal(sameVariantOptions(option(' Rosa ', null), option('rosa', '')), true);
  assert.equal(sameVariantOptions(option('Rosa', 'Grande'), option('Rosa', 'Pequeño')), false);
});
test('cambiar color conserva tamaño disponible o elige una combinación real', () => {
  const rows = [option('Rosa', 'Pequeño', 0), option('Rosa', 'Grande'), option('Azul', 'Pequeño')];
  assert.equal(variantForColor(rows, 'Rosa', 'Pequeño'), rows[1]);
  assert.equal(variantForColor(rows, 'Azul', 'Grande'), rows[2]);
  assert.equal(variantForColor(rows, 'Verde', 'Grande'), undefined);
});
test('permite consultar opciones agotadas y variantes solo por tamaño', () => {
  const rows = [option(null, 'Pequeño', 0), option(null, 'Grande', 0)];
  assert.equal(variantForColor(rows, null, 'Grande'), rows[1]);
});

import { catalogPrice } from '../lib/product-variants.ts';
const money = (price) => `$${price}`;
const product = { id: 'p', price: 3000 };
test('el catálogo usa precios de opciones, no el precio general', () => {
  assert.equal(catalogPrice(product, [], money), '$3000');
  assert.equal(catalogPrice(product, [{ product_id: 'p', price: 4000, stock: 2 }], money), '$4000');
  assert.equal(catalogPrice(product, [{ product_id: 'p', price: 4000, stock: 2 }, { product_id: 'p', price: 3000, stock: 1 }], money), 'Desde $3000');
});
test('no anuncia un precio menor de una opción agotada', () => {
  assert.equal(catalogPrice(product, [{ product_id: 'p', price: 4000, stock: 2 }, { product_id: 'p', price: 3000, stock: 0 }], money), '$4000');
  assert.equal(catalogPrice(product, [{ product_id: 'p', price: 4000, stock: 0 }], money), '$4000');
});
