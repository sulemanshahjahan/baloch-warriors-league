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
  // Per-fixture model (matches the league standings):
  // 1 fixture = 1 match, multi-leg knockouts aggregate scores across legs to determine the winner.
  const [players, individualMatches, eventGoalCounts] = await Promise.all([
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
        _count: { select: { awards: true } },
        teams: {
          where: { isActive: true },
          select: { team: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    }),
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        homePlayerId: { not: null },
        awayPlayerId: { not: null },
        tournament: { gameCategory: { not: "PUBG" }, participantType: "INDIVIDUAL" },
      },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
        homeScore: true, awayScore: true,
        leg2HomeScore: true, leg2AwayScore: true,
        leg3HomeScore: true, leg3AwayScore: true,
      },
    }),
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "GOAL", playerId: { not: null } },
      _count: { type: true },
    }),
  ]);

  type Acc = { matches: number; wins: number; goals: number };
  const acc = new Map<string, Acc>();
  const ensure = (id: string) => {
    if (!acc.has(id)) acc.set(id, { matches: 0, wins: 0, goals: 0 });
    return acc.get(id)!;
  };

  for (const m of individualMatches) {
    const hg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
    const ag = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
    const home = ensure(m.homePlayerId!);
    const away = ensure(m.awayPlayerId!);
    home.matches++; away.matches++;
    home.goals += hg; away.goals += ag;
    if (hg > ag) home.wins++;
    else if (ag > hg) away.wins++;
  }

  const eventGoalsMap = new Map(eventGoalCounts.map((g) => [g.playerId!, g._count.type]));

  return players.map((player) => {
    const a = acc.get(player.id);
    // Scoreline is authoritative when the player has 1v1 matches; fall back to events for team-only players.
    const goals = a && a.matches > 0 ? a.goals : (eventGoalsMap.get(player.id) ?? 0);
    return {
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
        goals,
        wins: a?.wins ?? 0,
        assists: 0,
        matches: a?.matches ?? 0,
        tournaments: 0,
      },
    };
  });
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
