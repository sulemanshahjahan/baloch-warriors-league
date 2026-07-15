import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { cached, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowUp, ArrowDown, Minus, BarChart3 } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ELO Rankings",
  description: "BWL player rankings based on ELO rating system.",
};

export default async function RankingsPage() {
  const { ranked, matchCounts: matchCountsRaw } = await cached(
    CACHE_KEYS.rankings("all"),
    CACHE_TTL.rankings,
    async () => {
      // Get all players with ELO history (not default 1500 with 0 matches)
      const players = await prisma.player.findMany({
        where: { isActive: true },
        orderBy: [{ eloRating: "desc" }, { cardRank: "desc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          position: true,
          eloRating: true,
          eloHistory: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { change: true, result: true },
          },
        },
      });

      const ranked = players.filter((p) => p.eloHistory.length > 0);

      // W/L/D shown here must match the rest of the site (/stats, /players), which
      // count PER FIXTURE (legs aggregated to one result), NOT per ELO leg. The ELO
      // *rating* stays per-leg (correct for ELO); only the displayed record is
      // per-fixture. Filters below are identical to getOverallStats so the numbers
      // line up exactly with the Stats page.
      const matchCountsMap: Record<string, { wins: number; losses: number; draws: number }> = {};
      if (ranked.length > 0) {
        const rankedIds = new Set(ranked.map((p) => p.id));
        const rec = (id: string) => {
          if (!matchCountsMap[id]) matchCountsMap[id] = { wins: 0, losses: 0, draws: 0 };
          return matchCountsMap[id];
        };
        const [singles, duos] = await Promise.all([
          // 1v1 fixtures — same filter as getOverallStats `allMatches`.
          prisma.match.findMany({
            where: { status: "COMPLETED", homePlayerId: { not: null } },
            select: {
              homePlayerId: true, awayPlayerId: true,
              homeScore: true, awayScore: true,
              leg2HomeScore: true, leg2AwayScore: true,
              leg3HomeScore: true, leg3AwayScore: true,
            },
          }),
          // 2v2 duo fixtures — same filter as getOverallStats `duoMatchesRaw`.
          prisma.match.findMany({
            where: { status: "COMPLETED", homeTeam: { isDuo: true } },
            select: {
              homeScore: true, awayScore: true,
              leg2HomeScore: true, leg2AwayScore: true,
              leg3HomeScore: true, leg3AwayScore: true,
              homeTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
              awayTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
            },
          }),
        ]);
        for (const m of singles) {
          const hg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
          const ag = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
          if (m.homePlayerId && rankedIds.has(m.homePlayerId)) {
            const s = rec(m.homePlayerId);
            if (hg > ag) s.wins++; else if (ag > hg) s.losses++; else s.draws++;
          }
          if (m.awayPlayerId && rankedIds.has(m.awayPlayerId)) {
            const s = rec(m.awayPlayerId);
            if (ag > hg) s.wins++; else if (hg > ag) s.losses++; else s.draws++;
          }
        }
        for (const m of duos) {
          const hg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
          const ag = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
          for (const pl of m.homeTeam?.players ?? []) {
            if (!rankedIds.has(pl.playerId)) continue;
            const s = rec(pl.playerId);
            if (hg > ag) s.wins++; else if (ag > hg) s.losses++; else s.draws++;
          }
          for (const pl of m.awayTeam?.players ?? []) {
            if (!rankedIds.has(pl.playerId)) continue;
            const s = rec(pl.playerId);
            if (ag > hg) s.wins++; else if (hg > ag) s.losses++; else s.draws++;
          }
        }
      }

      return { ranked, matchCounts: matchCountsMap };
    }
  );

  const matchCounts = new Map(Object.entries(matchCountsRaw));

  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Rankings
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            ELO Rankings
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Player rankings calculated using the ELO rating system. Win against higher-rated opponents to climb faster.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {ranked.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No ranked players yet. Ratings update after completed 1v1 matches.</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Leaderboard ({ranked.length} players)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ranked.map((player, i) => {
                  const lastChange = player.eloHistory[0]?.change ?? 0;
                  const record = matchCounts.get(player.id) ?? { wins: 0, losses: 0, draws: 0 };
                  const totalMatches = record.wins + record.losses + record.draws;
                  const winRate = totalMatches > 0 ? Math.round((record.wins / totalMatches) * 100) : 0;

                  const rankColors = [
                    "text-yellow-400", // 1st
                    "text-gray-400",   // 2nd
                    "text-orange-400", // 3rd
                  ];

                  return (
                    <Link
                      key={player.id}
                      href={`/players/${player.slug}`}
                      className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Rank */}
                        <span className={`text-lg sm:text-xl font-black w-8 text-center ${rankColors[i] ?? "text-muted-foreground"}`}>
                          {i + 1}
                        </span>

                        {/* Avatar */}
                        <SmartAvatar
                          type="player"
                          id={player.id}
                          name={player.name}
                          className="h-10 w-10 sm:h-12 sm:w-12"
                          fallbackClassName="text-sm"
                        />

                        {/* Info */}
                        <div>
                          <p className="font-semibold text-sm sm:text-base">{player.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{record.wins}W {record.losses}L {record.draws}D</span>
                            {totalMatches > 0 && (
                              <span className="text-muted-foreground/60">· {winRate}% WR</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rating + Change */}
                      <div className="flex items-center gap-3">
                        {/* Last change badge */}
                        {lastChange !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-medium ${lastChange > 0 ? "text-green-400" : "text-red-400"}`}>
                            {lastChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(lastChange)}
                          </span>
                        )}
                        {lastChange === 0 && player.eloHistory.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}

                        {/* Rating */}
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black tabular-nums">{player.eloRating}</span>
                          <p className="text-[10px] text-muted-foreground">ELO</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
