import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signPlayerToken, PLAYER_COOKIE, PLAYER_MAX_AGE } from "@/lib/player-session";

export const dynamic = "force-dynamic";

// Handle Google's redirect: verify state, exchange code, match email -> player.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const loginUrl = `${origin}/player/login`;
  const fail = (err: string) => NextResponse.redirect(`${loginUrl}?error=${err}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("g_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) return fail("google");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("google_not_configured");

  // Exchange the code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/player/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("google");

  // Fetch the verified email
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return fail("google");
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
  const email = (info.email ?? "").toLowerCase();
  if (!email || info.email_verified === false) return fail("google_email");

  const player = await prisma.player.findFirst({
    where: { isActive: true, email },
    select: { id: true, slug: true },
  });
  if (!player) return fail("no_account");

  const token = await signPlayerToken(player.id);
  const res = NextResponse.redirect(`${origin}/players/${player.slug}`);
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_MAX_AGE,
  });
  res.cookies.delete("g_state");
  return res;
}
