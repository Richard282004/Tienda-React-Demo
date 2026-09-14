// Comprobante simple en PDF para el pedido pagado (no es boleta electrónica
// SII, es un recibo de la tienda). pdf-lib es JS puro, corre bien en el
// runtime de Cloudflare Workers.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatPrice } from './currency';

export async function generateReceiptPdf(opts: {
  brandName: string;
  orderId: string;
  paymentId: string;
  paidAt: string;
  customerName: string;
  customerEmail: string;
  items: { name: string; unitPrice: number; quantity: number; variantLabel?: string }[];
  total: number;
  currency?: string;
  locale?: string;
}): Promise<Uint8Array> {
  const price = (value: number) => formatPrice(value, opts.currency, opts.locale);
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 595]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.21, 0.12, 0.17);
  const muted = rgb(0.42, 0.37, 0.4);

  let y = 545;
  const draw = (text: string, options: { size?: number; useFont?: typeof font; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(text, { x: 40, y, size: options.size ?? 11, font: options.useFont ?? font, color: options.color ?? ink });
    y -= (options.size ?? 11) + 8;
  };

  draw(opts.brandName, { size: 18, useFont: bold });
  draw('Comprobante de pago', { size: 12, color: muted });
  y -= 6;
  draw(`Pedido: #${opts.orderId.slice(0, 8)}`);
  draw(`N° de comprobante (Mercado Pago): ${opts.paymentId}`);
  draw(`Fecha de pago: ${new Date(opts.paidAt).toLocaleString('es-CL')}`);
  draw(`Cliente: ${opts.customerName}`);
  draw(`Correo: ${opts.customerEmail}`);
  y -= 10;
  draw('Detalle', { size: 12, useFont: bold });
  for (const item of opts.items) {
    const label = `${item.quantity}x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`;
    draw(`${label} — ${price(item.unitPrice * item.quantity)}`, { size: 10 });
  }
  y -= 10;
  draw(`Total pagado: ${price(opts.total)}`, { size: 13, useFont: bold });

  return doc.save();
}

// btoa espera una cadena binaria, no acepta bytes >255 directo desde
// Uint8Array; se construye en trozos para no reventar el stack con archivos
// grandes (String.fromCharCode con spread falla sobre ~65k bytes).
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
