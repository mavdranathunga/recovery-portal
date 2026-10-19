import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Determine client IP from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || "127.0.0.1");

    // Rate limit: 5 attempts per 60 seconds per IP
    const rateLimit = checkRateLimit(`login_${clientIp}`, 5, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`,
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    const expectedUser = process.env.PORTAL_USERNAME || "admin";
    const expectedPass = process.env.PORTAL_PASSWORD || "recovery2025";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (username.trim() !== expectedUser || password !== expectedPass) {
      return NextResponse.json(
        {
          error: "Invalid username or password",
          remainingAttempts: rateLimit.remaining,
        },
        { status: 401 }
      );
    }

    // Login successful: reset rate limit counter for this IP
    resetRateLimit(`login_${clientIp}`);

    // Generate signed token
    const token = await createSessionToken(username.trim());

    const response = NextResponse.json({
      success: true,
      user: { username: username.trim() },
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
