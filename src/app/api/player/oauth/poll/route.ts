import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signPlayerToken, PLAYER_COOKIE, PLAYER_MAX_AGE } from "@/lib/player-session";

export const dynamic = "force-dynamic";

// Mobile-app OAuth bridge: the app's webview polls this with the link token it
// generated. Once the external browser has completed Google login and written
// the one-time code, this redeems it and sets the session cookie — and because
// the request comes FROM the webview, the cookie lands in the webview's jar.
export async function GET(req: NextRequest) {
  const lt = new URL(req.url).searchParams.get("lt");
  if (!lt) return NextResponse.json({ ok: false });

  const auth = await prisma.playerAuthCode.findUnique({ where: { code: lt } });
  if (!auth || auth.used || auth.expiresAt < new Date()) {
    return NextResponse.json({ ok: false });
  }

  // Single-use: burn the code as it's redeemed.
  await prisma.playerAuthCode.update({ where: { code: lt }, data: { used: true } });

  const player = await prisma.player.findUnique({
    where: { id: auth.playerId },
    select: { slug: true },
  });

  const token = await signPlayerToken(auth.playerId);
  const res = NextResponse.json({ ok: true, slug: player?.slug ?? null });
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_MAX_AGE,
  });
  return res;
}
