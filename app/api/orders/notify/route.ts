import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { sendOrderStatusEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const emailApiKey = env.BREVO_API_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });
  if (!emailApiKey) return NextResponse.json({ ok: true }); // Sin proveedor de correo configurado, no hay correo que mandar.

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  let body: { orderId?: string; status?: string; trackingNumber?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!body.orderId || !body.status) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

  const { data: order } = await supabase.from("orders").select("customer_email").eq("id", body.orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  try {
    const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
    const brandName = (settings?.value as { brandName?: string } | undefined)?.brandName || "Tu tienda";
    await sendOrderStatusEmail({ apiKey: emailApiKey, to: order.customer_email, orderId: body.orderId, status: body.status, trackingNumber: body.trackingNumber, brandName, fromEmail: env.BREVO_FROM_EMAIL as string | undefined });
  } catch {
    /* El correo es un complemento; el cambio de estado ya se guardó antes de llamar aquí. */
  }
  return NextResponse.json({ ok: true });
}
