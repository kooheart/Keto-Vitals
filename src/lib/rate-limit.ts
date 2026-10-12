import { AppError } from "./errors";

/**
 * Fixed-window in-memory limiter. Per server instance only — for multi-instance
 * deployments swap `hits` for Redis/Upstash (same interface).
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  const h = hits.get(key);
  if (!h || h.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return;
  }
  h.count++;
  if (h.count > max) {
    const retry = Math.ceil((h.resetAt - now) / 1000);
    throw new AppError(429, `Too many attempts. Try again in ${retry}s.`, "rate_limited", { retryAfter: retry });
  }
}

export const _resetRateLimits = () => hits.clear();

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
