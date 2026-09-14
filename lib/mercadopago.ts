// Llamadas directas a la API REST de Mercado Pago (sin SDK) para que corran
// bien en el runtime de Cloudflare Workers.

type PreferenceItem = { title: string; quantity: number; unit_price: number };

export async function createMercadoPagoPreference(opts: {
  accessToken: string;
  orderId: string;
  items: PreferenceItem[];
  shippingCost: number;
  discountAmount?: number;
  payerEmail: string;
  siteUrl: string;
  // Debe calzar con la moneda de la cuenta de Mercado Pago del comercio
  // (CLP para Chile, ARS para Argentina, MXN para México, etc.).
  currency?: string;
}) {
  const { accessToken, orderId, items, shippingCost, discountAmount = 0, payerEmail, siteUrl, currency = 'CLP' } = opts;
  // Mercado Pago rechaza (o deja el botón de pagar sin activarse) si algún
  // item.unit_price es negativo, así que el descuento no puede viajar como
  // una línea "Descuento" en negativo -- hay que repartirlo entre los
  // productos, prorrateado según su peso en el subtotal, y nunca dejar un
  // item en menos de 0.
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discount = Math.max(0, Math.min(discountAmount, subtotal));
  let remainingDiscount = discount;
  const discountedItems = items.map((item, index) => {
    const lineTotal = item.unit_price * item.quantity;
    const isLast = index === items.length - 1;
    const lineDiscount = isLast ? remainingDiscount : Math.min(remainingDiscount, subtotal > 0 ? Math.round((lineTotal / subtotal) * discount) : 0);
    remainingDiscount -= lineDiscount;
    const discountedLineTotal = Math.max(0, lineTotal - lineDiscount);
    // unit_price recalculado desde el total de la línea ya con descuento para
    // no perder centavos al dividir por quantity.
    const unitPrice = item.quantity > 0 ? discountedLineTotal / item.quantity : discountedLineTotal;
    return { title: item.title, quantity: item.quantity, unit_price: unitPrice, currency_id: currency };
  });
  const body = {
    items: [
      ...discountedItems,
      ...(shippingCost > 0 ? [{ title: 'Envío', quantity: 1, unit_price: shippingCost, currency_id: currency }] : []),
    ],
    payer: { email: payerEmail },
    external_reference: orderId,
    back_urls: {
      success: `${siteUrl}/pedido/confirmacion?order=${orderId}`,
      pending: `${siteUrl}/pedido/confirmacion?order=${orderId}`,
      failure: `${siteUrl}/pedido/confirmacion?order=${orderId}`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/mercadopago/webhook`,
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { id?: string; init_point?: string; message?: string };
  if (!response.ok || !data.init_point) throw new Error(data.message ?? 'No se pudo crear la preferencia de pago.');
  return { preferenceId: data.id!, initPoint: data.init_point };
}

export async function fetchMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('No se pudo consultar el pago en Mercado Pago.');
  return (await response.json()) as { status: string; external_reference: string; id: number; transaction_amount?: number };
}

// Reembolso total real vía la API de Mercado Pago (mismo dinero que se cobró
// al pagar). Sin body = reembolso completo.
export async function refundMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`No se pudo reembolsar en Mercado Pago (${response.status}): ${body}`);
  }
}
