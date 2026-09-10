// Envío de correos transaccionales vía la API REST de Resend (sin SDK, para
// que corra bien en el runtime de Cloudflare Workers).
import { formatPrice } from './currency';
import { parseEmailList } from './email-list';

export { parseEmailList };

const DEFAULT_FROM = 'onboarding@resend.dev';

async function sendEmail(apiKey: string, from: string, to: string | string[], subject: string, html: string) {
  const recipients = Array.isArray(to) ? to : [to];
  const payload = JSON.stringify({ from, to: recipients, subject, html });
  // Un reintento ante fallos transitorios de Resend (429 / 5xx / red caída):
  // los correos salen desde rutas "fire-and-forget", así que sin esto un
  // hipo momentáneo pierde el aviso para siempre.
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: payload,
      });
      if (response.ok) return;
      lastError = `Resend error ${response.status}: ${await response.text().catch(() => '')}`;
      if (response.status !== 429 && response.status < 500) break; // 4xx real: reintentar no ayuda
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fallo de red al enviar el correo';
    }
  }
  throw new Error(lastError || 'no se pudo enviar el correo');
}

const wrap = (brandName: string, title: string, body: string) => `
  <div style="font-family: Georgia, serif; background: #f6efeb; padding: 32px 16px;">
    <div style="max-width: 480px; margin: 0 auto; background: #fffaf5; border-radius: 20px; padding: 32px; color: #351f2c;">
      <p style="color: #a74060; font-size: 22px; margin: 0 0 20px;">✦ ${brandName}</p>
      <h1 style="font-size: 22px; font-weight: 400; margin: 0 0 16px;">${title}</h1>
      <div style="font-size: 14px; line-height: 1.7; color: #4a363d;">${body}</div>
    </div>
  </div>`;

export async function sendOrderConfirmationEmail(opts: {
  apiKey: string;
  to: string;
  orderId: string;
  items: { name: string; unitPrice: number; quantity: number }[];
  total: number;
  brandName?: string;
  fromEmail?: string;
  currency?: string;
  locale?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name} — ${price(item.unitPrice * item.quantity)}</li>`).join('');
  const html = wrap(
    brandName,
    'Recibimos tu pedido',
    `<p>Gracias por tu compra. Tu pedido <strong>#${opts.orderId.slice(0, 8)}</strong> quedó registrado y está esperando la confirmación del pago.</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Total: ${price(opts.total)}</strong></p>
     <p>Te avisaremos apenas se confirme el pago.</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Pedido #${opts.orderId.slice(0, 8)} recibido — ${brandName}`, html);
}

const statusCopy: Record<string, { subject: string; title: string; body: (brandName: string) => string }> = {
  paid: { subject: 'Tu pago fue confirmado', title: '¡Pago confirmado!', body: () => 'Ya recibimos tu pago. Estamos preparando tu pedido para despacharlo pronto.' },
  shipped: { subject: 'Tu pedido va en camino', title: 'Tu pedido fue despachado', body: () => 'Tu pedido ya salió de nuestro taller y va en camino.' },
  delivered: { subject: 'Tu pedido fue entregado', title: '¡Pedido entregado!', body: (brandName) => `Esperamos que disfrutes tu compra. Gracias por preferir ${brandName}.` },
  cancelled: { subject: 'Tu pedido fue cancelado', title: 'Pedido cancelado', body: () => 'Tu pedido fue cancelado. Si el pago fue rechazado, puedes intentarlo de nuevo desde la tienda.' },
};

export async function sendNewOrderAdminEmail(opts: {
  apiKey: string;
  to: string | string[];
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  region: string;
  comuna: string;
  address: string;
  addressExtra?: string | null;
  items: { name: string; unitPrice: number; quantity: number }[];
  total: number;
  brandName?: string;
  fromEmail?: string;
  currency?: string;
  locale?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name} — ${price(item.unitPrice * item.quantity)}</li>`).join('');
  const addressLine = [opts.address, opts.addressExtra].filter(Boolean).join(', ');
  const html = wrap(
    brandName,
    '¡Nueva venta!',
    `<p>Pago confirmado del pedido <strong>#${opts.orderId.slice(0, 8)}</strong>.</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Total: ${price(opts.total)}</strong></p>
     <p><strong>${opts.customerName}</strong><br>${opts.customerEmail} · ${opts.customerPhone}<br>${opts.comuna}, ${opts.region}${addressLine ? `<br>${addressLine}` : ''}</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `¡Nueva venta! Pedido #${opts.orderId.slice(0, 8)} — ${brandName}`, html);
}

export async function sendOrderChatMessageEmail(opts: {
  apiKey: string;
  to: string | string[];
  orderId: string;
  senderRole: 'admin' | 'customer';
  body: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const senderLabel = opts.senderRole === 'admin' ? brandName : 'Un cliente';
  const whereToReply = opts.senderRole === 'admin' ? 'tu cuenta en la tienda' : 'el panel de administración';
  const html = wrap(
    brandName,
    'Nuevo mensaje sobre tu pedido',
    `<p>${senderLabel} te escribió sobre el pedido <strong>#${opts.orderId.slice(0, 8)}</strong>:</p>
     <p style="background:#f6efeb; border-radius:12px; padding:14px 16px; margin:12px 0;">${opts.body.replace(/</g, '&lt;')}</p>
     <p>Responde desde ${whereToReply}.</p>`,
  );
  const subject = opts.senderRole === 'admin' ? `Tienes un mensaje sobre tu pedido #${opts.orderId.slice(0, 8)} — ${brandName}` : `Nuevo mensaje de un cliente — Pedido #${opts.orderId.slice(0, 8)}`;
  await sendEmail(opts.apiKey, from, opts.to, subject, html);
}

export async function sendAbandonedCartEmail(opts: {
  apiKey: string;
  to: string;
  orderId: string;
  items: { name: string; quantity: number }[];
  storeUrl: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name}</li>`).join('');
  const html = wrap(
    brandName,
    '¿Se te quedó algo en la bolsita?',
    `<p>Empezaste un pedido pero no alcanzamos a recibir el pago, así que liberamos el stock que tenías reservado.</p>
     <ul>${itemsHtml}</ul>
     <p>Si todavía lo quieres, está a un clic:</p>
     <p><a href="${opts.storeUrl}/#tienda" style="display:inline-block; background:#5c2640; color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none;">Volver a la tienda</a></p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `¿Se te quedó algo? — ${brandName}`, html);
}

export async function sendLowStockAdminEmail(opts: {
  apiKey: string;
  to: string | string[];
  products: { name: string; stock: number }[];
  threshold: number;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const rows = opts.products
    .map((product) => `<li><strong>${product.name}</strong> — ${product.stock === 0 ? 'sin stock' : `quedan ${product.stock}`}</li>`)
    .join('');
  const html = wrap(
    brandName,
    'Stock bajo en la tienda',
    `<p>Tras la última venta, estos productos quedaron con ${opts.threshold} unidades o menos:</p>
     <ul>${rows}</ul>
     <p>Repón el stock desde Admin → Productos para no quedar en cero.</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Stock bajo — ${brandName}`, html);
}

export async function sendWinbackEmail(opts: {
  apiKey: string;
  to: string;
  customerName?: string;
  storeUrl: string;
  discountCode?: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const hi = opts.customerName ? `Hola, ${opts.customerName.split(' ')[0]}:` : 'Hola:';
  const codeBlock = opts.discountCode
    ? `<p style="background:#f6efeb; border-radius:12px; padding:14px 16px; margin:14px 0;">
         Y como te extrañamos, tu próxima compra lleva un descuento con el código
         <strong style="letter-spacing:.04em;">${opts.discountCode}</strong>.
         Lo escribes en el carrito antes de pagar.
       </p>`
    : '';
  const html = wrap(
    brandName,
    'Hace tiempo que no te vemos',
    `<p>${hi}</p>
     <p>Pasó un tiempo desde que llegó a tus manos algo tejido acá, y quisimos escribirte para saludarte.</p>
     <p>Seguimos en lo mismo de siempre: hacer amiguitos de crochet a mano, puntada por puntada, con lana suave y mucho cariño. Estas semanas sumamos personajes y colores nuevos que creemos que te van a gustar.</p>
     ${codeBlock}
     <p style="margin-top:18px;">
       <a href="${opts.storeUrl}/#tienda" style="display:inline-block; background:#5c2640; color:#fff; padding:13px 24px; border-radius:999px; text-decoration:none; font-weight:700;">Ver lo nuevo</a>
     </p>
     <p style="margin-top:22px; color:#75646e; font-size:13px;">
       Si tienes una idea o un personaje en mente, respóndenos este correo: los pedidos especiales también los tejemos.
     </p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Te tejimos cosas nuevas — ${brandName}`, html);
}

export async function sendOrderStatusEmail(opts: { apiKey: string; to: string; orderId: string; status: string; trackingNumber?: string | null; brandName?: string; fromEmail?: string }) {
  const copy = statusCopy[opts.status];
  if (!copy) return;
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const tracking = opts.trackingNumber ? `<p>N° de seguimiento: <strong>${opts.trackingNumber}</strong></p>` : '';
  const html = wrap(brandName, copy.title, `<p>${copy.body(brandName)}</p>${tracking}<p>Pedido #${opts.orderId.slice(0, 8)}</p>`);
  await sendEmail(opts.apiKey, from, opts.to, `${copy.subject} — ${brandName}`, html);
}
