/**
 * Rate limiting in-process (token bucket por chave).
 *
 * ⚠️ Escopo Phase 2: protege formulários públicos contra spam básico
 * (abuse de restart é aceitável em dev). Na Phase 6 (e-mail/outreach),
 * migra para rate_limits em Postgres, conforme IMPLEMENTATION_PLAN.md.
 */

type Bucket = { tokens: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Limpa buckets antigos periodicamente para não vazar memória.
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { tokens: options.limit - 1, resetAt: now + options.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (bucket.tokens <= 0) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.tokens -= 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Extrai o IP do request (atrás de proxy/Vercel) — best effort. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
