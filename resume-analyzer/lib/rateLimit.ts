/**
 * Minimal fixed-window, in-memory rate limiter keyed by client IP. It resets
 * on restart and isn't shared across instances; put a shared store (e.g.
 * Redis) in front if you run more than one server.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10),
  windowMs = 60 * 60 * 1000,
  now = Date.now(),
): { ok: boolean; retryAfterSeconds: number } {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimit() {
  hits.clear();
}
