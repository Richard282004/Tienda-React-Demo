import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Cancela pedidos "pending" con más de 10 minutos sin pago confirmado y
// devuelve su stock reservado al inventario. Sin datos sensibles en la
// respuesta ni en el body: se puede llamar desde cualquier visita a la
// tienda para mantener el inventario al día sin depender de un cron.
export async function POST() {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    await supabase.rpc("expire_stale_orders");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
