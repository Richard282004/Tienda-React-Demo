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
  return { supabase } as const;
}

// Nunca devuelve el valor guardado: solo si ya hay algo configurado (para no
// filtrar el token/API key a quien mire la respuesta, aunque sea la propia
// administradora).
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;
  const { data } = await auth.supabase
    .from("integration_settings")
    .select("mp_access_token, brevo_api_key, brevo_from_email")
    .eq("id", "default")
    .maybeSingle();
  return NextResponse.json({
    mercadopagoConfigured: Boolean(data?.mp_access_token || env.MP_ACCESS_TOKEN),
    brevoApiKeyConfigured: Boolean(data?.brevo_api_key || env.BREVO_API_KEY),
    brevoFromEmail: data?.brevo_from_email || env.BREVO_FROM_EMAIL || "",
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: { mpAccessToken?: string; brevoApiKey?: string; brevoFromEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Solo se pisa lo que llega no vacío: dejar un campo en blanco en el
  // formulario significa "no tocar este valor", no borrarlo.
  const patch: Record<string, string> = {};
  if (body.mpAccessToken?.trim()) patch.mp_access_token = body.mpAccessToken.trim();
  if (body.brevoApiKey?.trim()) patch.brevo_api_key = body.brevoApiKey.trim();
  if (body.brevoFromEmail?.trim()) patch.brevo_from_email = body.brevoFromEmail.trim();
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await auth.supabase
    .from("integration_settings")
    .upsert({ id: "default", ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
