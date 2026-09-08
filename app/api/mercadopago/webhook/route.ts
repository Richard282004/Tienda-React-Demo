import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { sendOrderStatusEmail } from "@/lib/email";
import { fetchMercadoPagoPayment } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const paymentStatusToOrderStatus: Record<string, "paid" | "cancelled" | "pending"> = {
  approved: "paid",
  rejected: "cancelled",
  cancelled: "cancelled",
  refunded: "cancelled",
  pending: "pending",
  in_process: "pending",
};

export async function POST(request: Request) {
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
      .select("status, items, customer_email")
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
    const resendApiKey = env.RESEND_API_KEY as string | undefined;
    if (resendApiKey && existingOrder && existingOrder.status !== orderStatus) {
      try {
        await sendOrderStatusEmail({ apiKey: resendApiKey, to: existingOrder.customer_email, orderId: payment.external_reference, status: orderStatus });
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
