import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const matchSelect = {
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
  homePlayer: { select: { id: true, name: true, photoUrl: true } },
  awayPlayer: { select: { id: true, name: true, photoUrl: true } },
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const tournamentId = searchParams.get("tournamentId");

  if (!playerId) {
    return NextResponse.json({ matches: [] });
  }

  const tournamentFilter = tournamentId ? { tournamentId } : {};

  // Two parallel indexed queries instead of one slow OR query
  const [homeMatches, awayMatches] = await Promise.all([
    prisma.match.findMany({
      where: { homePlayerId: playerId, ...tournamentFilter },
      orderBy: { completedAt: "desc" },
      take: 50,
      select: matchSelect,
    }),
    prisma.match.findMany({
      where: { awayPlayerId: playerId, ...tournamentFilter },
      orderBy: { completedAt: "desc" },
      take: 50,
      select: matchSelect,
    }),
  ]);

  // Merge, dedupe, and sort
  const seen = new Set<string>();
  const matches = [...homeMatches, ...awayMatches]
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => {
      // Completed first (by completedAt desc), then scheduled (by scheduledAt asc)
      if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
      if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;
      if (a.completedAt && b.completedAt) return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      return 0;
    });

  return NextResponse.json(
    { matches },
    { headers: { "Cache-Control": "private, s-maxage=10, stale-while-revalidate=30" } },
  );
}
