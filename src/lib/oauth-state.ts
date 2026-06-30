import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

// Stateless OAuth CSRF state: an HMAC-signed token carrying a timestamp. The
// callback verifies the signature + freshness, so it needs NO cookie — which is
// essential for mobile apps where the OAuth flow spans the in-app webview and
// the external browser (separate cookie jars).

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// `lt` (link token) is an optional device-generated id used by the mobile-app
// bridge so the external browser can hand the session back to the app's webview.
export function signState(extra?: { lt?: string }): string {
  const payload = b64url(JSON.stringify({ n: randomUUID(), t: Date.now(), ...(extra?.lt ? { lt: extra.lt } : {}) }));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the decoded claims if the state is authentic + fresh, else null.
export function verifyState(state: string | null, maxAgeMs = 10 * 60 * 1000): { t: number; lt?: string } | null {
  if (!state) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", secret()).update(payload).digest());
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as { t?: number; lt?: string };
    if (typeof claims.t !== "number" || Date.now() - claims.t >= maxAgeMs) return null;
    return { t: claims.t, lt: typeof claims.lt === "string" ? claims.lt : undefined };
  } catch {
    return null;
  }
}
