import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

// Generate static pages for all tournaments at build time
export async function generateStaticParams() {
  const tournaments = await prisma.tournament.findMany({
    select: { slug: true },
  });
  
  return tournaments.map((t) => ({
    slug: t.slug,
  }));
}
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

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return { title: "Tournament Not Found" };
  return {
    title: t.name,
    description: t.description ?? `View fixtures, standings, and stats for ${t.name}.`,
    openGraph: {
      title: `${t.name} | BWL`,
      description: t.description ?? `Tournament details, fixtures, and standings for ${t.name}.`,
      images: t.bannerUrl ? [{ url: t.bannerUrl }] : [],
      type: "website",
    },
  };
}

async function getTournamentBySlug(slug: string) {
  // Fetch only essential tournament info
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      gameCategory: true,
      format: true,
      status: true,
      startDate: true,
      endDate: true,
      bannerUrl: true,
      participantType: true,
      isFeatured: true,
    },
  });

  if (!tournament) return null;

  // Fetch only counts - no heavy data
  const [teamCount, playerCount, matchCount, groupCount, awardCount] = await Promise.all([
    prisma.tournamentTeam.count({ where: { tournamentId: tournament.id } }),
    prisma.tournamentPlayer.count({ where: { tournamentId: tournament.id } }),
    prisma.match.count({ where: { tournamentId: tournament.id } }),
    prisma.tournamentGroup.count({ where: { tournamentId: tournament.id } }),
    prisma.award.count({ where: { tournamentId: tournament.id } }),
  ]);

  // Fetch only group names - no standings (will load client-side)
  const groups = await prisma.tournamentGroup.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  // Fetch only RECENT matches (limit to 10)
  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { scheduledAt: "desc" },
    take: 10,
    select: {
      id: true,
      round: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { id: true, name: true, shortName: true } },
      awayTeam: { select: { id: true, name: true, shortName: true } },
      homePlayer: { select: { id: true, name: true } },
      awayPlayer: { select: { id: true, name: true } },
    },
  });

  // Fetch only award types - no player/team details
  const awards = await prisma.award.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      type: true,
      customName: true,
    },
  });

  // Fetch teams with minimal data
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: tournament.id },
    select: {
      team: { select: { id: true, slug: true, name: true, shortName: true } },
    },
  });

  // Fetch players with minimal data
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id },
    select: {
      player: { select: { id: true, slug: true, name: true } },
    },
  });

  // No overall standings - will be fetched client-side

  return {
    ...tournament,
    _count: {
      teams: teamCount,
      players: playerCount,
      matches: matchCount,
      groups: groupCount,
      awards: awardCount,
    },
    groups,
    matches,
    awards,
    teams,
    players,
    standings: [], // Empty - will be fetched client-side
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
            <Link
              href={`/tournaments/${slug}/stats`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <BarChart3 className="w-4 h-4" />
              View Stats
            </Link>
          </div>

          {tournament.description && (
            <p className="text-muted-foreground mt-4 max-w-3xl">
              {tournament.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 max-w-md">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {tournament.participantType === "INDIVIDUAL" 
                  ? tournament.players.length 
                  : tournament.teams.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {tournament.participantType === "INDIVIDUAL" ? "Players" : "Teams"}
              </div>
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
          <TabsList className="bg-muted/50 w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="standings" className="text-xs sm:text-sm py-2">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Standings</span>
              <span className="sm:hidden">Table</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs sm:text-sm py-2">
              <Swords className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-xs sm:text-sm py-2">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {tournament.participantType === "INDIVIDUAL" ? "Players" : "Teams"}
            </TabsTrigger>
            <TabsTrigger value="awards" className="text-xs sm:text-sm py-2">
              <Award className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Awards
            </TabsTrigger>
          </TabsList>

          {/* Standings */}
          <TabsContent value="standings" className="mt-0 space-y-6">
            {/* Group Standings - Loaded client-side */}
            {tournament.groups.length > 0 && (
              <>
                {tournament.groups.map((group) => (
                  <Card key={group.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-yellow-400" />
                        {group.name} Standings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-center py-4">
                        Standings will be loaded dynamically.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {/* Overall League Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-yellow-400" />
                  {tournament.groups.length > 0 ? "Overall League Table" : "League Table"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Standings will be loaded dynamically.
                </p>
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

          {/* Participants (Teams or Individual Players) */}
          <TabsContent value="participants" className="mt-0">
            {tournament.participantType === "INDIVIDUAL" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournament.players.map(({ player }) => (
                  <Link key={player.id} href={`/players/${player.slug}`}>
                    <Card className="hover:border-primary/50 transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm">
                              {getInitials(player.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{player.name}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournament.teams.map(({ team }) => (
                  <Link key={team.id} href={`/teams/${team.slug}`}>
                    <Card className="hover:border-primary/50 transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
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
            )}
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
    homeTeam: { id: string; name: string; shortName: string | null; logoUrl?: string | null } | null;
    awayTeam: { id: string; name: string; shortName: string | null; logoUrl?: string | null } | null;
    homePlayer: { id: string; name: string; slug?: string; photoUrl?: string | null } | null;
    awayPlayer: { id: string; name: string; slug?: string; photoUrl?: string | null } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    scheduledAt: Date | null;
  };
}) {
  const isCompleted = match.status === "COMPLETED";
  const isPlayerMatch = !!match.homePlayer || !!match.awayPlayer;

  const homeName = isPlayerMatch
    ? (match.homePlayer?.name ?? "TBD")
    : (match.homeTeam?.name ?? "TBD");
  const awayName = isPlayerMatch
    ? (match.awayPlayer?.name ?? "TBD")
    : (match.awayTeam?.name ?? "TBD");
  const homeImg = isPlayerMatch
    ? (match.homePlayer?.photoUrl ?? undefined)
    : (match.homeTeam?.logoUrl ?? undefined);
  const awayImg = isPlayerMatch
    ? (match.awayPlayer?.photoUrl ?? undefined)
    : (match.awayTeam?.logoUrl ?? undefined);

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
              <AvatarImage src={homeImg} />
              <AvatarFallback className="text-[10px]">
                {getInitials(homeName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{homeName}</span>
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
            <span className="font-medium">{awayName}</span>
            <Avatar className="h-6 w-6">
              <AvatarImage src={awayImg} />
              <AvatarFallback className="text-[10px]">
                {getInitials(awayName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  );
}
