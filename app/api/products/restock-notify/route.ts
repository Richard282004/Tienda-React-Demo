import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { sendBackInStockEmail } from "@/lib/email";
import { getIntegrationSecrets } from "@/lib/integrations";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// La admin sube el stock de un producto agotado y esta ruta avisa a quienes
// dejaron su correo en ese producto (tabla stock_alerts). Solo admin puede
// llamarla; cada correo se marca notified_at para no avisar dos veces.
export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { brevoApiKey: emailApiKey, brevoFromEmail: fromEmail } = await getIntegrationSecrets(supabase, env as Record<string, string | undefined>);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  let body: { productId?: string; variantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!body.productId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  if (!emailApiKey) return NextResponse.json({ ok: true, sent: 0 });

  // Si vuelve stock de una variante puntual, solo avisa a quien pidió esa
  // variante (no a quien esperaba otro color/talla del mismo producto).
  let claimQuery = supabase.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("product_id", body.productId).is("notified_at", null);
  claimQuery = body.variantId ? claimQuery.eq("variant_id", body.variantId) : claimQuery.is("variant_id", null);
  const { data: claimed } = await claimQuery.select("email");
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, sent: 0 });

  const { data: product } = await supabase.from("products").select("name").eq("id", body.productId).maybeSingle();
  if (!product) return NextResponse.json({ ok: true, sent: 0 });

  const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
  const store = settings?.value as { brandName?: string } | undefined;
  const brandName = store?.brandName || "Tu tienda";
  const productUrl = `${new URL(request.url).origin}/producto/${body.productId}`;

  let sent = 0;
  for (const row of claimed) {
    try {
      await sendBackInStockEmail({ apiKey: emailApiKey, to: row.email, productName: product.name, productUrl, brandName, fromEmail });
      sent += 1;
    } catch {
      /* Un correo fallido no debe frenar el resto de los avisos. */
    }
  }
  return NextResponse.json({ ok: true, sent });
}
