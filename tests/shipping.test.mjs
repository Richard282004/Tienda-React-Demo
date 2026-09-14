import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingCharge, shippingPayment, validTracking } from '../lib/shipping.ts';
test('despacho por pagar excluye el porte sin omitir una zona válida', () => {
  assert.equal(shippingCharge(3000,2990,'collect'),0);
  assert.equal(shippingCharge(50000,2990,'collect'),0);
  assert.equal(shippingCharge(3000,undefined,'collect'),null);
  assert.equal(shippingCharge(3000,-1,'collect'),null);
});
test('retiro y tarifas prepagadas conservan el cálculo existente', () => {
  assert.equal(shippingPayment(true,false),'pickup');
  assert.equal(shippingPayment(true,true),'collect');
  assert.equal(shippingPayment(false,true),'prepaid');
  assert.equal(shippingCharge(3000,0,'pickup'),0);
  assert.equal(shippingCharge(3000,1500,'pickup'),1500);
  assert.equal(shippingCharge(45000,2990,'prepaid'),2990);
  assert.equal(shippingCharge(45001,2990,'prepaid'),0);
});
test('seguimiento rechaza enlaces, etiquetas HTML y valores vacíos', () => {
  assert.equal(validTracking('1234567890'),true);
  for (const value of ['', '123', '<script>', 'https://example.com', 'x'.repeat(51)]) assert.equal(validTracking(value),false);
});
