export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Trophy,
  Target,
  Users,
  Swords,
  TrendingUp,
} from "lucide-react";
import { getInitials, gameLabel } from "@/lib/utils";

async function getStats() {
  // Top scorers
  const topScorers = await prisma.matchEvent.groupBy({
    by: ["playerId"],
    where: { type: "GOAL", playerId: { not: null } },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  const topScorerIds = topScorers.map((s) => s.playerId!).filter(Boolean);
  const topScorerPlayers = await prisma.player.findMany({
    where: { id: { in: topScorerIds } },
    select: { id: true, name: true, slug: true, photoUrl: true },
  });

  // Top assists
  const topAssists = await prisma.matchEvent.groupBy({
    by: ["playerId"],
    where: { type: "ASSIST", playerId: { not: null } },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  const topAssistIds = topAssists.map((s) => s.playerId!).filter(Boolean);
  const topAssistPlayers = await prisma.player.findMany({
    where: { id: { in: topAssistIds } },
    select: { id: true, name: true, slug: true, photoUrl: true },
  });

  // Most MOTM
  const topMOTM = await prisma.matchEvent.groupBy({
    by: ["playerId"],
    where: { type: "MOTM", playerId: { not: null } },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 10,
  });

  const topMOTMIds = topMOTM.map((s) => s.playerId!).filter(Boolean);
  const topMOTMPlayers = await prisma.player.findMany({
    where: { id: { in: topMOTMIds } },
    select: { id: true, name: true, slug: true, photoUrl: true },
  });

  // Overall stats
  const [
    totalTournaments,
    totalTeams,
    totalPlayers,
    totalMatches,
    completedMatches,
    totalGoals,
  ] = await Promise.all([
    prisma.tournament.count(),
    prisma.team.count({ where: { isActive: true } }),
    prisma.player.count({ where: { isActive: true } }),
    prisma.match.count(),
    prisma.match.count({ where: { status: "COMPLETED" } }),
    prisma.matchEvent.count({ where: { type: "GOAL" } }),
  ]);

  return {
    topScorers: topScorers.map((s) => ({
      count: s._count.type,
      player: topScorerPlayers.find((p) => p.id === s.playerId),
    })),
    topAssists: topAssists.map((s) => ({
      count: s._count.type,
      player: topAssistPlayers.find((p) => p.id === s.playerId),
    })),
    topMOTM: topMOTM.map((s) => ({
      count: s._count.type,
      player: topMOTMPlayers.find((p) => p.id === s.playerId),
    })),
    overall: {
      totalTournaments,
      totalTeams,
      totalPlayers,
      totalMatches,
      completedMatches,
      totalGoals,
    },
  };
}

export default async function StatsPage() {
  const stats = await getStats();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Statistics
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            League Statistics
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Top performers, goal scorers, and league-wide stats across all BWL
            competitions.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Tournaments", value: stats.overall.totalTournaments, icon: Trophy },
            { label: "Teams", value: stats.overall.totalTeams, icon: Users },
            { label: "Players", value: stats.overall.totalPlayers, icon: TrendingUp },
            { label: "Matches", value: stats.overall.totalMatches, icon: Swords },
            { label: "Completed", value: stats.overall.completedMatches, icon: Target },
            { label: "Goals Scored", value: stats.overall.totalGoals, icon: Target },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <stat.icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="scorers" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="scorers">
              <Target className="w-4 h-4 mr-2" />
              Top Scorers
            </TabsTrigger>
            <TabsTrigger value="assists">
              <TrendingUp className="w-4 h-4 mr-2" />
              Top Assists
            </TabsTrigger>
            <TabsTrigger value="motm">
              <Trophy className="w-4 h-4 mr-2" />
              Most MOTM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scorers" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Goal Scorers</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topScorers.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3">
                    {stats.topScorers.map((s, i) =>
                      s.player ? (
                        <Link
                          key={s.player.id}
                          href={`/players/${s.player.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6">
                              {i + 1}
                            </span>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={s.player.photoUrl ?? undefined} />
                              <AvatarFallback className="text-sm">
                                {getInitials(s.player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{s.player.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-green-400" />
                            <span className="text-xl font-bold">{s.count}</span>
                            <span className="text-sm text-muted-foreground">
                              goals
                            </span>
                          </div>
                        </Link>
                      ) : null
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assists" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Assists</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topAssists.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3">
                    {stats.topAssists.map((s, i) =>
                      s.player ? (
                        <Link
                          key={s.player.id}
                          href={`/players/${s.player.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6">
                              {i + 1}
                            </span>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={s.player.photoUrl ?? undefined} />
                              <AvatarFallback className="text-sm">
                                {getInitials(s.player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{s.player.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <span className="text-xl font-bold">{s.count}</span>
                            <span className="text-sm text-muted-foreground">
                              assists
                            </span>
                          </div>
                        </Link>
                      ) : null
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motm" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most Man of the Match</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topMOTM.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3">
                    {stats.topMOTM.map((s, i) =>
                      s.player ? (
                        <Link
                          key={s.player.id}
                          href={`/players/${s.player.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6">
                              {i + 1}
                            </span>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={s.player.photoUrl ?? undefined} />
                              <AvatarFallback className="text-sm">
                                {getInitials(s.player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{s.player.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            <span className="text-xl font-bold">{s.count}</span>
                            <span className="text-sm text-muted-foreground">
                              MOTM
                            </span>
                          </div>
                        </Link>
                      ) : null
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
      <p className="text-muted-foreground">No statistics available yet.</p>
    </div>
  );
}
