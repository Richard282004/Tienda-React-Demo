import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

// Chequeo de salud para el monitor externo (GitHub Actions / UptimeRobot).
// Verifica que el Worker responde y que Supabase está accesible. No expone
// ningún dato: solo "ok" | "degraded" y qué subsistema falla.
export async function GET() {
  const started = Date.now();
  const checks: Record<string, "ok" | "fail" | "skip"> = { worker: "ok", supabase: "skip" };

  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (supabaseUrl && anonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/site_content?select=key&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.supabase = res.ok ? "ok" : "fail";
    } catch {
      checks.supabase = "fail";
    }
  }

  const healthy = !Object.values(checks).includes("fail");
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, ms: Date.now() - started },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
