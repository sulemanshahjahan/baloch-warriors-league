export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Trophy,
  ArrowLeft,
  Calendar,
  MapPin,
  Activity,
  Award,
} from "lucide-react";
import {
  getInitials,
  formatDate,
  gameLabel,
} from "@/lib/utils";

interface PlayerPageProps {
  params: Promise<{ slug: string }>;
}

async function getPlayerBySlug(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      teams: {
        include: { team: { select: { id: true, name: true, slug: true, logoUrl: true } } },
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
    select: { id: true },
  });

  // Combine and deduplicate using Set
  const allMatchIds = new Set([
    ...eventAppearances.map((e) => e.matchId),
    ...individualMatches.map((m) => m.id),
  ]);

  return {
    goals: statsMap["GOAL"] ?? 0,
    assists: statsMap["ASSIST"] ?? 0,
    yellowCards: statsMap["YELLOW_CARD"] ?? 0,
    redCards: statsMap["RED_CARD"] ?? 0,
    motm: statsMap["MOTM"] ?? 0,
    kills: statsMap["KILL"] ?? 0,
    appearances: allMatchIds.size,
  };
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

const EVENT_TYPE_LABELS: Record<string, string> = {
  GOAL: "Goal",
  ASSIST: "Assist",
  YELLOW_CARD: "Yellow Card",
  RED_CARD: "Red Card",
  OWN_GOAL: "Own Goal",
  PENALTY_GOAL: "Penalty Goal",
  PENALTY_MISS: "Penalty Miss",
  CLEAN_SHEET: "Clean Sheet",
  MOTM: "Man of the Match",
  KILL: "Kill",
  FRAME_WIN: "Frame Win",
  MVP: "MVP",
  CUSTOM: "Custom",
};

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);

  if (!player) notFound();

  const stats = await getPlayerStats(player.id);
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

          <div className="flex items-start gap-6 flex-wrap">
            <Avatar className="h-24 w-24">
              <AvatarImage src={player.photoUrl ?? undefined} />
              <AvatarFallback className="text-3xl">
                {getInitials(player.name)}
              </AvatarFallback>
            </Avatar>

            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                {player.name}
              </h1>
              {player.nickname && (
                <p className="text-xl text-muted-foreground">
                  &quot;{player.nickname}&quot;
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {player.position && (
                  <span className="text-sm bg-muted px-2 py-1 rounded">
                    {player.position}
                  </span>
                )}
                {player.nationality && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {player.nationality}
                  </div>
                )}
                {player.dateOfBirth && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {formatDate(player.dateOfBirth)}
                  </div>
                )}
              </div>
              {currentTeam && (
                <div className="mt-3">
                  <Link
                    href={`/teams/${currentTeam.slug}`}
                    className="inline-flex items-center gap-2 text-sm hover:text-primary"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={currentTeam.logoUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(currentTeam.name)}
                      </AvatarFallback>
                    </Avatar>
                    {currentTeam.name}
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
                    { label: "Kills", value: stats.kills },
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

            {/* Recent Activity */}
            {player.matchEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Event</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Tournament</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.matchEvents.map((event) => {
                        const match = event.match;
                        // Determine if player was home or away
                        const isHome = match?.homePlayer?.name === player.name || 
                                      match?.homeTeam?.name === player.name;
                        
                        // Get opponent name (player or team)
                        const opponentName = isHome 
                          ? (match?.awayPlayer?.name ?? match?.awayTeam?.name ?? "Unknown")
                          : (match?.homePlayer?.name ?? match?.homeTeam?.name ?? "Unknown");
                        
                        // Get player's team score and opponent score
                        const playerScore = isHome ? (match?.homeScore ?? 0) : (match?.awayScore ?? 0);
                        const opponentScore = isHome ? (match?.awayScore ?? 0) : (match?.homeScore ?? 0);
                        
                        // Determine result
                        let result = "—";
                        let resultClass = "text-muted-foreground";
                        if (match?.status === "COMPLETED") {
                          if (playerScore > opponentScore) {
                            result = "W";
                            resultClass = "text-green-500 font-bold";
                          } else if (playerScore < opponentScore) {
                            result = "L";
                            resultClass = "text-red-500 font-bold";
                          } else {
                            result = "D";
                            resultClass = "text-yellow-500 font-bold";
                          }
                        }
                        
                        return (
                          <TableRow key={event.id}>
                            <TableCell>
                              <span className="font-medium">
                                {EVENT_TYPE_LABELS[event.type] ?? event.type}
                              </span>
                              {event.minute && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({event.minute}&apos;)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              vs {opponentName}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {playerScore} - {opponentScore}
                            </TableCell>
                            <TableCell className={`text-sm ${resultClass}`}>
                              {result}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {match?.tournament?.name && (
                                <>
                                  {match.tournament.name}
                                  <span className="text-xs ml-1">
                                    ({gameLabel(match.tournament.gameCategory as never)})
                                  </span>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

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
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={team.logoUrl ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(team.name)}
                            </AvatarFallback>
                          </Avatar>
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
          <div>
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
