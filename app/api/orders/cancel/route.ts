import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { sendOrderStatusEmail } from "@/lib/email";
import { refundMercadoPagoPayment } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Cancela un pedido desde el panel: si ya se le cobró de verdad a la clienta
// (tiene mp_payment_id), reembolsa automáticamente vía la API de Mercado
// Pago antes de marcarlo cancelado. Devuelve el stock reservado igual.
export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const mpAccessToken = env.MP_ACCESS_TOKEN as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "No disponible." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ error: "Falta el pedido." }, { status: 400 });

  const { data: order } = await supabase
    .from("orders")
    .select("status, items, customer_email, mp_payment_id, tracking_number")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ ok: true, refunded: false, alreadyCancelled: true });

  let refunded = false;
  let refundError: string | null = null;
  if (order.mp_payment_id && mpAccessToken) {
    try {
      await refundMercadoPagoPayment(mpAccessToken, order.mp_payment_id);
      refunded = true;
    } catch (error) {
      refundError = error instanceof Error ? error.message : "No se pudo reembolsar automáticamente.";
    }
  }

  try {
    await supabase.rpc("restore_order_stock", { items: order.items });
  } catch {
    /* No crítico: el pedido igual queda cancelado, el stock se puede ajustar a mano. */
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", body.orderId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const resendApiKey = env.RESEND_API_KEY as string | undefined;
  if (resendApiKey) {
    try {
      const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
      const brandName = (settings?.value as { brandName?: string } | undefined)?.brandName || "Tu tienda";
      await sendOrderStatusEmail({ apiKey: resendApiKey, to: order.customer_email, orderId: body.orderId, status: "cancelled", trackingNumber: order.tracking_number, brandName, fromEmail: env.RESEND_FROM_EMAIL as string | undefined });
    } catch {
      /* El correo es un complemento. */
    }
  }

  return NextResponse.json({ ok: true, refunded, refundError });
}
