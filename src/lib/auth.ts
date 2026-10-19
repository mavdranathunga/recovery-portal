export const AUTH_COOKIE_NAME = "portal_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  username: string;
  exp: number; // Unix timestamp in seconds
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "default_fallback_secret_change_me_32chars!";
  return new TextEncoder().encode(secret);
}

// Convert ArrayBuffer to Hex string
function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Create HMAC-SHA256 signature
async function sign(message: string): Promise<string> {
  const keyData = getSecretKey();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message) as unknown as BufferSource
  );
  return buf2hex(signatureBuffer);
}

// Base64URL encode
function base64UrlEncode(str: string): string {
  const base64 = typeof btoa === "function" 
    ? btoa(str) 
    : Buffer.from(str, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Base64URL decode
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Creates a signed session token: <base64url(payload)>.<signature>
 */
export async function createSessionToken(username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload: SessionPayload = { username, exp };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a signed session token.
 * Returns the payload if valid and not expired, or null otherwise.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  try {
    const expectedSignature = await sign(encodedPayload);
    if (!timingSafeEqual(signature, expectedSignature)) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: SessionPayload = JSON.parse(payloadJson);

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
