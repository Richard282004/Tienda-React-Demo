// Envío de correos transaccionales vía la API REST de Brevo (sin SDK, para
// que corra bien en el runtime de Cloudflare Workers).
import { COLLECT_NOTICE, BLUE_TRACKING_URL } from './shipping';
import { formatPrice } from './currency';
import { parseEmailList } from './email-list';

export { parseEmailList };

// Remitente de reserva. Brevo exige que el correo esté verificado en la cuenta;
// se sobreescribe con BREVO_FROM_EMAIL. Si no hay uno verificado, Brevo rechaza
// el envío con 400 y el correo simplemente no sale (el resto del pedido sigue).
const DEFAULT_FROM = 'no-reply@example.com';

// Acepta "Marca <correo@dominio>" o solo "correo@dominio".
function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || undefined, email: match[2].trim() };
  return { email: from.trim() };
}

// Genera una versión en texto plano del HTML: los filtros de spam (Gmail,
// Yahoo, Outlook) penalizan correos que solo traen htmlContent.
function htmlToText(html: string): string {
  return html
    .replace(/<(li|p|div|h[1-6])[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail(apiKey: string, from: string, to: string | string[], subject: string, html: string, attachments?: { name: string; content: string }[]) {
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const payload = JSON.stringify({
    sender: parseSender(from),
    to: recipients,
    subject,
    htmlContent: html,
    textContent: htmlToText(html),
    ...(attachments?.length ? { attachment: attachments } : {}),
  });
  // Un reintento ante fallos transitorios de Brevo (429 / 5xx / red caída):
  // los correos salen desde rutas "fire-and-forget", así que sin esto un
  // hipo momentáneo pierde el aviso para siempre.
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey },
        body: payload,
      });
      if (response.ok) return;
      lastError = `Brevo error ${response.status}: ${await response.text().catch(() => '')}`;
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
  items: { name: string; unitPrice: number; quantity: number; variantLabel?: string }[];
  total: number;
  shippingPayment?: string;
  brandName?: string;
  fromEmail?: string;
  currency?: string;
  locale?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} — ${price(item.unitPrice * item.quantity)}</li>`).join('');
  const html = wrap(
    brandName,
    'Recibimos tu pedido',
    `<p>Gracias por tu compra. Tu pedido <strong>#${opts.orderId.slice(0, 8)}</strong> quedó registrado y está esperando la confirmación del pago.</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Total: ${price(opts.total)}</strong></p>${opts.shippingPayment === 'collect' ? `<p>${COLLECT_NOTICE}</p>` : ''}
     <p>Te avisaremos apenas se confirme el pago.</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Pedido #${opts.orderId.slice(0, 8)} recibido — ${brandName}`, html);
}

export async function sendTransferInstructionsEmail(opts: {
  apiKey: string;
  to: string;
  orderId: string;
  items: { name: string; unitPrice: number; quantity: number; variantLabel?: string }[];
  total: number;
  shippingPayment?: string;
  transferDetails: string;
  holdHours: number;
  storeUrl: string;
  brandName?: string;
  fromEmail?: string;
  currency?: string;
  locale?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} — ${price(item.unitPrice * item.quantity)}</li>`).join('');
  const detailsHtml = opts.transferDetails.replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const html = wrap(
    brandName,
    'Recibimos tu pedido — falta la transferencia',
    `<p>Tu pedido <strong>#${opts.orderId.slice(0, 8)}</strong> quedó reservado. Para confirmarlo, transfiere el total:</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Total a transferir: ${price(opts.total)}</strong></p>${opts.shippingPayment === 'collect' ? `<p>${COLLECT_NOTICE}</p>` : ''}
     <p style="background:#f6efeb; border-radius:12px; padding:14px 16px; margin:14px 0; line-height:1.7;">${detailsHtml}</p>
     <p style="background:#fbeed2; border-radius:9px; padding:10px 14px; margin:0 0 14px; color:#7a5a1e;">Pon <strong>${opts.orderId.slice(0, 8)}</strong> como mensaje/glosa de la transferencia, así identificamos tu pago al tiro.</p>
     <p>Después de transferir, <strong>envíanos el comprobante</strong> respondiendo este correo o por el chat de tu pedido:
       <a href="${opts.storeUrl}/pedido/confirmacion?order=${opts.orderId}">ver mi pedido</a>.</p>
     <p style="color:#75646e; font-size:13px;">Guardamos tu reserva por ${opts.holdHours} horas. Si no recibimos la transferencia en ese plazo, el pedido se libera.</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Transfiere para confirmar tu pedido #${opts.orderId.slice(0, 8)} — ${brandName}`, html);
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
  items: { name: string; unitPrice: number; quantity: number; variantLabel?: string }[];
  total: number;
  shippingPayment?: string;
  brandName?: string;
  fromEmail?: string;
  currency?: string;
  locale?: string;
  pendingTransfer?: boolean;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} — ${price(item.unitPrice * item.quantity)}</li>`).join('');
  const addressLine = [opts.address, opts.addressExtra].filter(Boolean).join(', ');
  const lead = opts.pendingTransfer
    ? `<p>Nuevo pedido <strong>por transferencia</strong> #${opts.orderId.slice(0, 8)} — <strong>pendiente de pago</strong>. Confírmalo en Admin → Pedidos cuando llegue la plata.</p>`
    : `<p>Pago confirmado del pedido <strong>#${opts.orderId.slice(0, 8)}</strong>.</p>`;
  const html = wrap(
    brandName,
    opts.pendingTransfer ? 'Nuevo pedido por transferencia' : '¡Nueva venta!',
    `${lead}
     <ul>${itemsHtml}</ul>
     <p><strong>Total: ${price(opts.total)}</strong></p>${opts.shippingPayment === 'collect' ? `<p>${COLLECT_NOTICE}</p>` : ''}
     <p><strong>${opts.customerName}</strong><br>${opts.customerEmail} · ${opts.customerPhone}<br>${opts.comuna}, ${opts.region}${addressLine ? `<br>${addressLine}` : ''}</p>`,
  );
  const subject = opts.pendingTransfer
    ? `Nuevo pedido por transferencia #${opts.orderId.slice(0, 8)} — ${brandName}`
    : `¡Nueva venta! Pedido #${opts.orderId.slice(0, 8)} — ${brandName}`;
  await sendEmail(opts.apiKey, from, opts.to, subject, html);
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
  items: { name: string; quantity: number; variantLabel?: string }[];
  storeUrl: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const itemsHtml = opts.items.map((item) => `<li>${item.quantity}× ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}</li>`).join('');
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

export async function sendOrderStatusEmail(opts: { apiKey: string; to: string; orderId: string; status: string; trackingNumber?: string | null; shippingPayment?: string; shippingCarrier?: string | null; brandName?: string; fromEmail?: string }) {
  const copy = statusCopy[opts.status];
  if (!copy) return;
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const safeTracking = (opts.trackingNumber ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
  const tracking = safeTracking ? `<p>N° de seguimiento: <strong>${safeTracking}</strong></p>${opts.shippingCarrier === 'blue_express' ? `<p><a href="${BLUE_TRACKING_URL}">Seguir mi envío en Blue Express</a>. Ingresa el número indicado arriba.</p>` : ''}` : '';
  const html = wrap(brandName, copy.title, `<p>${copy.body(brandName)}</p>${tracking}${opts.shippingPayment === 'collect' ? `<p>${COLLECT_NOTICE}</p>` : ''}<p>Pedido #${opts.orderId.slice(0, 8)}</p>`);
  await sendEmail(opts.apiKey, from, opts.to, `${copy.subject} — ${brandName}`, html);
}

export async function sendReceiptEmail(opts: {
  apiKey: string;
  to: string;
  orderId: string;
  pdfBase64: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const html = wrap(
    brandName,
    '¡Pago confirmado!',
    `<p>Ya recibimos tu pago. Estamos preparando tu pedido <strong>#${opts.orderId.slice(0, 8)}</strong> para despacharlo pronto.</p>
     <p>Adjuntamos el comprobante de tu compra.</p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Tu pago fue confirmado — ${brandName}`, html, [
    { name: `comprobante-${opts.orderId.slice(0, 8)}.pdf`, content: opts.pdfBase64 },
  ]);
}

export async function sendBackInStockEmail(opts: {
  apiKey: string;
  to: string;
  productName: string;
  productUrl: string;
  brandName?: string;
  fromEmail?: string;
}) {
  const brandName = opts.brandName || 'Tu tienda';
  const from = `${brandName} <${opts.fromEmail || DEFAULT_FROM}>`;
  const html = wrap(
    brandName,
    '¡Ya volvió!',
    `<p>Nos pediste que te avisáramos: <strong>${opts.productName}</strong> ya tiene stock de nuevo.</p>
     <p>Como se agota rápido, te conviene mirarlo antes de que se acabe otra vez:</p>
     <p><a href="${opts.productUrl}" style="display:inline-block; background:#5c2640; color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none;">Ver producto</a></p>`,
  );
  await sendEmail(opts.apiKey, from, opts.to, `Ya volvió: ${opts.productName} — ${brandName}`, html);
}
