import { NextRequest, NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

// Start the Google OAuth flow for player login. Uses a stateless signed `state`
// (no cookie) so it works in mobile apps where webview/browser cookies differ.
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(`${origin}/player/login?error=google_not_configured`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/player/oauth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state: signState(),
    access_type: "online",
    prompt: "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
