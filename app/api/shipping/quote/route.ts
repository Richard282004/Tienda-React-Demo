import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { quoteEnviaRates, type EnviaAddress } from "@/lib/envia";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { StoreContent } from "@/lib/store-data";

type QuoteRequest = {
  name?: string;
  phone?: string;
  email?: string;
  region?: string;
  comuna?: string;
  address?: string;
  addressExtra?: string;
  itemCount?: number;
};

async function fetchStoreSettings(): Promise<Partial<StoreContent> | null> {
  const base = env.VITE_SUPABASE_URL as string | undefined;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return null;
  const res = await fetch(`${base}/rest/v1/site_content?select=value&key=eq.store&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { value?: Partial<StoreContent> }[];
  return rows[0]?.value ?? null;
}

export async function POST(request: Request) {
  // Cotizar es una llamada a un servicio de terceros con costo: mismo tope
  // que el checkout para que no se pueda golpear en loop.
  const limit = rateLimit(`shipping-quote:${clientIp(request)}`, 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = env.ENVIA_API_TOKEN as string | undefined;
  if (!apiKey) return NextResponse.json({ error: "La cotización de envío no está configurada." }, { status: 503 });

  let payload: QuoteRequest;
  try {
    const body = await request.text();
    if (body.length > 5_000) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
    payload = JSON.parse(body) as QuoteRequest;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!payload.region?.trim() || !payload.comuna?.trim() || !payload.address?.trim()) {
    return NextResponse.json({ error: "Falta región, comuna o dirección." }, { status: 400 });
  }

  const settings = await fetchStoreSettings();
  if (!settings?.courierQuoteEnabled) {
    return NextResponse.json({ error: "La cotización en tiempo real está desactivada." }, { status: 503 });
  }
  if (!settings.shippingOriginStreet || !settings.shippingOriginComuna || !settings.shippingOriginRegion) {
    return NextResponse.json({ error: "Falta configurar la dirección de origen en Admin." }, { status: 503 });
  }

  const origin: EnviaAddress = {
    name: settings.brandName || "Tienda",
    phone: settings.shippingOriginPhone || settings.phone || "",
    street: settings.shippingOriginStreet,
    number: settings.shippingOriginNumber || "S/N",
    district: settings.shippingOriginComuna,
    city: settings.shippingOriginCity || settings.shippingOriginComuna,
    state: settings.shippingOriginRegion,
    country: "CL",
  };
  const destination: EnviaAddress = {
    name: payload.name || "Cliente",
    phone: payload.phone || "",
    email: payload.email,
    street: payload.address,
    number: "S/N",
    district: payload.comuna,
    city: payload.comuna,
    state: payload.region,
    country: "CL",
    reference: payload.addressExtra,
  };

  const itemCount = Math.max(1, Math.round(payload.itemCount ?? 1));
  const weightGrams = itemCount * (settings.shippingDefaultItemWeightGrams || 150);

  try {
    const rates = await quoteEnviaRates({
      apiKey,
      origin,
      destination,
      weightKg: weightGrams / 1000,
      currency: settings.currency || "CLP",
    });
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cotizar el envío." }, { status: 502 });
  }
}
