import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Batch endpoint: GET /api/photos?playerIds=a,b&teamIds=c,d
// Returns { players: { id: photoUrl }, teams: { id: logoUrl } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerIds = searchParams.get("playerIds")?.split(",").filter(Boolean) ?? [];
  const teamIds = searchParams.get("teamIds")?.split(",").filter(Boolean) ?? [];

  const [players, teams] = await Promise.all([
    playerIds.length > 0
      ? prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, photoUrl: true },
        })
      : Promise.resolve([]),
    teamIds.length > 0
      ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, logoUrl: true },
        })
      : Promise.resolve([]),
  ]);

  const result = {
    players: Object.fromEntries(players.map((p) => [p.id, p.photoUrl])),
    teams: Object.fromEntries(teams.map((t) => [t.id, t.logoUrl])),
  };

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
