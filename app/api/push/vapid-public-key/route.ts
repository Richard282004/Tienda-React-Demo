import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

// La llave pública VAPID no es secreta (viaja igual dentro de cada
// notificación); el frontend la necesita para pedir la suscripción push.
export async function GET() {
  const publicKey = env.PUSH_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey) return NextResponse.json({ error: "Notificaciones push no configuradas." }, { status: 503 });
  return NextResponse.json({ publicKey });
}
