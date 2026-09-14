export type CheckoutPayload = {
  shippingPayment?: 'prepaid' | 'collect' | 'pickup';
  items: { productId: string; quantity: number; variantId?: string }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerRut: string;
  region: string;
  comuna: string;
  address: string;
  addressExtra?: string;
  discountCode?: string;
  paymentMethod: "mercadopago" | "transfer";
};

// Valida el dígito verificador de un RUT chileno (módulo 11). Acepta con o
// sin puntos/guion; se guarda normalizado ("12345678-9").
function isValidRut(raw: string): boolean {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 8 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return verifier === expected;
}
function normalizeRut(raw: string): string {
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

export function parseCheckoutPayload(value: unknown): CheckoutPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Solicitud inválida.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.items) || !record.items.length || record.items.length > 100) {
    throw new Error("La bolsita debe contener entre 1 y 100 productos.");
  }
  const quantities = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  for (const item of record.items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      item.productId.length > 100 ||
      (item.variantId !== undefined && (typeof item.variantId !== "string" || item.variantId.length > 100)) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error("Revisa los productos y sus cantidades.");
    }
    const productId = item.productId.trim();
    const variantId = typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : undefined;
    // Dos variantes del mismo producto son líneas distintas: se agrupan por
    // producto+variante, no solo por producto.
    const key = variantId ? `${productId}::${variantId}` : productId;
    const existing = quantities.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;
    if (quantity > 99) throw new Error("Puedes pedir hasta 99 unidades de cada producto.");
    quantities.set(key, { productId, variantId, quantity });
  }
  const field = (key: string, max: number, optional = false) => {
    const raw = record[key];
    if (optional && (raw === undefined || raw === null)) return "";
    if (typeof raw !== "string" || (!optional && !raw.trim()) || raw.length > max)
      throw new Error("Revisa los datos de envío.");
    return raw.trim();
  };
  // Se normaliza a minúsculas: "Nombre@Gmail.com" y "nombre@gmail.com" llegan
  // al mismo correo, pero algunos proveedores de correo (en modo de prueba)
  // comparan la dirección tal cual, así que una mayúscula de más puede hacer
  // que el correo de confirmación no llegue.
  const customerEmail = field("customerEmail", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))
    throw new Error("Ingresa un correo válido.");
  const paymentMethod = record.paymentMethod === "transfer" ? "transfer" : "mercadopago";
  const rawRut = field("customerRut", 12);
  if (!isValidRut(rawRut)) throw new Error("Ingresa un RUT válido.");
  return {
    items: [...quantities.values()].map(({ productId, variantId, quantity }) => (variantId ? { productId, variantId, quantity } : { productId, quantity })),
    paymentMethod,
    shippingPayment: record.shippingPayment === 'collect' ? 'collect' : record.shippingPayment === 'pickup' ? 'pickup' : 'prepaid',
    customerName: field("customerName", 120),
    customerEmail,
    customerPhone: field("customerPhone", 40),
    customerRut: normalizeRut(rawRut),
    region: field("region", 120),
    // Comuna y dirección son opcionales aquí: si la región elegida es de
    // retiro/entrega personal (requires_address = false), no hacen falta.
    // La obligatoriedad real se valida en el servidor contra shipping_rates.
    comuna: field("comuna", 120, true),
    address: field("address", 250, true),
    addressExtra: field("addressExtra", 250, true),
    discountCode: field("discountCode", 40, true).toUpperCase(),
  };
}

// La tienda anuncia envío gratis sobre $45.000. Se aplica también en servidor.
export const FREE_SHIPPING_THRESHOLD = 45_000;
export function calculateShipping(subtotal: number, rate: number | undefined): number | null {
  if (rate === undefined || !Number.isSafeInteger(rate) || rate < 0) return null;
  return subtotal > FREE_SHIPPING_THRESHOLD ? 0 : rate;
}
