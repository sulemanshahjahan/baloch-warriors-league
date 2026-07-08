import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, GameCategory } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MATCH_SELECT = {
  id: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  round: true,
  roundNumber: true,
  matchNumber: true,
  homeScore: true,
  awayScore: true,
  homeScorePens: true,
  awayScorePens: true,
  leg2HomeScore: true,
  leg2AwayScore: true,
  leg3HomeScore: true,
  leg3AwayScore: true,
  leg3HomePens: true,
  leg3AwayPens: true,
  tournament: { select: { name: true, slug: true, gameCategory: true } },
  homeTeam: { select: { id: true, name: true, shortName: true, isDuo: true, players: { where: { isActive: true }, select: { player: { select: { id: true, name: true, photoUrl: true } } } } } },
  awayTeam: { select: { id: true, name: true, shortName: true, isDuo: true, players: { where: { isActive: true }, select: { player: { select: { id: true, name: true, photoUrl: true } } } } } },
  homePlayer: { select: { id: true, name: true } },
  awayPlayer: { select: { id: true, name: true } },
} satisfies Prisma.MatchSelect;

type Row = Prisma.MatchGetPayload<{ select: typeof MATCH_SELECT }>;

const totalGoals = (m: Row) =>
  (m.homeScore ?? 0) + (m.awayScore ?? 0) +
  (m.leg2HomeScore ?? 0) + (m.leg2AwayScore ?? 0) +
  (m.leg3HomeScore ?? 0) + (m.leg3AwayScore ?? 0);

const dateOf = (m: Row) =>
  m.completedAt ? new Date(m.completedAt).getTime() : m.scheduledAt ? new Date(m.scheduledAt).getTime() : 0;

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || undefined;
    const q = (sp.get("q") || "").trim();
    const game = sp.get("game") || undefined;
    const tournament = sp.get("tournament") || undefined; // slug
    const sort = sp.get("sort") || "latest";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "10", 10)));

    const and: Prisma.MatchWhereInput[] = [];
    if (status) and.push({ status: status as Prisma.MatchWhereInput["status"] });
    if (game) and.push({ tournament: { is: { gameCategory: game as GameCategory } } });
    if (tournament) and.push({ tournament: { is: { slug: tournament } } });
    if (q) {
      const c = { contains: q, mode: "insensitive" as const };
      and.push({
        OR: [
          { tournament: { is: { name: c } } },
          { homePlayer: { is: { name: c } } },
          { awayPlayer: { is: { name: c } } },
          { homeTeam: { is: { name: c } } },
          { awayTeam: { is: { name: c } } },
          { homeTeam: { is: { players: { some: { player: { is: { name: c } } } } } } },
          { awayTeam: { is: { players: { some: { player: { is: { name: c } } } } } } },
        ],
      });
    }
    const where: Prisma.MatchWhereInput | undefined = and.length ? { AND: and } : undefined;

    // Small dataset → fetch matching set and sort/paginate in memory (supports
    // computed "most goals" sort that Prisma can't order by directly).
    const [all, facetTournaments] = await Promise.all([
      prisma.match.findMany({ where, take: 2000, select: MATCH_SELECT }),
      prisma.tournament.findMany({
        where: { matches: { some: {} } },
        orderBy: { createdAt: "desc" },
        select: { slug: true, name: true, gameCategory: true },
      }),
    ]);

    const sorted =
      sort === "oldest"
        ? [...all].sort((a, b) => (dateOf(a) || Infinity) - (dateOf(b) || Infinity))
        : sort === "goals"
          ? [...all].sort((a, b) => totalGoals(b) - totalGoals(a) || dateOf(b) - dateOf(a))
          : [...all].sort((a, b) => dateOf(b) - dateOf(a)); // latest (default)

    const total = sorted.length;
    const start = (page - 1) * limit;
    const matches = sorted.slice(start, start + limit);
    const games = [...new Set(facetTournaments.map((t) => t.gameCategory))];

    return NextResponse.json(
      { matches, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), facets: { tournaments: facetTournaments, games } },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
