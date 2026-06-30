import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// Lightweight player session (separate from admin NextAuth). A signed JWT in an
// httpOnly cookie identifies the logged-in player. Status/economy only.

const COOKIE = "bwl_player";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createPlayerSession(playerId: string): Promise<void> {
  const token = await new SignJWT({ sub: playerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getPlayerSession(): Promise<{ playerId: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ? { playerId: payload.sub } : null;
  } catch {
    return null;
  }
}

export async function clearPlayerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
