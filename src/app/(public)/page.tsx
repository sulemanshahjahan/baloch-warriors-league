export const revalidate = 300; // 5 minutes

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Trophy, Swords, Users, ChevronRight, Star, Target, Crown, TrendingUp, Crosshair, BarChart3, ShieldCheck, Newspaper, Calendar } from "lucide-react";
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
          eFootballMode: true,
          eFootballType: true,
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
    // Top scorer — combine scoreline goals (authoritative for 1v1) with event-derived
    // goals (used for team football), then take the max per player.
    (async () => {
      const goalsByPlayer = new Map<string, number>();

      // Scoreline goals from 1v1 individual non-PUBG matches
      const playersWithMatches = await prisma.player.findMany({
        select: {
          id: true,
          homeMatches: {
            where: {
              status: "COMPLETED",
              tournament: { participantType: "INDIVIDUAL", gameCategory: { not: "PUBG" } },
            },
            select: { homeScore: true, leg2HomeScore: true, leg3HomeScore: true },
          },
          awayMatches: {
            where: {
              status: "COMPLETED",
              tournament: { participantType: "INDIVIDUAL", gameCategory: { not: "PUBG" } },
            },
            select: { awayScore: true, leg2AwayScore: true, leg3AwayScore: true },
          },
        },
      });
      for (const p of playersWithMatches) {
        let g = 0;
        for (const m of p.homeMatches) g += (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
        for (const m of p.awayMatches) g += (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
        if (g > 0) goalsByPlayer.set(p.id, g);
      }

      // Event-derived goals (team football)
      const eventGoals = await prisma.matchEvent.groupBy({
        by: ["playerId"],
        where: { type: "GOAL", playerId: { not: null } },
        _count: { type: true },
      });
      for (const eg of eventGoals) {
        if (!eg.playerId) continue;
        const existing = goalsByPlayer.get(eg.playerId) ?? 0;
        if (eg._count.type > existing) goalsByPlayer.set(eg.playerId, eg._count.type);
      }

      let topId: string | null = null;
      let topVal = 0;
      for (const [id, val] of goalsByPlayer) {
        if (val > topVal) { topVal = val; topId = id; }
      }
      if (!topId) return null;
      const player = await prisma.player.findUnique({
        where: { id: topId },
        select: { id: true, name: true, slug: true },
      });
      return player ? { ...player, value: topVal, label: "Goals" } : null;
    })(),

    // Best win rate (min 3 matches) — rotates among tied players
    prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, homeMatches: { where: { status: "COMPLETED" }, select: { homeScore: true, awayScore: true, leg2HomeScore: true, leg2AwayScore: true, leg3HomeScore: true, leg3AwayScore: true } }, awayMatches: { where: { status: "COMPLETED" }, select: { homeScore: true, awayScore: true, leg2HomeScore: true, leg2AwayScore: true, leg3HomeScore: true, leg3AwayScore: true } } },
    }).then((players) => {
      let bestRate = 0;
      const candidates: { id: string; name: string; slug: string; value: number; total: number; label: string }[] = [];
      for (const p of players) {
        // Per-fixture: 1 fixture = 1 match, aggregate score across legs determines winner
        let wins = 0, total = 0;
        for (const m of p.homeMatches) {
          const hg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
          const ag = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
          total++;
          if (hg > ag) wins++;
        }
        for (const m of p.awayMatches) {
          const hg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
          const ag = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
          total++;
          if (ag > hg) wins++;
        }
        if (total < 3) continue;
        const rate = Math.round((wins / total) * 100);
        if (rate > bestRate) {
          bestRate = rate;
          candidates.length = 0;
          candidates.push({ id: p.id, name: p.name, slug: p.slug, value: rate, total, label: "Win Rate" });
        } else if (rate === bestRate) {
          candidates.push({ id: p.id, name: p.name, slug: p.slug, value: rate, total, label: "Win Rate" });
        }
      }
      if (candidates.length === 0) return null;
      // Rotate based on current minute so it changes every minute
      return candidates[Math.floor(Date.now() / 60000) % candidates.length];
    }),

    // Biggest ELO jump
    prisma.player.findMany({
      where: { isActive: true, eloRating: { gt: 100 } },
      orderBy: { eloRating: "desc" },
      take: 1,
      select: { id: true, name: true, slug: true, eloRating: true },
    }).then((res) => res[0] ? { ...res[0], value: res[0].eloRating, label: "ELO" } : null),

    // Most clean sheets (each leg where opponent scored 0)
    prisma.player.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, slug: true,
        homeMatches: { where: { status: "COMPLETED" }, select: { awayScore: true, leg2AwayScore: true, leg3AwayScore: true } },
        awayMatches: { where: { status: "COMPLETED" }, select: { homeScore: true, leg2HomeScore: true, leg3HomeScore: true } },
      },
    }).then((players) => {
      let best: { id: string; name: string; slug: string; value: number; label: string } | null = null;
      for (const p of players) {
        // Per-fixture clean sheet: opponent's aggregate across all legs == 0
        let cleanSheets = 0;
        for (const m of p.homeMatches) {
          const opp = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
          if (opp === 0) cleanSheets++;
        }
        for (const m of p.awayMatches) {
          const opp = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
          if (opp === 0) cleanSheets++;
        }
        if (cleanSheets > 0) {
          const strictlyBetter = !best || cleanSheets > best.value;
          // Suleman wins ties for the clean sheets spotlight
          const tiedAndSuleman =
            best && cleanSheets === best.value && p.slug === "suleman";
          if (strictlyBetter || tiedAndSuleman) {
            best = { id: p.id, name: p.name, slug: p.slug, value: cleanSheets, label: "Clean Sheets" };
          }
        }
      }
      return best;
    }),
  ]);

  const mvpStats = [topScorer, topWinRate, biggestEloJump, topRated].filter(Boolean);

  const latestNews = await prisma.newsPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true },
  });

  const playerOfWeek = await prisma.playerOfWeek.findFirst({
    orderBy: { weekStart: "desc" },
    include: { player: { select: { id: true, name: true, slug: true } } },
  });

  // Most recent tournament with a TOURNAMENT_WINNER award assigned
  // (status doesn't matter — having a winner award is the signal)
  const completedTournament = await prisma.tournament.findFirst({
    where: {
      awards: { some: { type: "TOURNAMENT_WINNER" } },
    },
    orderBy: [{ endDate: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      gameCategory: true,
      endDate: true,
      awards: {
        where: {
          type: {
            in: [
              "TOURNAMENT_WINNER",
              "TOURNAMENT_MVP",
              "GOLDEN_BOOT",
              "TOP_ASSISTS",
              "BEST_PLAYER",
              "BEST_GOALKEEPER",
              "FAIR_PLAY",
              "CUSTOM",
            ],
          },
        },
        select: {
          id: true,
          type: true,
          customName: true,
          description: true,
          player: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      },
    },
  });

  const seasonChampion = (() => {
    if (!completedTournament) return null;
    const winnerAward = completedTournament.awards.find(
      (a) => a.type === "TOURNAMENT_WINNER",
    );
    if (!winnerAward) return null;
    return {
      tournament: {
        id: completedTournament.id,
        name: completedTournament.name,
        slug: completedTournament.slug,
        gameCategory: completedTournament.gameCategory,
        endDate: completedTournament.endDate,
      },
      winnerAward,
      otherAwards: completedTournament.awards.filter(
        (a) => a.type !== "TOURNAMENT_WINNER",
      ),
    };
  })();

  return { featuredTournaments, recentResults, upcomingMatches, stats, mvpStats, latestNews, playerOfWeek, seasonChampion };
}

export default async function HomePage() {
  const { featuredTournaments, recentResults, upcomingMatches, stats, mvpStats, latestNews, playerOfWeek, seasonChampion } =
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

      {/* Season Champion Card */}
      {seasonChampion && (() => {
        const w = seasonChampion.winnerAward;
        const winnerName = w.player?.name ?? w.team?.name ?? "Champion";
        const winnerHref = w.player
          ? `/players/${w.player.slug}`
          : w.team
            ? `/teams/${w.team.slug}`
            : `/tournaments/${seasonChampion.tournament.slug}`;
        const awardLabel = (a: { type: string; customName: string | null }) => {
          if (a.type === "CUSTOM") return a.customName ?? "Custom";
          return a.type
            .split("_")
            .map((s) => s[0] + s.slice(1).toLowerCase())
            .join(" ");
        };
        return (
          <section className="relative overflow-hidden border-y border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-yellow-500/10 to-orange-500/10">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 left-1/4 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl" />
            </div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 tracking-[0.2em] uppercase mb-3">
                  <Trophy className="w-4 h-4" />
                  Season Champion
                </div>
                <Link
                  href={`/tournaments/${seasonChampion.tournament.slug}`}
                  className="text-sm text-muted-foreground hover:text-amber-400 transition-colors"
                >
                  {seasonChampion.tournament.name}
                </Link>
              </div>

              <Link
                href={winnerHref}
                className="flex flex-col items-center group"
              >
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative">
                    {w.player ? (
                      <SmartAvatar
                        type="player"
                        id={w.player.id}
                        name={w.player.name}
                        className="h-32 w-32 sm:h-40 sm:w-40 ring-4 ring-amber-400/60"
                        fallbackClassName="text-4xl"
                      />
                    ) : (
                      <SmartAvatar
                        type="team"
                        id={w.team?.id ?? ""}
                        name={winnerName}
                        className="h-32 w-32 sm:h-40 sm:w-40 ring-4 ring-amber-400/60"
                        fallbackClassName="text-4xl"
                      />
                    )}
                    <div className="absolute -top-2 -right-2 text-4xl">🏆</div>
                  </div>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform">
                  {winnerName}
                </h2>
                {w.description && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                    {w.description}
                  </p>
                )}
              </Link>

              {seasonChampion.otherAwards.length > 0 && (
                <div className="mt-10 pt-8 border-t border-amber-500/10">
                  <p className="text-center text-xs font-bold text-muted-foreground tracking-widest uppercase mb-5">
                    Season Honours
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
                    {seasonChampion.otherAwards.map((a) => {
                      const recipientName = a.player?.name ?? a.team?.name ?? "—";
                      const recipientHref = a.player
                        ? `/players/${a.player.slug}`
                        : a.team
                          ? `/teams/${a.team.slug}`
                          : null;
                      const inner = (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:border-amber-500/40 transition-colors h-full">
                          {a.player ? (
                            <SmartAvatar
                              type="player"
                              id={a.player.id}
                              name={a.player.name}
                              className="h-10 w-10 shrink-0"
                              fallbackClassName="text-xs"
                            />
                          ) : a.team ? (
                            <SmartAvatar
                              type="team"
                              id={a.team.id}
                              name={a.team.name}
                              className="h-10 w-10 shrink-0"
                              fallbackClassName="text-xs"
                            />
                          ) : (
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="text-xs">
                                {getInitials(recipientName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="min-w-0 text-left">
                            <p className="text-[10px] font-bold text-amber-400 tracking-wider uppercase truncate">
                              {awardLabel(a)}
                            </p>
                            <p className="text-sm font-semibold truncate">
                              {recipientName}
                            </p>
                          </div>
                        </div>
                      );
                      return recipientHref ? (
                        <Link key={a.id} href={recipientHref}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={a.id}>{inner}</div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* Player of the Week Banner */}
      {playerOfWeek && playerOfWeek.player && (
        <section className="border-b border-border/50 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Link
              href={`/players/${playerOfWeek.player.slug}`}
              className="flex items-center gap-4 group"
            >
              <div className="shrink-0 relative">
                <SmartAvatar
                  type="player"
                  id={playerOfWeek.player.id}
                  name={playerOfWeek.player.name}
                  className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-yellow-400/50"
                  fallbackClassName="text-xl"
                />
                <div className="absolute -top-1 -right-1 text-xl">🌟</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-yellow-400 tracking-widest uppercase mb-1">
                  <Crown className="w-3 h-3" />
                  Player of the Week
                </div>
                <div className="text-lg sm:text-2xl font-black group-hover:text-primary transition-colors truncate">
                  {playerOfWeek.player.name}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground mt-1">
                  <span>⚽ {playerOfWeek.goals} goals</span>
                  <span>🏆 {playerOfWeek.wins} wins</span>
                  <span>🎯 {playerOfWeek.matchesPlayed} matches</span>
                  {playerOfWeek.eloGained !== 0 && (
                    <span className={playerOfWeek.eloGained > 0 ? "text-green-400" : "text-red-400"}>
                      {playerOfWeek.eloGained > 0 ? "+" : ""}{playerOfWeek.eloGained} ELO
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          </div>
        </section>
      )}

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
                        {t.eFootballType && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.eFootballType === "DREAM" ? "bg-purple-500/10 text-purple-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {t.eFootballType === "DREAM" ? "Dream" : "Authentic"}
                          </span>
                        )}
                        {t.eFootballMode === "2v2" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400">
                            2v2
                          </span>
                        )}
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

        {/* Latest News */}
        {latestNews.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-primary" />
                Latest News
              </h2>
              <Link
                href="/news"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                All news <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {latestNews.map((post) => (
                <Link key={post.id} href={`/news/${post.slug}`}>
                  <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {post.publishedAt ? formatDate(post.publishedAt) : ""}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-primary">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
