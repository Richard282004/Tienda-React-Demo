import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { parseEmailList, sendLowStockAdminEmail, sendNewOrderAdminEmail, sendOrderStatusEmail, sendReceiptEmail } from "@/lib/email";
import { formatPrice } from "@/lib/currency";
import { getIntegrationSecrets } from "@/lib/integrations";
import { fetchMercadoPagoPayment } from "@/lib/mercadopago";
import { generateReceiptPdf, uint8ToBase64 } from "@/lib/receipt";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdminSubscribers } from "@/lib/web-push";

const paymentStatusToOrderStatus: Record<string, "paid" | "cancelled" | "pending"> = {
  approved: "paid",
  rejected: "cancelled",
  cancelled: "cancelled",
  refunded: "cancelled",
  pending: "pending",
  in_process: "pending",
};

export async function POST(request: Request) {
  // Mercado Pago reintenta de forma legítima, así que el tope es holgado; solo
  // corta una avalancha de notificaciones falsas que nos harían consultar su
  // API una y otra vez.
  if (!rateLimit(`mp-webhook:${clientIp(request)}`, 120, 60).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey)
    return NextResponse.json({ ok: false }, { status: 503 });

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  // Mercado Pago reintenta si no respondemos 200; para cualquier notificación
  // que no sea de pago, confirmamos recepción sin hacer nada más.
  if (topic !== "payment" || !paymentId) return NextResponse.json({ ok: true });

  if (!/^\d+$/.test(paymentId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    const { mpAccessToken, brevoApiKey: emailApiKey, brevoFromEmail: fromEmail } = await getIntegrationSecrets(supabase, env as Record<string, string | undefined>);
    if (!mpAccessToken) return NextResponse.json({ ok: false }, { status: 503 });
    const payment = await fetchMercadoPagoPayment(mpAccessToken, paymentId);
    const orderStatus = paymentStatusToOrderStatus[payment.status] ?? "pending";
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("status, items, total, customer_name, customer_email, customer_phone, region, comuna, address, address_extra, shipping_payment, shipping_carrier")
      .eq("id", payment.external_reference)
      .maybeSingle();
    const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
    const store = settings?.value as { brandName?: string; orderNotifyEmail?: string; currency?: string; locale?: string; lowStockThreshold?: number; faviconUrl?: string; pushNewSale?: boolean; pushPaymentReview?: boolean } | undefined;
    const { data: transition, error } = await supabase.rpc("apply_payment_status", {
      p_order_id: payment.external_reference, p_payment_id: String(payment.id),
      p_status: orderStatus, p_amount: payment.transaction_amount,
    });
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    const effectiveStatus = transition?.status ?? orderStatus;
    if (!transition?.changed) return NextResponse.json({ ok: true });
    const pushAllowed = effectiveStatus === "payment_review" ? store?.pushPaymentReview !== false : store?.pushNewSale !== false;
    if (existingOrder && pushAllowed && (effectiveStatus === "paid" || effectiveStatus === "payment_review")) {
      const items = (existingOrder.items ?? []) as { name: string }[];
      await notifyAdminSubscribers(supabase, env as Record<string, string | undefined>, {
        title: effectiveStatus === "payment_review" ? "Pago recibido: revisar stock antes de despachar" : `Nueva venta · ${formatPrice(existingOrder.total)}`,
        body: `Pedido #${payment.external_reference.slice(0, 8)} · ${items[0]?.name ?? "Producto"}`,
        url: `/admin?order=${payment.external_reference}`,
      });
    }
    if (emailApiKey && existingOrder && effectiveStatus !== "payment_review") {
      try {
        const brandName = store?.brandName || "Tu tienda";
        const adminEmails = parseEmailList(store?.orderNotifyEmail);
        if (orderStatus === "paid") {
          // El comprobante con el detalle del pago reemplaza el correo
          // genérico de "pago confirmado" (ya lleva ese mismo mensaje).
          try {
            const pdfBytes = await generateReceiptPdf({
              brandName,
              orderId: payment.external_reference,
              paymentId: String(payment.id),
              paidAt: payment.date_approved || new Date().toISOString(),
              customerName: existingOrder.customer_name,
              customerEmail: existingOrder.customer_email,
              items: existingOrder.items,
              total: existingOrder.total,
              currency: store?.currency,
              locale: store?.locale,
            });
            await sendReceiptEmail({ apiKey: emailApiKey, to: existingOrder.customer_email, orderId: payment.external_reference, pdfBase64: uint8ToBase64(pdfBytes), brandName, fromEmail });
          } catch {
            // Si falla el PDF o el envío con adjunto, al menos avisa el cambio de estado.
            await sendOrderStatusEmail({ apiKey: emailApiKey, to: existingOrder.customer_email, orderId: payment.external_reference, status: orderStatus, shippingPayment: existingOrder.shipping_payment, shippingCarrier: existingOrder.shipping_carrier, brandName, fromEmail });
          }
        } else {
          await sendOrderStatusEmail({ apiKey: emailApiKey, to: existingOrder.customer_email, orderId: payment.external_reference, status: orderStatus, shippingPayment: existingOrder.shipping_payment, shippingCarrier: existingOrder.shipping_carrier, brandName, fromEmail });
        }
        if (orderStatus === "paid" && adminEmails.length) {
          await sendNewOrderAdminEmail({
            apiKey: emailApiKey,
            to: adminEmails,
            orderId: payment.external_reference,
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            customerPhone: existingOrder.customer_phone,
            region: existingOrder.region,
            comuna: existingOrder.comuna,
            address: existingOrder.address,
            addressExtra: existingOrder.address_extra,
            items: existingOrder.items,
            total: existingOrder.total,
            shippingPayment: existingOrder.shipping_payment,
            brandName,
            fromEmail,
            currency: store?.currency,
            locale: store?.locale,
          });

          // Aviso de stock bajo: tras confirmar la venta, revisa las unidades
          // que quedan de los productos comprados.
          const threshold = typeof store?.lowStockThreshold === "number" && store.lowStockThreshold >= 0 ? store.lowStockThreshold : 5;
          const productIds = [...new Set(((existingOrder.items ?? []) as { productId: string }[]).map((item) => item.productId).filter(Boolean))];
          if (productIds.length) {
            const { data: stockRows } = await supabase.from("products").select("name, stock").in("id", productIds);
            const low = (stockRows ?? []).filter((row): row is { name: string; stock: number } => typeof row.stock === "number" && row.stock <= threshold);
            if (low.length) {
              await sendLowStockAdminEmail({ apiKey: emailApiKey, to: adminEmails, products: low, threshold, brandName, fromEmail });
            }
          }
        }
      } catch {
        /* El correo es un complemento: si falla, el estado del pedido ya quedó guardado. */
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Un error transitorio debe permitir que el proveedor reintente.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
