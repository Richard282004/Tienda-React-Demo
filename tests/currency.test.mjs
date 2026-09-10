import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../lib/currency.ts';

test('formatea CLP sin decimales', () => {
  const out = formatPrice(12990);
  assert.match(out, /12\.990/);
  assert.doesNotMatch(out, /,\d/);
});

test('respeta moneda y locale personalizados', () => {
  assert.match(formatPrice(1000, 'USD', 'en-US'), /\$1,000/);
});

test('moneda inválida cae a número plano en vez de romper', () => {
  assert.equal(formatPrice(500, 'NOPE', 'es-CL'), '500 NOPE');
});

test('cero es válido', () => {
  assert.match(formatPrice(0), /0/);
});
