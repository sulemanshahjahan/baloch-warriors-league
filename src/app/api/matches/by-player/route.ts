import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const tournamentId = searchParams.get("tournamentId");

  if (!playerId) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
      ...(tournamentId ? { tournamentId } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 100,
    select: {
      id: true,
      round: true,
      status: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
      scheduledAt: true,
      completedAt: true,
      tournament: { select: { name: true } },
      homePlayer: { select: { id: true, name: true } },
      awayPlayer: { select: { id: true, name: true } },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ matches });
}
