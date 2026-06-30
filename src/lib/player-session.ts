import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// Lightweight player session (separate from admin NextAuth). A signed HS256 JWT
// in an httpOnly cookie identifies the logged-in player. Implemented with Node
// crypto (no external dep) so it builds cleanly under pnpm strict deps.

export const PLAYER_COOKIE = "bwl_player";
export const PLAYER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

/** Sign a player session JWT (for setting on a NextResponse in route handlers). */
export async function signPlayerToken(playerId: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: playerId, iat: now, exp: now + PLAYER_MAX_AGE }));
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

function verifyToken(token: string): { playerId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = sign(`${header}.${payload}`);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as {
      sub?: string;
      exp?: number;
    };
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims.sub ? { playerId: claims.sub } : null;
  } catch {
    return null;
  }
}

export async function createPlayerSession(playerId: string): Promise<void> {
  const token = await signPlayerToken(playerId);
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_MAX_AGE,
  });
}

export async function getPlayerSession(): Promise<{ playerId: string } | null> {
  const jar = await cookies();
  const token = jar.get(PLAYER_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function clearPlayerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PLAYER_COOKIE);
}
