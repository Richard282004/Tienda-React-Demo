import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

// La llave pública VAPID no es secreta (viaja igual dentro de cada
// notificación); el frontend la necesita para pedir la suscripción push.
export async function GET() {
  const publicKey = env.PUSH_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey || !env.PUSH_VAPID_PRIVATE_KEY_JWK || !env.PUSH_VAPID_SUBJECT) return NextResponse.json({ error: "Notificaciones push no configuradas." }, { status: 503 });
  return NextResponse.json({ publicKey });
}
