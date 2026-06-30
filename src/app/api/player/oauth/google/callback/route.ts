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
  const claims = verifyState(state);
  if (!claims) {
    return fail("google_state", `state=${state ? "present-but-invalid" : "missing"}`);
  }
  const linkToken = claims.lt; // present => mobile-app bridge flow

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

  // Mobile-app bridge: this callback runs in the EXTERNAL browser, whose cookie
  // jar the app's webview can't read. So instead of a cookie, record a one-time
  // code the app's webview polls + redeems (where the session cookie belongs).
  if (linkToken) {
    await prisma.playerAuthCode.create({
      data: { code: linkToken, playerId: player.id, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    return new NextResponse(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed in</title>
      <style>body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}
      .c{max-width:340px}.t{font-size:22px;font-weight:800;margin:0 0 8px}.s{color:#a1a1aa;font-size:15px;line-height:1.5}</style></head>
      <body><div class="c"><p class="t">✓ Signed in</p><p class="s">You're signed in. <b>Return to the BWL app</b> — it'll finish logging you in automatically. You can close this tab.</p></div></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

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
