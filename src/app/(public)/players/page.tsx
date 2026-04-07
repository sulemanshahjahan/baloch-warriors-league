export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Users } from "lucide-react";
import { PlayersList } from "./players-list";

export const metadata: Metadata = {
  title: "Players",
  description: "Browse all BWL players — view profiles, stats, and tournament history.",
  openGraph: {
    title: "Players | Baloch Warriors League",
    description: "All BWL players with profiles and career statistics.",
    type: "website",
  },
};

async function getPlayersWithStats() {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { matchEvents: true, awards: true },
      },
      teams: {
        where: { isActive: true },
        include: { team: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  });

  // Get player IDs for batch queries
  const playerIds = players.map(p => p.id);

  // Handle empty case
  if (playerIds.length === 0) {
    return players.map(player => ({
      ...player,
      stats: { goals: 0, assists: 0, matches: 0, tournaments: 0 },
    }));
  }

  // Get goals and assists counts
  const [goalsAgg, assistsAgg, tournamentCounts] = await Promise.all([
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { 
        playerId: { in: playerIds },
        type: "GOAL" 
      },
      _count: { type: true },
    }),
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { 
        playerId: { in: playerIds },
        type: "ASSIST" 
      },
      _count: { type: true },
    }),
    prisma.tournamentPlayer.groupBy({
      by: ["playerId"],
      where: { playerId: { in: playerIds } },
      _count: { tournamentId: true },
    }),
  ]);

  // Get matches played (count unique matches per player)
  const playerMatches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: { in: playerIds } },
        { awayPlayerId: { in: playerIds } },
      ],
    },
    select: {
      homePlayerId: true,
      awayPlayerId: true,
    },
  });

  // Count matches per player
  const matchesCount = new Map<string, number>();
  for (const match of playerMatches) {
    if (match.homePlayerId) {
      matchesCount.set(match.homePlayerId, (matchesCount.get(match.homePlayerId) || 0) + 1);
    }
    if (match.awayPlayerId) {
      matchesCount.set(match.awayPlayerId, (matchesCount.get(match.awayPlayerId) || 0) + 1);
    }
  }

  // Build stats maps
  const goalsMap = new Map(goalsAgg.map(g => [g.playerId!, g._count.type]));
  const assistsMap = new Map(assistsAgg.map(a => [a.playerId!, a._count.type]));
  const tournamentsMap = new Map(tournamentCounts.map(t => [t.playerId!, t._count.tournamentId]));

  // Merge stats into players
  return players.map(player => ({
    ...player,
    stats: {
      goals: goalsMap.get(player.id) || 0,
      assists: assistsMap.get(player.id) || 0,
      matches: matchesCount.get(player.id) || 0,
      tournaments: tournamentsMap.get(player.id) || 0,
    },
  }));
}

export default async function PlayersPage() {
  const players = await getPlayersWithStats();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Players
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            All Players
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Discover the athletes competing in the Baloch Warriors League. View
            player profiles, stats, and achievements.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlayersList players={players} />
      </div>
    </div>
  );
}
