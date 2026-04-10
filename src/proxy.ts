import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // --- Rate limiting for API routes ---
  if (pathname.startsWith("/api/")) {
    const isAuthRoute = pathname.startsWith("/api/auth");

    const config = isAuthRoute ? RATE_LIMITS.login : RATE_LIMITS.api;
    const key = isAuthRoute ? `login:${ip}` : `api:${ip}`;
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      console.warn(
        `[rate-limit] ${isAuthRoute ? "Login" : "API"} limit hit: ${ip} on ${pathname}`
      );
      return rateLimitResponse(result.retryAfterSeconds);
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    return response;
  }

  // --- Admin route protection ---
  if (pathname.startsWith("/admin")) {
    const session =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token");

    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
