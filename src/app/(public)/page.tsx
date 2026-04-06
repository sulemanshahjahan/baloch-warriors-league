export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Trophy, Swords, Users, ChevronRight, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDate,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
} from "@/lib/utils";

async function getHomeData() {
  const [featuredTournaments, recentResults, upcomingMatches, stats] =
    await Promise.all([
      prisma.tournament.findMany({
        where: { status: { in: ["ACTIVE", "UPCOMING"] } },
        orderBy: [{ isFeatured: "desc" }, { startDate: "asc" }],
        take: 4,
        include: {
          _count: { select: { teams: true, matches: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 5,
        include: {
          tournament: { select: { name: true, gameCategory: true } },
          homeTeam: { select: { name: true, shortName: true, logoUrl: true } },
          awayTeam: { select: { name: true, shortName: true, logoUrl: true } },
          motmPlayer: { select: { name: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: {
          tournament: { select: { name: true, gameCategory: true } },
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      }),
      Promise.all([
        prisma.tournament.count(),
        prisma.team.count({ where: { isActive: true } }),
        prisma.player.count({ where: { isActive: true } }),
        prisma.match.count({ where: { status: "COMPLETED" } }),
      ]).then(([tournaments, teams, players, matches]) => ({
        tournaments,
        teams,
        players,
        matches,
      })),
    ]);

  return { featuredTournaments, recentResults, upcomingMatches, stats };
}

export default async function HomePage() {
  const { featuredTournaments, recentResults, upcomingMatches, stats } =
    await getHomeData();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bwl-hero pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Text Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
                <span className="text-sm font-semibold text-primary tracking-widest uppercase">
                  Baloch Warriors League
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-none">
                Where{" "}
                <span className="text-primary">Warriors</span>
                <br />
                Compete
              </h1>

              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
                The official platform of BWL — tracking every tournament, match,
                goal, and record across Football, eFootball, PUBG, Snooker, and
                Checkers.
              </p>

              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <Link
                  href="/tournaments"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  View Tournaments
                </Link>
                <Link
                  href="/matches"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-secondary/80 transition-colors border border-border"
                >
                  <Swords className="w-4 h-4" />
                  Recent Results
                </Link>
              </div>
            </div>

            {/* Right: Logo */}
            <div className="flex-shrink-0">
              <Image
                src="/logo.png"
                alt="BWL Baloch Warriors League"
                width={280}
                height={280}
                className="rounded-2xl object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { label: "Tournaments", value: stats.tournaments, icon: Trophy },
              { label: "Teams", value: stats.teams, icon: Users },
              { label: "Players", value: stats.players, icon: Users },
              { label: "Matches Played", value: stats.matches, icon: Swords },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-black text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Active / Upcoming Tournaments */}
        {featuredTournaments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Tournaments</h2>
              <Link
                href="/tournaments"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredTournaments.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.slug}`}>
                  <Card className="hover:border-border/80 transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                    {t.bannerUrl && (
                      <div className="h-32 overflow-hidden rounded-t-lg">
                        <img
                          src={t.bannerUrl}
                          alt={t.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(t.gameCategory)}`}
                        >
                          {gameLabel(t.gameCategory)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                        {t.name}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{(t as any)._count.teams} teams</span>
                        <span>{t._count.matches} matches</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Results */}
          {recentResults.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">Recent Results</h2>
                <Link
                  href="/matches"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  All matches <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentResults.map((match) => (
                  <Card key={match.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(match.tournament.gameCategory)}`}
                        >
                          {gameLabel(match.tournament.gameCategory)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {match.tournament.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1 text-right">
                          <p className="font-semibold text-sm">
                            {match.homeTeam?.shortName ?? match.homeTeam?.name}
                          </p>
                        </div>
                        <div className="text-center px-4 shrink-0">
                          <span className="text-2xl font-black">
                            {match.homeScore ?? 0}
                            <span className="text-muted-foreground mx-1 font-light text-lg">
                              –
                            </span>
                            {match.awayScore ?? 0}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-sm">
                            {match.awayTeam?.shortName ?? match.awayTeam?.name}
                          </p>
                        </div>
                      </div>

                      {match.motmPlayer && (
                        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-accent">
                          <Star className="w-3 h-3 fill-current" />
                          MOTM: {match.motmPlayer.name}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming Fixtures */}
          {upcomingMatches.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">Upcoming</h2>
                <Link
                  href="/matches?status=SCHEDULED"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  See all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {upcomingMatches.map((match) => (
                  <Card key={match.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(match.tournament.gameCategory)}`}
                        >
                          {gameLabel(match.tournament.gameCategory)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {match.tournament.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm flex-1 text-right">
                          {match.homeTeam?.name ?? "TBD"}
                        </p>
                        <span className="text-xs text-muted-foreground px-3 shrink-0">
                          vs
                        </span>
                        <p className="font-semibold text-sm flex-1">
                          {match.awayTeam?.name ?? "TBD"}
                        </p>
                      </div>
                      {match.scheduledAt && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          {formatDate(match.scheduledAt)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
