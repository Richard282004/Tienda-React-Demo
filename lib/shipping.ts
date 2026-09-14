import { calculateShipping } from './checkout-validation.ts';
export type ShippingPayment = 'prepaid' | 'collect' | 'pickup';
export const BLUE_SHIPPING_URL = 'https://app.bluex.cl/';
export const BLUE_TRACKING_URL = 'https://www.blue.cl/';
export const COLLECT_NOTICE = 'El despacho se paga aparte a Blue Express. No está incluido en este total. Su valor depende del destino y del paquete; lo confirmaremos antes de despachar.';
export function shippingPayment(collectEnabled: boolean, requiresAddress: boolean): ShippingPayment {
  return !requiresAddress ? 'pickup' : collectEnabled ? 'collect' : 'prepaid';
}
export function shippingCharge(subtotal: number, rate: number | undefined, method: ShippingPayment): number | null {
  if (rate === undefined || !Number.isSafeInteger(rate) || rate < 0) return null;
  if (method === 'collect') return 0;
  return calculateShipping(subtotal, rate);
}
export function validTracking(value: string) { return /^[a-zA-Z0-9-]{5,50}$/.test(value.trim()); }
