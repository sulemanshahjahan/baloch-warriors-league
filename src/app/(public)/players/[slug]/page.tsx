import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

// Use ISR instead of full SSG to avoid DB connection pool exhaustion
export const revalidate = 300;
export const dynamicParams = true;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/public/smart-avatar";
import {
  User,
  Trophy,
  ArrowLeft,
  Calendar,
  MapPin,
  Activity,
  Award,
  Swords,
  BarChart3,
} from "lucide-react";
import { PlayerCard } from "@/components/public/player-card";
import {
  getInitials,
  formatDate,
} from "@/lib/utils";

interface PlayerPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = await prisma.player.findUnique({ where: { slug }, select: { name: true, bio: true } });
  if (!player) return { title: "Player Not Found" };
  return {
    title: player.name,
    description: player.bio ?? `View ${player.name}'s stats, match history, and career in BWL.`,
    openGraph: {
      title: `${player.name} | BWL`,
      description: player.bio ?? `${player.name}'s profile and statistics in the Baloch Warriors League.`,
      type: "profile",
    },
  };
}

async function getPlayerBySlug(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      teams: {
        include: { team: { select: { id: true, name: true, slug: true } } },
        orderBy: { joinedAt: "desc" },
      },
      matchEvents: {
        include: {
          match: {
            include: {
              tournament: { select: { name: true, gameCategory: true } },
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              homePlayer: { select: { name: true } },
              awayPlayer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      awards: {
        include: {
          tournament: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function getPlayerStats(playerId: string) {
  const events = await prisma.matchEvent.groupBy({
    by: ["type"],
    where: { playerId },
    _count: { type: true },
  });

  const statsMap: Record<string, number> = {};
  for (const e of events) {
    statsMap[e.type] = e._count.type;
  }

  // Get all match IDs where player has events
  const eventAppearances = await prisma.matchEvent.findMany({
    where: { playerId, match: { status: "COMPLETED" } },
    select: { matchId: true },
    distinct: ["matchId"],
  });

  // Get all match IDs where player participated as home/away player (eFootball 1v1)
  const individualMatches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
    },
    select: { id: true, homePlayerId: true, homeScore: true, awayScore: true },
  });

  // Combine and deduplicate using Set
  const allMatchIds = new Set([
    ...eventAppearances.map((e) => e.matchId),
    ...individualMatches.map((m) => m.id),
  ]);

  // Average player rating from CUSTOM events with description "PLAYER_RATING"
  const ratingEvents = await prisma.matchEvent.findMany({
    where: { playerId, type: "CUSTOM", description: "PLAYER_RATING", value: { not: null } },
    select: { value: true },
  });
  const avgRating = ratingEvents.length > 0
    ? Math.round((ratingEvents.reduce((sum, e) => sum + (e.value ?? 0), 0) / ratingEvents.length) * 10) / 10
    : null;

  // Count wins
  let wins = 0;
  for (const m of individualMatches) {
    const isHome = m.homePlayerId === playerId;
    const myScore = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const oppScore = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    if (myScore > oppScore) wins++;
  }

  return {
    wins,
    goals: statsMap["GOAL"] ?? 0,
    assists: statsMap["ASSIST"] ?? 0,
    yellowCards: statsMap["YELLOW_CARD"] ?? 0,
    redCards: statsMap["RED_CARD"] ?? 0,
    motm: statsMap["MOTM"] ?? 0,
    kills: statsMap["KILL"] ?? 0,
    appearances: allMatchIds.size,
    avgRating,
    ratingCount: ratingEvents.length,
  };
}

async function getPlayerRecentMatches(playerId: string) {
  return prisma.match.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
    },
    orderBy: { completedAt: "desc" },
    take: 5,
    include: {
      tournament: { select: { name: true, slug: true, gameCategory: true } },
      homePlayer: { select: { id: true, name: true, slug: true } },
      awayPlayer: { select: { id: true, name: true, slug: true } },
      homeTeam: { select: { id: true, name: true, slug: true } },
      awayTeam: { select: { id: true, name: true, slug: true } },
    },
  });
}

const AWARD_TYPE_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Golden Boot",
  TOP_ASSISTS: "Top Assists",
  BEST_PLAYER: "Best Player",
  BEST_GOALKEEPER: "Best Goalkeeper",
  FAIR_PLAY: "Fair Play",
  TOURNAMENT_MVP: "Tournament MVP",
  TOURNAMENT_WINNER: "Tournament Winner",
  CUSTOM: "Custom",
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);

  if (!player) notFound();

  const [stats, recentMatches] = await Promise.all([
    getPlayerStats(player.id),
    getPlayerRecentMatches(player.id),
  ]);
  const currentTeam = player.teams.find((t) => !t.leftAt)?.team;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/players"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            All Players
          </Link>

          <div className="flex items-start gap-4">
            <SmartAvatar
              type="player"
              id={player.id}
              name={player.name}
              className="h-20 w-20 sm:h-24 sm:w-24 shrink-0"
              fallbackClassName="text-2xl sm:text-3xl"
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {player.name}
              </h1>
              {player.nickname && (
                <p className="text-base sm:text-lg text-muted-foreground truncate">
                  &quot;{player.nickname}&quot;
                </p>
              )}
              {player.suspendedUntil && new Date(player.suspendedUntil) > new Date() && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 font-medium mt-1">
                  🚫 Suspended until {formatDate(player.suspendedUntil)}
                  {player.suspensionReason && ` — ${player.suspensionReason}`}
                </span>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {player.position && (
                  <span className="text-xs sm:text-sm bg-muted px-2 py-0.5 rounded">
                    {player.position}
                  </span>
                )}
                {player.skillLevel !== null && player.skillLevel !== undefined && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm">
                    <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                    <span className="font-medium">{player.skillLevel}</span>
                    <span className="text-muted-foreground">lvl</span>
                  </div>
                )}
                {player.eloRating !== 100 && (
                  <Link href="/rankings" className="flex items-center gap-1 text-xs sm:text-sm hover:text-primary transition-colors">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                    <span className="font-bold">{player.eloRating}</span>
                    <span className="text-muted-foreground">ELO</span>
                  </Link>
                )}
                {player.nationality && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                    {player.nationality}
                  </div>
                )}
                {player.dateOfBirth && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    {formatDate(player.dateOfBirth)}
                  </div>
                )}
              </div>
              {currentTeam && (
                <div className="mt-2">
                  <Link
                    href={`/teams/${currentTeam.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm hover:text-primary"
                  >
                    <SmartAvatar
                      type="team"
                      id={currentTeam.id}
                      name={currentTeam.name}
                      className="h-4 w-4 sm:h-5 sm:w-5"
                      fallbackClassName="text-[8px]"
                    />
                    <span className="truncate">{currentTeam.name}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player Card */}
            <PlayerCard
              name={player.name}
              position={player.position ?? ""}
              rating={player.skillLevel ?? 50}
              nationality={player.nationality ?? ""}
              avatarUrl={player.photoUrl || `/api/image?type=player&id=${player.id}&_=${Date.now()}`}
              playerId={player.id}
              stats={{
                goals: stats.goals,
                wins: stats.wins,
                matches: stats.appearances,
                motm: stats.motm,
              }}
            />

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  Career Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Appearances", value: stats.appearances },
                    { label: "Goals", value: stats.goals },
                    { label: "Assists", value: stats.assists },
                    { label: "MOTM", value: stats.motm },
                    { label: "Yellow Cards", value: stats.yellowCards },
                    { label: "Red Cards", value: stats.redCards },
                    ...(stats.kills > 0 ? [{ label: "Kills", value: stats.kills }] : []),
                    ...(stats.avgRating !== null ? [{ label: `Avg Rating (${stats.ratingCount})`, value: stats.avgRating }] : []),
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-4 rounded-lg bg-muted/50 text-center"
                    >
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Matches */}
            {recentMatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-orange-400" />
                    Recent Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentMatches.map((match) => {
                      const isHome = match.homePlayer?.name === player.name || match.homeTeam?.name === player.name;
                      const opponent = isHome 
                        ? (match.awayPlayer ?? match.awayTeam)
                        : (match.homePlayer ?? match.homeTeam);
                      const playerScore = isHome ? match.homeScore : match.awayScore;
                      const opponentScore = isHome ? match.awayScore : match.homeScore;
                      
                      let result = "D";
                      let resultColor = "bg-yellow-500/20 text-yellow-500";
                      if (playerScore! > opponentScore!) {
                        result = "W";
                        resultColor = "bg-green-500/20 text-green-500";
                      } else if (playerScore! < opponentScore!) {
                        result = "L";
                        resultColor = "bg-red-500/20 text-red-500";
                      }

                      const opponentId = isHome 
                        ? (match.awayPlayer?.id ?? match.awayTeam?.id)
                        : (match.homePlayer?.id ?? match.homeTeam?.id);
                      const opponentType = match.awayPlayer || match.homePlayer ? "player" : "team";

                      return (
                        <Link
                          key={match.id}
                          href={`/tournaments/${match.tournament.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {opponentId ? (
                              <SmartAvatar
                                type={opponentType}
                                id={opponentId}
                                name={(opponent as { name: string } | null)?.name ?? "?"}
                                className="h-8 w-8"
                                fallbackClassName="text-xs"
                              />
                            ) : (
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials((opponent as { name: string } | null)?.name ?? "?")}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div>
                              <p className="font-medium text-sm">
                                vs {(opponent as { name: string } | null)?.name ?? "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {match.tournament.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono font-medium">
                              {playerScore} - {opponentScore}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${resultColor}`}>
                              {result}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Head to Head links */}
            {recentMatches.length > 0 && (() => {
              const opponents = new Map<string, { name: string; slug: string; id: string }>();
              for (const m of recentMatches) {
                const isHome = m.homePlayer?.id === player.id;
                const opp = isHome ? m.awayPlayer : m.homePlayer;
                if (opp && !opponents.has(opp.id)) {
                  opponents.set(opp.id, opp);
                }
              }
              if (opponents.size === 0) return null;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Swords className="w-4 h-4 text-red-400" />
                      Head to Head
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Match History links */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Match History</p>
                      <div className="flex flex-wrap gap-2">
                        {[...opponents.values()].map((opp) => (
                          <Link
                            key={opp.id}
                            href={`/players/${player.slug}/h2h/${opp.slug}`}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                          >
                            <SmartAvatar type="player" id={opp.id} name={opp.name} className="h-6 w-6" fallbackClassName="text-[9px]" />
                            <span className="font-medium">vs {opp.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Compare Stats links */}
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Compare Stats Side-by-Side</p>
                      <div className="flex flex-wrap gap-2">
                        {[...opponents.values()].map((opp) => (
                          <Link
                            key={opp.id}
                            href={`/players/compare?p1=${player.slug}&p2=${opp.slug}`}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-sm text-primary"
                          >
                            <span>📊</span>
                            <span className="font-medium">{opp.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Team History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Team History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player.teams.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No team history available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {player.teams.map(({ team, joinedAt, leftAt }) => (
                      <Link
                        key={team.id}
                        href={`/teams/${team.slug}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <SmartAvatar
                            type="team"
                            id={team.id}
                            name={team.name}
                            className="h-8 w-8"
                            fallbackClassName="text-xs"
                          />
                          <div>
                            <p className="font-medium">{team.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(joinedAt)} -{" "}
                              {leftAt ? formatDate(leftAt) : "Present"}
                            </p>
                          </div>
                        </div>
                        {!leftAt && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                            Current
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {player.bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{player.bio}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  Awards ({player.awards.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player.awards.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No awards yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {player.awards.map((award) => (
                      <div
                        key={award.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 shrink-0">
                          <Award className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {AWARD_TYPE_LABELS[award.type] ?? award.type}
                          </p>
                          {award.description && (
                            <p className="text-xs text-muted-foreground">{award.description}</p>
                          )}
                          {award.tournament && (
                            <Link
                              href={`/tournaments/${award.tournament.slug}`}
                              className="text-xs text-muted-foreground hover:text-primary"
                            >
                              {award.tournament.name}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

