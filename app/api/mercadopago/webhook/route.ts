import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { parseEmailList, sendLowStockAdminEmail, sendNewOrderAdminEmail, sendOrderStatusEmail } from "@/lib/email";
import { formatPrice } from "@/lib/currency";
import { fetchMercadoPagoPayment } from "@/lib/mercadopago";
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
  const mpAccessToken = env.MP_ACCESS_TOKEN as string | undefined;
  if (!supabaseUrl || !serviceRoleKey || !mpAccessToken)
    return NextResponse.json({ ok: false }, { status: 503 });

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  // Mercado Pago reintenta si no respondemos 200; para cualquier notificación
  // que no sea de pago, confirmamos recepción sin hacer nada más.
  if (topic !== "payment" || !paymentId) return NextResponse.json({ ok: true });

  if (!/^\d+$/.test(paymentId)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const payment = await fetchMercadoPagoPayment(mpAccessToken, paymentId);
    const orderStatus = paymentStatusToOrderStatus[payment.status] ?? "pending";
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("status, items, total, customer_name, customer_email, customer_phone, region, comuna, address, address_extra")
      .eq("id", payment.external_reference)
      .maybeSingle();
    const { error } = await supabase
      .from("orders")
      .update({
        status: orderStatus,
        mp_payment_id: String(payment.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.external_reference);
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    // Si el pago se cae (rechazado/cancelado/reembolsado), la reserva de stock
    // hecha al crear el pedido se devuelve al inventario.
    if (orderStatus === "cancelled" && existingOrder && existingOrder.status !== "cancelled") {
      await supabase.rpc("restore_order_stock", { items: existingOrder.items });
    }
    const emailApiKey = env.BREVO_API_KEY as string | undefined;
    if (emailApiKey && existingOrder && existingOrder.status !== orderStatus) {
      try {
        const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
        const store = settings?.value as { brandName?: string; orderNotifyEmail?: string; currency?: string; locale?: string; lowStockThreshold?: number; faviconUrl?: string } | undefined;
        const brandName = store?.brandName || "Tu tienda";
        const fromEmail = env.BREVO_FROM_EMAIL as string | undefined;
        const adminEmails = parseEmailList(store?.orderNotifyEmail);
        await sendOrderStatusEmail({ apiKey: emailApiKey, to: existingOrder.customer_email, orderId: payment.external_reference, status: orderStatus, brandName, fromEmail });
        if (orderStatus === "paid") {
          const items = (existingOrder.items ?? []) as { name: string }[];
          const productLabel = items.length > 1 ? `${items[0]?.name ?? "Producto"} y ${items.length - 1} más` : items[0]?.name ?? "Producto";
          void notifyAdminSubscribers(supabase, env as Record<string, string | undefined>, {
            title: `Nueva venta · ${formatPrice(existingOrder.total, store?.currency, store?.locale)}`,
            body: `Pedido #${payment.external_reference.slice(0, 8)} · ${productLabel}`,
            url: `/admin?order=${payment.external_reference}`,
            icon: store?.faviconUrl,
          });
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
