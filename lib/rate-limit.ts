// Límite de peticiones por IP, en memoria del isolate de Cloudflare Workers.
// No es un límite distribuido perfecto (cada isolate lleva su propia cuenta),
// pero corta en seco el abuso de una misma fuente sobre endpoints caros
// (crear pedido, iniciar pago) sin depender de KV, Durable Objects ni de
// configurar reglas en el panel. Primera línea de defensa, cero infra.

type Hits = { count: number; resetAt: number };

const buckets = new Map<string, Hits>();

// Limpieza perezosa: al pasar de este tamaño, se botan las entradas vencidas.
const MAX_BUCKETS = 5000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// IP del visitante según los headers que agrega Cloudflare. "unknown" agrupa
// a quien no la manda: comparten cupo, que es lo prudente.
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
