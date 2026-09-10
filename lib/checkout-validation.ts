export type CheckoutPayload = {
  items: { productId: string; quantity: number }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  region: string;
  comuna: string;
  address: string;
  addressExtra?: string;
  discountCode?: string;
};

export function parseCheckoutPayload(value: unknown): CheckoutPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Solicitud inválida.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.items) || !record.items.length || record.items.length > 100) {
    throw new Error("La bolsita debe contener entre 1 y 100 productos.");
  }
  const quantities = new Map<string, number>();
  for (const item of record.items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      item.productId.length > 100 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error("Revisa los productos y sus cantidades.");
    }
    const id = item.productId.trim();
    const quantity = (quantities.get(id) ?? 0) + item.quantity;
    if (quantity > 99) throw new Error("Puedes pedir hasta 99 unidades de cada producto.");
    quantities.set(id, quantity);
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
  return {
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    customerName: field("customerName", 120),
    customerEmail,
    customerPhone: field("customerPhone", 40),
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
