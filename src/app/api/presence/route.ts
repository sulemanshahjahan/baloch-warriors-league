import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlayerSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

// Heartbeat from logged-in players → powers the admin "Active Users" panel.
// Anonymous visitors are a no-op (no DB write); their aggregate stats live in
// Vercel Web Analytics. Approx location comes from Vercel's IP geo headers — we
// store country/city only, never the raw IP.
export async function POST(req: NextRequest) {
  const session = await getPlayerSession();
  if (!session) return new NextResponse(null, { status: 204 });

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

  await prisma.player
    .update({
      where: { id: session.playerId },
      data: { lastSeenAt: new Date(), lastCountry: country, lastCity: city, lastPath: path },
    })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
