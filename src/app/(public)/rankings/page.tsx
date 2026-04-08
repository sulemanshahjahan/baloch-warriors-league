import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowUp, ArrowDown, Minus, BarChart3 } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ELO Rankings",
  description: "BWL player rankings based on ELO rating system.",
};

export default async function RankingsPage() {
  // Get all players with ELO history (not default 1500 with 0 matches)
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { eloRating: "desc" },
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

  // Filter to only players who have at least 1 ELO match or non-default rating
  const ranked = players.filter(
    (p) => p.eloRating !== 1500 || p.eloHistory.length > 0
  );

  // Get match counts for each ranked player
  const matchCounts = new Map<string, { wins: number; losses: number; draws: number }>();
  if (ranked.length > 0) {
    const histories = await prisma.eloHistory.groupBy({
      by: ["playerId", "result"],
      where: { playerId: { in: ranked.map((p) => p.id) } },
      _count: { result: true },
    });
    for (const h of histories) {
      const existing = matchCounts.get(h.playerId) ?? { wins: 0, losses: 0, draws: 0 };
      if (h.result === "WIN") existing.wins = h._count.result;
      else if (h.result === "LOSS") existing.losses = h._count.result;
      else if (h.result === "DRAW") existing.draws = h._count.result;
      matchCounts.set(h.playerId, existing);
    }
  }

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
