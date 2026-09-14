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
