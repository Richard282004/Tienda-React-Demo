import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { sendOrderStatusEmail } from "@/lib/email";
import { getIntegrationSecrets } from "@/lib/integrations";
import { refundMercadoPagoPayment } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Cancela un pedido desde el panel: si ya se le cobró de verdad a la cliente
// (tiene mp_payment_id), reembolsa automáticamente vía la API de Mercado
// Pago antes de marcarlo cancelado. Devuelve el stock reservado igual.
export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "No disponible." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { mpAccessToken, brevoApiKey: emailApiKey, brevoFromEmail: fromEmail } = await getIntegrationSecrets(supabase, env as Record<string, string | undefined>);
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

  if (refundError) return NextResponse.json({ error: "No se canceló el pedido porque el reembolso falló. Revisa Mercado Pago antes de reintentar." }, { status: 502 });
  if (order.mp_payment_id && !mpAccessToken) return NextResponse.json({ error: "No se puede reembolsar sin configurar Mercado Pago." }, { status: 503 });

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", body.orderId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (emailApiKey) {
    try {
      const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
      const brandName = (settings?.value as { brandName?: string } | undefined)?.brandName || "Tu tienda";
      await sendOrderStatusEmail({ apiKey: emailApiKey, to: order.customer_email, orderId: body.orderId, status: "cancelled", trackingNumber: order.tracking_number, brandName, fromEmail });
    } catch {
      /* El correo es un complemento. */
    }
  }

  return NextResponse.json({ ok: true, refunded, refundError });
}
