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

export function signState(): string {
  const payload = b64url(JSON.stringify({ n: randomUUID(), t: Date.now() }));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyState(state: string | null, maxAgeMs = 10 * 60 * 1000): boolean {
  if (!state) return false;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return false;
  const expected = b64url(createHmac("sha256", secret()).update(payload).digest());
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as { t?: number };
    return typeof claims.t === "number" && Date.now() - claims.t < maxAgeMs;
  } catch {
    return false;
  }
}
