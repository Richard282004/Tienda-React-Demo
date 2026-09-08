// Envío de correos transaccionales vía la API REST de Resend (sin SDK, para
// que corra bien en el runtime de Cloudflare Workers).

const FROM = 'Lúmina <onboarding@resend.dev>';

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
}

const wrap = (title: string, body: string) => `
  <div style="font-family: Georgia, serif; background: #f6efeb; padding: 32px 16px;">
    <div style="max-width: 480px; margin: 0 auto; background: #fffaf5; border-radius: 20px; padding: 32px; color: #351f2c;">
      <p style="color: #a74060; font-size: 22px; margin: 0 0 20px;">✦ Lúmina</p>
      <h1 style="font-size: 22px; font-weight: 400; margin: 0 0 16px;">${title}</h1>
      <div style="font-size: 14px; line-height: 1.7; color: #4a363d;">${body}</div>
    </div>
  </div>`;

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export async function sendOrderConfirmationEmail(opts: {
  apiKey: string;
  to: string;
  orderId: string;
  items: { name: string; unitPrice: number; quantity: number }[];
  total: number;
}) {
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name} — ${formatCLP(item.unitPrice * item.quantity)}</li>`).join('');
  const html = wrap(
    'Recibimos tu pedido',
    `<p>Gracias por tu compra. Tu pedido <strong>#${opts.orderId.slice(0, 8)}</strong> quedó registrado y está esperando la confirmación del pago.</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Total: ${formatCLP(opts.total)}</strong></p>
     <p>Te avisaremos apenas se confirme el pago.</p>`,
  );
  await sendEmail(opts.apiKey, opts.to, `Pedido #${opts.orderId.slice(0, 8)} recibido — Lúmina`, html);
}

const statusCopy: Record<string, { subject: string; title: string; body: string }> = {
  paid: { subject: 'Tu pago fue confirmado', title: '¡Pago confirmado!', body: 'Ya recibimos tu pago. Estamos preparando tu pedido para despacharlo pronto.' },
  shipped: { subject: 'Tu pedido va en camino', title: 'Tu pedido fue despachado', body: 'Tu pedido ya salió de nuestro taller y va en camino.' },
  delivered: { subject: 'Tu pedido fue entregado', title: '¡Pedido entregado!', body: 'Esperamos que disfrutes tu compra. Gracias por preferir Lúmina.' },
  cancelled: { subject: 'Tu pedido fue cancelado', title: 'Pedido cancelado', body: 'Tu pedido fue cancelado. Si el pago fue rechazado, puedes intentarlo de nuevo desde la tienda.' },
};

export async function sendOrderStatusEmail(opts: { apiKey: string; to: string; orderId: string; status: string; trackingNumber?: string | null }) {
  const copy = statusCopy[opts.status];
  if (!copy) return;
  const tracking = opts.trackingNumber ? `<p>N° de seguimiento: <strong>${opts.trackingNumber}</strong></p>` : '';
  const html = wrap(copy.title, `<p>${copy.body}</p>${tracking}<p>Pedido #${opts.orderId.slice(0, 8)}</p>`);
  await sendEmail(opts.apiKey, opts.to, `${copy.subject} — Lúmina`, html);
}
