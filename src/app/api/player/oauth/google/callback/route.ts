import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signPlayerToken, PLAYER_COOKIE, PLAYER_MAX_AGE } from "@/lib/player-session";
import { verifyState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

// Handle Google's redirect: verify state, exchange code, match email -> player.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const loginUrl = `${origin}/player/login`;
  const fail = (err: string, detail?: string) => {
    console.error(`[google-oauth] fail=${err}`, detail ?? "");
    return NextResponse.redirect(`${loginUrl}?error=${err}`);
  };

  // Google can return an explicit error (e.g. access_denied)
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) return fail("google", `google returned error=${oauthErr}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return fail("google", "no code");
  // Stateless CSRF: verify the signed state (no cookie — works in mobile apps).
  if (!verifyState(state)) {
    return fail("google_state", `state=${state ? "present-but-invalid" : "missing"}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
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
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    return fail("google_token", `status=${tokenRes.status} body=${body.slice(0, 300)}`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("google_token", "no access_token in response");

  // Fetch the verified email
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    const body = await infoRes.text().catch(() => "");
    return fail("google_userinfo", `status=${infoRes.status} body=${body.slice(0, 200)}`);
  }
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
  const email = (info.email ?? "").toLowerCase();
  if (!email || info.email_verified === false) return fail("google_email");

  const player = await prisma.player.findFirst({
    where: { isActive: true, email },
    select: { id: true, slug: true },
  });
  if (!player) return fail("no_account", `no active player with email=${email}`);

  const token = await signPlayerToken(player.id);
  const res = NextResponse.redirect(`${origin}/players/${player.slug}`);
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_MAX_AGE,
  });
  return res;
}
