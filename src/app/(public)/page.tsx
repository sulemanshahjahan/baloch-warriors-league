export const revalidate = 300; // 5 minutes

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Trophy, Swords, Users, ChevronRight, Star, Target, Crown, TrendingUp, Crosshair, BarChart3, ShieldCheck } from "lucide-react";
import { DownloadAppButton } from "@/components/public/download-app-button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  formatDate,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  getInitials,
  getRoundDisplayName,
} from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";

async function getHomeData() {
  const [featuredTournaments, recentResults, upcomingMatches, stats] =
    await Promise.all([
      prisma.tournament.findMany({
        where: { status: { in: ["ACTIVE", "UPCOMING"] } },
        orderBy: [{ isFeatured: "desc" }, { startDate: "asc" }],
        take: 4,
        select: {
          id: true,
          name: true,
          slug: true,
          gameCategory: true,
          status: true,
          isFeatured: true,
          participantType: true,
          // bannerUrl intentionally omitted — base64 stored images would bloat ISR payload
          _count: { select: { teams: true, players: true, matches: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: {
          id: true,
          round: true,
          roundNumber: true,
          matchNumber: true,
          homeScore: true,
          awayScore: true,
          homeScorePens: true,
          awayScorePens: true,
          tournament: { select: { name: true, gameCategory: true } },
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
          homePlayer: { select: { id: true, name: true } },
          awayPlayer: { select: { id: true, name: true } },
          motmPlayer: { select: { id: true, name: true } },
        },
      }),
      prisma.match.findMany({
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        select: {
          id: true,
          round: true,
          roundNumber: true,
          matchNumber: true,
          scheduledAt: true,
          tournament: { select: { name: true, gameCategory: true } },
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          homePlayer: { select: { id: true, name: true } },
          awayPlayer: { select: { id: true, name: true } },
        },
      }),
      prisma.$transaction([
        prisma.tournament.count(),
        prisma.player.count({ where: { isActive: true } }),
        prisma.match.count({ where: { status: "COMPLETED" } }),
        prisma.matchEvent.count({ where: { type: "GOAL" } }),
      ]).then(([tournaments, players, matches, goals]) => ({
        tournaments,
        players,
        matches,
        goals,
      })),
    ]);

  // MVP stats — top performers across all data
  const [topScorer, topWinRate, biggestEloJump, topRated] = await Promise.all([
    // Top scorer
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "GOAL", playerId: { not: null } },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 1,
    }).then(async (res) => {
      if (!res[0]?.playerId) return null;
      const player = await prisma.player.findUnique({
        where: { id: res[0].playerId },
        select: { name: true, slug: true, id: true },
      });
      return player ? { ...player, value: res[0]._count.type, label: "Goals" } : null;
    }),

    // Best win rate (min 3 matches)
    prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, homeMatches: { where: { status: "COMPLETED" }, select: { homeScore: true, awayScore: true } }, awayMatches: { where: { status: "COMPLETED" }, select: { homeScore: true, awayScore: true } } },
    }).then((players) => {
      let best: { id: string; name: string; slug: string; value: number; total: number; label: string } | null = null;
      for (const p of players) {
        let wins = 0, total = 0;
        for (const m of p.homeMatches) { total++; if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) wins++; }
        for (const m of p.awayMatches) { total++; if ((m.awayScore ?? 0) > (m.homeScore ?? 0)) wins++; }
        if (total < 3) continue;
        const rate = Math.round((wins / total) * 100);
        if (!best || rate > best.value) best = { id: p.id, name: p.name, slug: p.slug, value: rate, total, label: "Win Rate" };
      }
      return best;
    }),

    // Biggest ELO jump
    prisma.player.findMany({
      where: { isActive: true, eloRating: { gt: 100 } },
      orderBy: { eloRating: "desc" },
      take: 1,
      select: { id: true, name: true, slug: true, eloRating: true },
    }).then((res) => res[0] ? { ...res[0], value: res[0].eloRating, label: "ELO" } : null),

    // Most clean sheets (matches where opponent scored 0)
    prisma.player.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, slug: true,
        homeMatches: { where: { status: "COMPLETED" }, select: { awayScore: true } },
        awayMatches: { where: { status: "COMPLETED" }, select: { homeScore: true } },
      },
    }).then((players) => {
      let best: { id: string; name: string; slug: string; value: number; label: string } | null = null;
      for (const p of players) {
        let cleanSheets = 0;
        for (const m of p.homeMatches) { if ((m.awayScore ?? 0) === 0) cleanSheets++; }
        for (const m of p.awayMatches) { if ((m.homeScore ?? 0) === 0) cleanSheets++; }
        if (cleanSheets > 0 && (!best || cleanSheets > best.value)) {
          best = { id: p.id, name: p.name, slug: p.slug, value: cleanSheets, label: "Clean Sheets" };
        }
      }
      return best;
    }),
  ]);

  const mvpStats = [topScorer, topWinRate, biggestEloJump, topRated].filter(Boolean);

  return { featuredTournaments, recentResults, upcomingMatches, stats, mvpStats };
}

export default async function HomePage() {
  const { featuredTournaments, recentResults, upcomingMatches, stats, mvpStats } =
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

              {/* Download App Banner */}
              <DownloadAppButton variant="hero" />
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
              { label: "Players", value: stats.players, icon: Users },
              { label: "Matches Played", value: stats.matches, icon: Swords },
              { label: "Goals Scored", value: stats.goals, icon: Target },
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

      {/* MVP Area */}
      {mvpStats.length > 0 && (
        <section className="border-b border-border/50 bg-card/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold">Top Performers</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {mvpStats.map((mvp) => {
                if (!mvp) return null;
                const icon = mvp.label === "Goals" ? <Crosshair className="w-4 h-4 text-primary" />
                  : mvp.label === "Win Rate" ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                  : mvp.label === "ELO" ? <BarChart3 className="w-4 h-4 text-blue-400" />
                  : mvp.label === "Clean Sheets" ? <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  : <Star className="w-4 h-4 text-amber-400" />;

                return (
                  <Link key={mvp.label} href={`/players/${mvp.slug}`}>
                    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-center">
                      <SmartAvatar
                        type="player"
                        id={mvp.id}
                        name={mvp.name}
                        className="h-14 w-14"
                        fallbackClassName="text-lg"
                      />
                      <div>
                        <p className="font-semibold text-sm">{mvp.name}</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {icon}
                          <span className="text-lg font-black">{mvp.value}{mvp.label === "Win Rate" ? "%" : ""}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{mvp.label}{(mvp as { total?: number }).total ? ` (${(mvp as { total?: number }).total} matches)` : ""}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
                        <span>
                          {t.participantType === "INDIVIDUAL"
                            ? `${t._count.players} players`
                            : `${t._count.teams} teams`}
                        </span>
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
                {recentResults.map((match) => {
                  const homeName = match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD";
                  const awayName = match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD";
                  const homeId = match.homePlayer?.id ?? match.homeTeam?.id;
                  const awayId = match.awayPlayer?.id ?? match.awayTeam?.id;
                  const homeType = match.homePlayer ? "player" : "team";
                  const awayType = match.awayPlayer ? "player" : "team";
                  return (
                    <Link key={match.id} href={`/matches/${match.id}`}>
                      <Card className="overflow-hidden hover:border-border/80 transition-colors">
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
                          {match.round && (
                            <div className="text-center mb-2">
                              <span className="text-sm font-semibold text-primary">
                                {getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <p className="font-semibold text-sm text-right truncate">{homeName}</p>
                              {homeId ? (
                                <SmartAvatar type={homeType as "player" | "team"} id={homeId} name={homeName} className="h-8 w-8 shrink-0" fallbackClassName="text-[10px]" />
                              ) : (
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarFallback className="text-[10px]">{getInitials(homeName)}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                            <div className="text-center px-2 shrink-0">
                              <span className="text-2xl font-black">
                                {match.homeScore ?? 0}
                                <span className="text-muted-foreground mx-1 font-light text-lg">–</span>
                                {match.awayScore ?? 0}
                              </span>
                              {match.homeScorePens != null && match.awayScorePens != null && (
                                <p className="text-[10px] text-muted-foreground">({match.homeScorePens}–{match.awayScorePens} pens)</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                              {awayId ? (
                                <SmartAvatar type={awayType as "player" | "team"} id={awayId} name={awayName} className="h-8 w-8 shrink-0" fallbackClassName="text-[10px]" />
                              ) : (
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarFallback className="text-[10px]">{getInitials(awayName)}</AvatarFallback>
                                </Avatar>
                              )}
                              <p className="font-semibold text-sm truncate">{awayName}</p>
                            </div>
                          </div>

                          {match.motmPlayer && (
                            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-accent">
                              <Star className="w-3 h-3 fill-current" />
                              MOTM: {match.motmPlayer.name}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
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
                {upcomingMatches.map((match) => {
                  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
                  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
                  const homeId = match.homePlayer?.id ?? match.homeTeam?.id;
                  const awayId = match.awayPlayer?.id ?? match.awayTeam?.id;
                  const homeType = match.homePlayer ? "player" : "team";
                  const awayType = match.awayPlayer ? "player" : "team";
                  return (
                    <Link key={match.id} href={`/matches/${match.id}`}>
                      <Card className="hover:border-border/80 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(match.tournament.gameCategory)}`}
                            >
                              {gameLabel(match.tournament.gameCategory)}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {match.tournament.name}
                            </span>
                          </div>
                          {match.round && (
                            <div className="text-center mb-1">
                              <span className="text-sm font-semibold text-primary">
                                {getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <p className="font-semibold text-sm text-right truncate">{homeName}</p>
                              {homeId ? (
                                <SmartAvatar type={homeType as "player" | "team"} id={homeId} name={homeName} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                              ) : (
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarFallback className="text-[10px]">{getInitials(homeName)}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground px-2 shrink-0">vs</span>
                            <div className="flex items-center gap-2 flex-1">
                              {awayId ? (
                                <SmartAvatar type={awayType as "player" | "team"} id={awayId} name={awayName} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                              ) : (
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarFallback className="text-[10px]">{getInitials(awayName)}</AvatarFallback>
                                </Avatar>
                              )}
                              <p className="font-semibold text-sm truncate">{awayName}</p>
                            </div>
                          </div>
                          {match.scheduledAt && (
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              {formatDate(match.scheduledAt)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
