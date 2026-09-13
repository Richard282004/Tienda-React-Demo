import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { sendWinbackEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Correo "vuelve" a clientes que compraron hace entre 30 y 120 días y no han
// vuelto. Se dispara desde un cron (GitHub Actions) con el header
// x-cron-secret = env.CRON_SECRET. Cada cliente recibe el correo una sola vez
// (se marca winback_sent_at en todos sus pedidos al enviarlo).
const MIN_DAYS = 30;
const MAX_DAYS = 120;
const BATCH = 40; // tope por corrida, para no saturar el proveedor de correo

type OrderRow = {
  customer_email: string;
  customer_name: string | null;
  created_at: string;
  status: string;
  winback_sent_at: string | null;
  user_id: string | null;
};

export async function POST(request: Request) {
  const secret = env.CRON_SECRET as string | undefined;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const emailApiKey = env.BREVO_API_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });
  if (!emailApiKey) return NextResponse.json({ ok: true, sent: 0, note: "sin correo" });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const since = new Date(Date.now() - MAX_DAYS * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from("orders")
    .select("customer_email, customer_name, created_at, status, winback_sent_at, user_id")
    .in("status", ["paid", "shipped", "delivered"])
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const orders = (rows ?? []) as OrderRow[];
  const cutoff = Date.now() - MIN_DAYS * 86_400_000;
  const byEmail = new Map<string, { name: string | null; latest: number; alreadySent: boolean; userId: string | null }>();
  for (const order of orders) {
    if (!order.customer_email) continue;
    const key = order.customer_email.toLowerCase();
    const at = new Date(order.created_at).getTime();
    const entry = byEmail.get(key);
    if (!entry) {
      byEmail.set(key, { name: order.customer_name, latest: at, alreadySent: Boolean(order.winback_sent_at), userId: order.user_id });
    } else {
      entry.latest = Math.max(entry.latest, at);
      if (order.winback_sent_at) entry.alreadySent = true;
      if (order.user_id) entry.userId = order.user_id;
    }
  }

  // Quien tiene cuenta y apagó "correos de ofertas y novedades" en Mi cuenta
  // no entra al lote (las de invitada no tienen dónde configurar esto).
  const accountUserIds = [...byEmail.values()].map((v) => v.userId).filter((id): id is string => Boolean(id));
  const optedOut = new Set<string>();
  if (accountUserIds.length) {
    const { data: profileRows } = await supabase.from("profiles").select("id, marketing_emails_enabled").in("id", accountUserIds);
    for (const profile of profileRows ?? []) {
      if (profile.marketing_emails_enabled === false) optedOut.add(profile.id);
    }
  }

  const targets = [...byEmail.entries()]
    .filter(([, v]) => !v.alreadySent && v.latest < cutoff && !(v.userId && optedOut.has(v.userId)))
    .slice(0, BATCH);

  const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
  const store = settings?.value as { brandName?: string; winbackCode?: string } | undefined;
  const brandName = store?.brandName || "Tu tienda";
  const fromEmail = env.BREVO_FROM_EMAIL as string | undefined;
  const storeUrl = new URL(request.url).origin;

  let sent = 0;
  for (const [email, info] of targets) {
    // Reclama: marca todos los pedidos de ese correo. Si no actualiza nada,
    // otra corrida ya lo tomó.
    const { data: claimed } = await supabase
      .from("orders")
      .update({ winback_sent_at: new Date().toISOString() })
      .eq("customer_email", email)
      .is("winback_sent_at", null)
      .select("id");
    if (!claimed || !claimed.length) continue;
    try {
      await sendWinbackEmail({
        apiKey: emailApiKey,
        to: email,
        customerName: info.name ?? undefined,
        storeUrl,
        discountCode: store?.winbackCode || undefined,
        brandName,
        fromEmail,
      });
      sent += 1;
    } catch {
      /* El correo falló para este; el pedido ya quedó marcado para no reintentar en bucle. */
    }
  }

  return NextResponse.json({ ok: true, sent });
}
