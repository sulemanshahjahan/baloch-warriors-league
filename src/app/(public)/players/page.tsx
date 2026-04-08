export const revalidate = 300;

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
  // Two parallel queries instead of 5 sequential ones
  const [players, eloStats] = await Promise.all([
    // Query 1: Players with goal count
    prisma.player.findMany({
      where: { isActive: true },
      orderBy: { eloRating: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        nickname: true,
        position: true,
        nationality: true,
        eloRating: true,
        _count: {
          select: {
            awards: true,
            homeMatches: { where: { status: "COMPLETED" } },
            awayMatches: { where: { status: "COMPLETED" } },
          },
        },
        teams: {
          where: { isActive: true },
          select: { team: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    }),
    // Query 2: Win counts from ELO history (already indexed)
    prisma.eloHistory.groupBy({
      by: ["playerId"],
      where: { result: "WIN" },
      _count: { result: true },
    }),
  ]);

  // Build wins map
  const winsMap = new Map(eloStats.map((e) => [e.playerId, e._count.result]));

  // Get goal counts in one batch
  const playerIds = players.map((p) => p.id);
  const goalCounts = playerIds.length > 0
    ? await prisma.matchEvent.groupBy({
        by: ["playerId"],
        where: { playerId: { in: playerIds }, type: "GOAL" },
        _count: { type: true },
      })
    : [];
  const goalsMap = new Map(goalCounts.map((g) => [g.playerId!, g._count.type]));

  return players.map((player) => ({
    id: player.id,
    name: player.name,
    slug: player.slug,
    nickname: player.nickname,
    position: player.position,
    nationality: player.nationality,
    eloRating: player.eloRating,
    teams: player.teams,
    _count: { matchEvents: 0, awards: player._count.awards },
    stats: {
      goals: goalsMap.get(player.id) ?? 0,
      wins: winsMap.get(player.id) ?? 0,
      assists: 0,
      matches: player._count.homeMatches + player._count.awayMatches,
      tournaments: 0,
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
