// lib/rate-limit.ts
//
// A minimal in-memory rate limiter for the two endpoints the security
// checklist calls out by name: login and password reset.
//
// Honest limitation: this lives in the memory of one server process. Vercel
// runs serverless functions, so under real concurrent load a caller can land
// on several different instances, each with its own counter — this throttles
// a sustained attack from one instance, it does not guarantee a hard global
// cap the way a shared store (Upstash Redis, etc.) would. That upgrade is a
// known next step, noted here and in the project report, not implemented
// given the timeline.

const buckets = new Map<string, { count: number; resetAt: number }>()

/** Bounds memory growth without a background timer: sweeps opportunistically. */
function sweepExpired(now: number) {
  if (buckets.size < 500) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * `key` should already combine the thing being protected with the caller —
 * e.g. "login:jane@acme.test" — so one account under attack does not also
 * throttle everyone else signing in normally.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweepExpired(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 }
export const PASSWORD_RESET_LIMIT = { max: 3, windowMs: 60 * 60_000 }
