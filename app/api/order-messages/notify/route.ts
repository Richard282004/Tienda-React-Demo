import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { parseEmailList, sendOrderChatMessageEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// El mensaje ya se guardó (insert directo desde el cliente vía Supabase, para
// que el chat en tiempo real siga andando igual). Esta ruta solo se encarga
// del correo de aviso -- si falla, el chat ya funcionó igual.
export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = env.RESEND_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) return NextResponse.json({ ok: false }, { status: 503 });

  const payload = (await request.json().catch(() => null)) as { orderId?: string; senderRole?: "admin" | "customer"; body?: string } | null;
  if (!payload?.orderId || !payload.senderRole || !payload.body?.trim()) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    const [{ data: order }, { data: settings }] = await Promise.all([
      supabase.from("orders").select("customer_email").eq("id", payload.orderId).maybeSingle(),
      supabase.from("site_content").select("value").eq("key", "store").maybeSingle(),
    ]);
    if (!order) return NextResponse.json({ ok: false }, { status: 404 });
    const store = settings?.value as { brandName?: string; orderNotifyEmail?: string } | undefined;
    const brandName = store?.brandName || "Tu tienda";
    const fromEmail = env.RESEND_FROM_EMAIL;
    // Cliente escribe -> avisa a la tienda (uno o varios correos); tienda
    // escribe -> avisa al cliente.
    const to: string | string[] =
      payload.senderRole === "customer" ? parseEmailList(store?.orderNotifyEmail) : order.customer_email;
    if (!to || (Array.isArray(to) && !to.length)) return NextResponse.json({ ok: true }); // sin destino: nada que avisar

    await sendOrderChatMessageEmail({
      apiKey: resendApiKey,
      to,
      orderId: payload.orderId,
      senderRole: payload.senderRole,
      body: payload.body.trim(),
      brandName,
      fromEmail,
    });
    return NextResponse.json({ ok: true });
  } catch {
    // El correo es un complemento: si falla, el mensaje del chat ya se guardó.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
