export type PricingInput = {
  costs: number; shippingCost: number; shippingCharged: number;
  feePercent: number; fixedFee: number; feeIncludesVat: boolean;
  vatPercent: number; inputVatCredit: number; reservePercent: number;
  hours: number; hourlyPay: number; extraProfit: number;
};
export function validatePricing(input: PricingInput) {
  if (Object.values(input).some((value) => typeof value === 'number' && (!Number.isFinite(value) || value < 0))) return 'Completa los importes con números iguales o mayores que cero.';
  if (input.reservePercent >= 100 || input.vatPercent > 100 || input.feePercent >= 100) return 'Revisa los porcentajes: la reserva y la comisión deben ser menores al 100%.';
  const feeRate = input.feePercent / 100 * (input.feeIncludesVat ? 1 : 1.19);
  if (feeRate >= 1 / (1 + input.vatPercent / 100)) return 'Con esta comisión e IVA no es posible alcanzar una ganancia positiva.';
  return null;
}
export function saleBreakdown(price: number, input: PricingInput) {
  const collected = price + input.shippingCharged;
  const fees = (collected * input.feePercent / 100 + input.fixedFee) * (input.feeIncludesVat ? 1 : 1.19);
  const saleVat = collected * input.vatPercent / (100 + input.vatPercent);
  const vatProvision = Math.max(0, saleVat - input.inputVatCredit);
  const beforeReserve = collected - fees - input.costs - input.shippingCost - vatProvision;
  const reserve = Math.max(0, beforeReserve) * input.reservePercent / 100;
  const pocket = beforeReserve - reserve;
  const timePay = input.hours * input.hourlyPay;
  return { collected, fees, saleVat, vatProvision, reserve, pocket, timePay, afterTime: pocket - timePay };
}
export function suggestedPrice(input: PricingInput) {
  const error = validatePricing(input);
  if (error) throw new Error(error);
  const target = input.hours * input.hourlyPay + input.extraProfit;
  if (saleBreakdown(0, input).pocket >= target) return 0;
  let low = 0, high = 1000;
  while (saleBreakdown(high, input).pocket < target && high < 1e10) high *= 2;
  if (saleBreakdown(high, input).pocket < target) throw new Error('Revisa los importes: el precio calculado supera el rango permitido.');
  for (let index = 0; index < 80; index++) {
    const middle = (low + high) / 2;
    if (saleBreakdown(middle, input).pocket < target) low = middle;
    else high = middle;
  }
  return Math.ceil(high / 100) * 100;
}
