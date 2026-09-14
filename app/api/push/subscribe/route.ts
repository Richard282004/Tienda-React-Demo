import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function requireAdmin(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return { error: NextResponse.json({ ok: false }, { status: 503 }) } as const;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) } as const;
  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) } as const;
  return { supabase, userId: userData.user.id } as const;
}

// Guarda (o actualiza) la suscripción push de este navegador para esta
// administradora. Un mismo endpoint (mismo navegador/dispositivo) se
// reemplaza en vez de duplicarse.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  if (!endpoint || !p256dh || !authKey) return NextResponse.json({ error: "Faltan datos de la suscripción." }, { status: 400 });

  const { error } = await auth.supabase
    .from("push_subscriptions")
    .upsert({ user_id: auth.userId, endpoint, p256dh, auth_key: authKey }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Borra la suscripción (botón "desactivar" o cuando el navegador la da de baja).
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "Falta el endpoint." }, { status: 400 });

  const { error } = await auth.supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
