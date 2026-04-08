export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import {
  Trophy,
  Users,
  User,
  Swords,
  Activity,
  Clock,
  CheckCircle2,
  TrendingUp,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, gameLabel, statusColor, statusLabel } from "@/lib/utils";
import Link from "next/link";
import { requireRole } from "@/lib/auth";

async function getDashboardStats() {
  const [
    totalTournaments,
    activeTournaments,
    totalTeams,
    totalPlayers,
    totalMatches,
    liveMatches,
    totalGoals,
    recentMatches,
    upcomingMatches,
    postponedMatches,
  ] = await Promise.all([
    prisma.tournament.count(),
    prisma.tournament.count({ where: { status: "ACTIVE" } }),
    prisma.team.count({ where: { isActive: true } }),
    prisma.player.count({ where: { isActive: true } }),
    prisma.match.count({ where: { status: "COMPLETED" } }),
    prisma.match.count({ where: { status: "LIVE" } }),
    prisma.matchEvent.count({ where: { type: "GOAL" } }),
    prisma.match.findMany({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: {
        tournament: { select: { name: true, gameCategory: true } },
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
        homePlayer: { select: { name: true } },
        awayPlayer: { select: { name: true } },
      },
    }),
    prisma.match.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: {
        tournament: { select: { name: true, gameCategory: true } },
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
        homePlayer: { select: { name: true } },
        awayPlayer: { select: { name: true } },
      },
    }),
    prisma.match.count({ where: { status: "POSTPONED" } }),
  ]);

  return {
    totalTournaments,
    activeTournaments,
    totalTeams,
    totalPlayers,
    totalMatches,
    liveMatches,
    totalGoals,
    recentMatches,
    upcomingMatches,
    postponedMatches,
  };
}

const statCards = [
  {
    label: "Total Tournaments",
    key: "totalTournaments" as const,
    icon: Trophy,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    href: "/admin/tournaments",
  },
  {
    label: "Active Tournaments",
    key: "activeTournaments" as const,
    icon: Activity,
    color: "text-green-400",
    bg: "bg-green-400/10",
    href: "/admin/tournaments",
  },
  {
    label: "Teams",
    key: "totalTeams" as const,
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    href: "/admin/teams",
  },
  {
    label: "Players",
    key: "totalPlayers" as const,
    icon: User,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    href: "/admin/players",
  },
  {
    label: "Matches Played",
    key: "totalMatches" as const,
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    href: "/admin/matches",
  },
  {
    label: "Total Goals",
    key: "totalGoals" as const,
    icon: TrendingUp,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    href: "/admin/matches",
  },
];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("EDITOR");
  const { error } = await searchParams;
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Dashboard"
        description="Overview of BWL activity"
      />

      <main className="flex-1 p-6 space-y-6">
        {error === "forbidden" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            You don&apos;t have permission to access that page.
          </div>
        )}

        {/* Live match alert */}
        {stats.liveMatches > 0 && (
          <Link href="/admin/matches">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/15 transition-colors">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
              {stats.liveMatches} match{stats.liveMatches !== 1 ? "es" : ""} currently LIVE — click to manage
            </div>
          </Link>
        )}
        {stats.postponedMatches > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
            <span className="font-medium">{stats.postponedMatches} postponed match{stats.postponedMatches !== 1 ? "es" : ""}</span>
            <span className="text-yellow-400/70">need rescheduling</span>
            <Link href="/admin/matches" className="ml-auto text-yellow-400 hover:underline text-xs">View →</Link>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <Link key={card.key} href={card.href}>
              <Card className="hover:border-border/80 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {stats[card.key]}
                      </p>
                    </div>
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-xl ${card.bg}`}
                    >
                      <card.icon className={`w-6 h-6 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Results */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Recent Results
                </CardTitle>
                <Link
                  href="/admin/matches?status=COMPLETED"
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recentMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No completed matches yet.
                </p>
              ) : (
                stats.recentMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/admin/matches/${match.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {match.tournament.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor("COMPLETED")}`}
                        >
                          FT
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">
                          {match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD"}
                        </span>
                        <span className="text-muted-foreground shrink-0">vs</span>
                        <span className="truncate">
                          {match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-lg font-bold">
                        {match.homeScore ?? 0} – {match.awayScore ?? 0}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Upcoming Fixtures */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Upcoming Fixtures
                </CardTitle>
                <Link
                  href="/admin/matches?status=SCHEDULED"
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.upcomingMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming fixtures scheduled.
                </p>
              ) : (
                stats.upcomingMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/admin/matches/${match.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {match.tournament.name}
                        </span>
                        <Badge variant="info" className="text-xs shrink-0">
                          {gameLabel(match.tournament.gameCategory)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {match.homeTeam?.name ?? "TBD"} vs{" "}
                        {match.awayTeam?.name ?? "TBD"}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-muted-foreground">
                        {match.scheduledAt
                          ? formatDate(match.scheduledAt)
                          : "Date TBD"}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "New Tournament", href: "/admin/tournaments/new", icon: Trophy, color: "text-yellow-400" },
                { label: "New Team", href: "/admin/teams/new", icon: Users, color: "text-blue-400" },
                { label: "New Player", href: "/admin/players/new", icon: User, color: "text-purple-400" },
                { label: "New Match", href: "/admin/matches/new", icon: Swords, color: "text-orange-400" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-all text-center"
                >
                  <action.icon className={`w-6 h-6 ${action.color}`} />
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
