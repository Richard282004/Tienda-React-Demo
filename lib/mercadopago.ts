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
}) {
  const { accessToken, orderId, items, shippingCost, discountAmount = 0, payerEmail, siteUrl } = opts;
  const body = {
    items: [
      ...items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: item.unit_price, currency_id: 'CLP' })),
      ...(shippingCost > 0 ? [{ title: 'Envío', quantity: 1, unit_price: shippingCost, currency_id: 'CLP' }] : []),
      ...(discountAmount > 0 ? [{ title: 'Descuento', quantity: 1, unit_price: -discountAmount, currency_id: 'CLP' }] : []),
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
  return (await response.json()) as { status: string; external_reference: string; id: number };
}
