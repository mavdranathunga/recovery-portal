interface RateLimitRecord {
  attempts: number;
  resetTime: number; // Unix timestamp in ms
}

// In-memory sliding window store
const rateLimitMap = new Map<string, RateLimitRecord>();

// Automatically clean up stale keys periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Checks and increments rate limit for a specific identifier (e.g. client IP).
 * 
 * @param key Unique key to rate limit on (IP address, user, etc.)
 * @param maxAttempts Maximum allowed attempts within window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000 // 1 minute window
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // If no record exists or the current window has expired, start a fresh window
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, {
      attempts: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxAttempts - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  // Window is still active
  if (record.attempts >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.attempts += 1;
  const remaining = maxAttempts - record.attempts;
  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

  return {
    success: true,
    remaining,
    retryAfterSeconds,
  };
}

/**
 * Resets the rate limit counter for a key upon successful authentication.
 */
export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key);
}
