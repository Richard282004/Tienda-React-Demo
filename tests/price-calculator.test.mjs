import test from 'node:test';
import assert from 'node:assert/strict';
import { saleBreakdown, suggestedPrice, validatePricing } from '../lib/price-calculator.ts';
const base = { costs: 1000, shippingCost: 0, shippingCharged: 0, feePercent: 0, fixedFee: 0, feeIncludesVat: true, vatPercent: 19, inputVatCredit: 0, reservePercent: 0, hours: 1, hourlyPay: 2000, extraProfit: 0 };
test('extrae el IVA incluido, no 19% del precio bruto', () => {
  const result = saleBreakdown(11900, base);
  assert.equal(result.saleVat, 1900);
  assert.equal(result.pocket, 9000);
});
test('IVA de comisión se agrega una sola vez y crédito no genera devolución ficticia', () => {
  const input = { ...base, feePercent: 3, fixedFee: 100, feeIncludesVat: false, inputVatCredit: 100000 };
  const result = saleBreakdown(10000, input);
  assert.equal(result.fees, 476);
  assert.equal(result.vatProvision, 0);
  assert.equal(saleBreakdown(10000, { ...input, feeIncludesVat: true }).fees, 400);
});
test('precio sugerido alcanza tiempo más ganancia tras todos los descuentos', () => {
  const input = { ...base, feePercent: 3.19, fixedFee: 20, feeIncludesVat: false, reservePercent: 12, shippingCost: 3000, shippingCharged: 2500, extraProfit: 500, inputVatCredit: 150 };
  const price = suggestedPrice(input);
  assert.equal(price % 100, 0);
  assert.ok(saleBreakdown(price, input).pocket >= 2500);
  assert.ok(saleBreakdown(price - 100, input).pocket < 2500);
});
test('comisión e IVA incluyen el envío cobrado y se descuentan pérdidas reales', () => {
  const input = { ...base, shippingCharged: 1900, shippingCost: 3000, feePercent: 10, reservePercent: 20 };
  const result = saleBreakdown(10000, input);
  assert.equal(result.fees, 1190);
  assert.equal(result.saleVat, 1900);
  const loss = saleBreakdown(0, { ...base, reservePercent: 20 });
  assert.equal(loss.pocket, -1000);
  assert.equal(loss.reserve, 0);
});
test('rechaza porcentajes imposibles y costos inválidos', () => {
  assert.ok(validatePricing({ ...base, feePercent: 90 }));
  assert.ok(validatePricing({ ...base, costs: NaN }));
  assert.throws(() => suggestedPrice({ ...base, reservePercent: 100 }));
  assert.equal(suggestedPrice({ ...base, costs: 0, hourlyPay: 0 }), 0);
});
