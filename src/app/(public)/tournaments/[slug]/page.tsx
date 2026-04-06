export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Calendar,
  Users,
  Swords,
  Award,
  BarChart3,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatDate,
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  formatLabel,
  getInitials,
} from "@/lib/utils";

interface TournamentPageProps {
  params: Promise<{ slug: string }>;
}

async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: {
      teams: {
        include: {
          team: { select: { id: true, slug: true, name: true, logoUrl: true, shortName: true } },
        },
      },
      matches: {
        orderBy: [{ roundNumber: "asc" }, { scheduledAt: "asc" }],
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        },
      },
      standings: {
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
        include: {
          team: { select: { id: true, slug: true, name: true, logoUrl: true } },
        },
      },
      awards: {
        include: {
          player: { select: { id: true, slug: true, name: true, photoUrl: true } },
          team: { select: { id: true, slug: true, name: true, logoUrl: true } },
        },
      },
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

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) notFound();

  const upcomingMatches = tournament.matches.filter((m) => m.status === "SCHEDULED");
  const completedMatches = tournament.matches.filter((m) => m.status === "COMPLETED");

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            All Tournaments
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(
                    tournament.gameCategory as never
                  )}`}
                >
                  {gameLabel(tournament.gameCategory as never)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                    tournament.status as never
                  )}`}
                >
                  {statusLabel(tournament.status as never)}
                </span>
                {tournament.isFeatured && (
                  <Badge variant="secondary" className="text-xs">
                    Featured
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                {tournament.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                {formatLabel(tournament.format as never)} •{" "}
                {tournament.startDate
                  ? formatDate(tournament.startDate)
                  : "Date TBD"}
                {tournament.endDate && ` → ${formatDate(tournament.endDate)}`}
              </p>
            </div>
          </div>

          {tournament.description && (
            <p className="text-muted-foreground mt-4 max-w-3xl">
              {tournament.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 max-w-md">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{tournament.teams.length}</div>
              <div className="text-xs text-muted-foreground">Teams</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{tournament.matches.length}</div>
              <div className="text-xs text-muted-foreground">Matches</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{tournament.awards.length}</div>
              <div className="text-xs text-muted-foreground">Awards</div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="standings">
              <BarChart3 className="w-4 h-4 mr-2" />
              Standings
            </TabsTrigger>
            <TabsTrigger value="matches">
              <Swords className="w-4 h-4 mr-2" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Users className="w-4 h-4 mr-2" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="awards">
              <Award className="w-4 h-4 mr-2" />
              Awards
            </TabsTrigger>
          </TabsList>

          {/* Standings */}
          <TabsContent value="standings" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-yellow-400" />
                  League Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tournament.standings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No standings available yet. Matches need to be played first.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">P</TableHead>
                        <TableHead className="text-center">W</TableHead>
                        <TableHead className="text-center">D</TableHead>
                        <TableHead className="text-center">L</TableHead>
                        <TableHead className="text-center">GF</TableHead>
                        <TableHead className="text-center">GA</TableHead>
                        <TableHead className="text-center">GD</TableHead>
                        <TableHead className="text-center font-bold">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tournament.standings.map((s, i) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{i + 1}</TableCell>
                          <TableCell>
                            <Link
                              href={`/teams/${s.team?.slug}`}
                              className="flex items-center gap-2 hover:text-primary"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={s.team?.logoUrl ?? undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(s.team?.name ?? "")}
                                </AvatarFallback>
                              </Avatar>
                              {s.team?.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">{s.played}</TableCell>
                          <TableCell className="text-center">{s.won}</TableCell>
                          <TableCell className="text-center">{s.drawn}</TableCell>
                          <TableCell className="text-center">{s.lost}</TableCell>
                          <TableCell className="text-center">{s.goalsFor}</TableCell>
                          <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                          <TableCell className="text-center">{s.goalDiff}</TableCell>
                          <TableCell className="text-center font-bold">
                            {s.points}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matches" className="mt-0">
            <div className="space-y-4">
              {upcomingMatches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upcoming Matches</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {completedMatches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {completedMatches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {upcomingMatches.length === 0 && completedMatches.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No matches scheduled for this tournament yet.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Teams */}
          <TabsContent value="teams" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournament.teams.map(({ team }) => (
                <Link key={team.id} href={`/teams/${team.slug}`}>
                  <Card className="hover:border-primary/50 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={team.logoUrl ?? undefined} />
                          <AvatarFallback className="text-sm">
                            {getInitials(team.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{team.name}</p>
                          {team.shortName && (
                            <p className="text-xs text-muted-foreground">
                              {team.shortName}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* Awards */}
          <TabsContent value="awards" className="mt-0">
            {tournament.awards.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No awards have been given for this tournament yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournament.awards.map((award) => (
                  <Card key={award.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 shrink-0">
                          <Award className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {AWARD_TYPE_LABELS[award.type] ?? award.type}
                          </p>
                          {award.customName && (
                            <p className="text-sm text-muted-foreground">
                              {award.customName}
                            </p>
                          )}
                          {(award.player || award.team) && (
                            <div className="mt-2">
                              {award.player && (
                                <Link
                                  href={`/players/${award.player.slug}`}
                                  className="flex items-center gap-2 text-sm hover:text-primary"
                                >
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={award.player.photoUrl ?? undefined} />
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(award.player.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {award.player.name}
                                </Link>
                              )}
                              {award.team && (
                                <Link
                                  href={`/teams/${award.team.slug}`}
                                  className="flex items-center gap-2 text-sm hover:text-primary"
                                >
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={award.team.logoUrl ?? undefined} />
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(award.team.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {award.team.name}
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MatchCard({
  match,
}: {
  match: {
    id: string;
    round: string | null;
    homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
    awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    scheduledAt: Date | null;
  };
}) {
  const isCompleted = match.status === "COMPLETED";

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          {match.round && (
            <span className="text-xs text-muted-foreground">{match.round}</span>
          )}
          {match.scheduledAt && (
            <span className="text-xs text-muted-foreground">
              {formatDateTime(match.scheduledAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={match.homeTeam?.logoUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(match.homeTeam?.name ?? "")}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{match.homeTeam?.name ?? "TBD"}</span>
          </div>
          <div className="text-center min-w-[60px]">
            {isCompleted ? (
              <span className="text-xl font-bold">
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </span>
            ) : (
              <span className="text-muted-foreground">vs</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-medium">{match.awayTeam?.name ?? "TBD"}</span>
            <Avatar className="h-6 w-6">
              <AvatarImage src={match.awayTeam?.logoUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(match.awayTeam?.name ?? "")}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  );
}
