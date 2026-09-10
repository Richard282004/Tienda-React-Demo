import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { sendAbandonedCartEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const STALE_MINUTES = 10;

type OrderItem = { name: string; quantity: number };

// Cancela pedidos "pending" con más de 10 minutos sin pago confirmado y
// devuelve su stock reservado al inventario. Sin datos sensibles en la
// respuesta ni en el body: se puede llamar desde cualquier visita a la
// tienda para mantener el inventario al día sin depender de un cron.
export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);

    // Antes de cancelarlos, avisa por correo a quien dejó un pedido a medias.
    // El update-con-returning "reclama" cada pedido (deja de ser null), así que
    // aunque esta ruta se llame en paralelo, el correo sale una sola vez.
    const emailApiKey = env.BREVO_API_KEY;
    if (emailApiKey) {
      try {
        const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
        const { data: claimed } = await supabase
          .from("orders")
          .update({ abandoned_reminded_at: new Date().toISOString() })
          .eq("status", "pending")
          .is("abandoned_reminded_at", null)
          .lt("created_at", cutoff)
          .select("id, customer_email, items");
        if (claimed && claimed.length) {
          const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
          const store = settings?.value as { brandName?: string } | undefined;
          const brandName = store?.brandName || "Tu tienda";
          const fromEmail = env.BREVO_FROM_EMAIL;
          const storeUrl = new URL(request.url).origin;
          for (const order of claimed) {
            if (!order.customer_email) continue;
            await sendAbandonedCartEmail({
              apiKey: emailApiKey,
              to: order.customer_email,
              orderId: order.id,
              items: ((order.items ?? []) as OrderItem[]).map((item) => ({ name: item.name, quantity: item.quantity })),
              storeUrl,
              brandName,
              fromEmail,
            }).catch(() => {});
          }
        }
      } catch {
        /* El recordatorio es un complemento; la limpieza de stock sigue igual. */
      }
    }

    await supabase.rpc("expire_stale_orders");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
