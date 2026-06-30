import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getPlayerSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

const VID_COOKIE = "bwl_vid";
const VID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Heartbeat for the admin "Active Users" panel. Tracks EVERY visitor (browser)
// via an anonymous cookie — logged-in members get linked to their player.
// Approx location comes from Vercel IP geo headers (country/city, never raw IP).
export async function POST(req: NextRequest) {
  const session = await getPlayerSession(); // may be null (anonymous visitor)

  let path = "/";
  try {
    const body = (await req.json()) as { path?: string };
    if (typeof body?.path === "string" && body.path) path = body.path.slice(0, 200);
  } catch {
    /* ignore */
  }

  const h = req.headers;
  const country = h.get("x-vercel-ip-country") || null;
  const cityRaw = h.get("x-vercel-ip-city");
  const city = cityRaw ? decodeURIComponent(cityRaw).slice(0, 80) : null;

  const vid = req.cookies.get(VID_COOKIE)?.value || randomUUID();
  const playerId = session?.playerId ?? null;
  const now = new Date();

  await prisma.visitorSession
    .upsert({
      where: { id: vid },
      create: { id: vid, playerId, country, city, lastPath: path, pageViews: 1, lastSeenAt: now },
      update: { playerId, country, city, lastPath: path, pageViews: { increment: 1 }, lastSeenAt: now },
    })
    .catch(() => {});

  // Keep the member's own last-seen fresh too (used elsewhere on the profile).
  if (playerId) {
    await prisma.player
      .update({ where: { id: playerId }, data: { lastSeenAt: now, lastCountry: country, lastCity: city, lastPath: path } })
      .catch(() => {});
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(VID_COOKIE, vid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VID_MAX_AGE,
  });
  return res;
}
