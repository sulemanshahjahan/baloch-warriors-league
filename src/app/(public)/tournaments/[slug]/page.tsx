import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const revalidate = 30;
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
  GitBranch,
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

type FormResult = "W" | "D" | "L";

interface MatchForForm {
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
}

interface TournamentPageProps {
  params: Promise<{ slug: string }>;
}

function computeForm(
  participantId: string,
  matches: MatchForForm[],
  isIndividual: boolean
): FormResult[] {
  const results: FormResult[] = [];
  
  for (const match of matches) {
    if (results.length >= 5) break;
    
    const homeId = isIndividual ? match.homePlayerId : match.homeTeamId;
    const awayId = isIndividual ? match.awayPlayerId : match.awayTeamId;
    
    if (!homeId || !awayId) continue;
    if (match.homeScore === null || match.awayScore === null) continue;
    
    const isHome = homeId === participantId;
    const isAway = awayId === participantId;
    
    if (!isHome && !isAway) continue;
    
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;
    
    if (homeScore === awayScore) {
      results.push("D");
    } else if (isHome) {
      results.push(homeScore > awayScore ? "W" : "L");
    } else {
      results.push(awayScore > homeScore ? "W" : "L");
    }
  }
  
  return results;
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

  // Fetch groups with standings (essential fields only)
  const groups = await prisma.tournamentGroup.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      standings: {
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
        select: {
          id: true,
          played: true,
          won: true,
          drawn: true,
          lost: true,
          goalsFor: true,
          goalsAgainst: true,
          goalDiff: true,
          points: true,
          teamId: true,
          playerId: true,
          team: { select: { id: true, slug: true, name: true, logoUrl: true } },
          player: { select: { id: true, slug: true, name: true, photoUrl: true } },
        },
      },
    },
  });

  // Fetch all matches for display and bracket
  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
    select: {
      id: true,
      round: true,
      roundNumber: true,
      matchNumber: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      homePlayer: { select: { id: true, name: true, photoUrl: true } },
      awayPlayer: { select: { id: true, name: true, photoUrl: true } },
    },
  });

  const awards = await prisma.award.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      type: true,
      customName: true,
      player: { select: { id: true, name: true, slug: true, photoUrl: true } },
      team: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  });

  // Fetch teams with minimal data
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: tournament.id },
    select: {
      team: { select: { id: true, slug: true, name: true, shortName: true, logoUrl: true } },
    },
  });

  // Fetch players with minimal data
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id },
    select: {
      player: { select: { id: true, slug: true, name: true, photoUrl: true } },
    },
  });

  // Fetch overall standings (no group filter, essential fields only)
  const standings = await prisma.standing.findMany({
    where: { tournamentId: tournament.id, groupId: null },
    orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
    select: {
      id: true,
      played: true,
      won: true,
      drawn: true,
      lost: true,
      goalsFor: true,
      goalsAgainst: true,
      goalDiff: true,
      points: true,
      teamId: true,
      playerId: true,
      team: { select: { id: true, slug: true, name: true, logoUrl: true } },
      player: { select: { id: true, slug: true, name: true, photoUrl: true } },
    },
  });

  // Fetch completed matches for form calculation (last 20 to cover all participants)
  const formMatches = await prisma.match.findMany({
    where: { tournamentId: tournament.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      homeScore: true,
      awayScore: true,
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
    },
  });

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
    standings,
    formMatches,
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
  
  // Check if tournament has knockout format
  const hasKnockoutFormat = tournament.format === "KNOCKOUT" || tournament.format === "GROUP_KNOCKOUT";
  
  // Get knockout matches for bracket
  const knockoutMatches = tournament.matches.filter((m) => 
    m.roundNumber !== null && m.roundNumber > 0
  );
  
  // Group matches by round
  const matchesByRound = knockoutMatches.reduce((acc, match) => {
    const round = match.roundNumber ?? 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, typeof knockoutMatches>);
  
  // Sort rounds
  const sortedRounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

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
          <TabsList className={`bg-muted/50 w-full grid h-auto ${hasKnockoutFormat ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <TabsTrigger value="standings" className="text-xs sm:text-sm py-2">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Standings</span>
              <span className="sm:hidden">Table</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs sm:text-sm py-2">
              <Swords className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Matches
            </TabsTrigger>
            {hasKnockoutFormat && (
              <TabsTrigger value="bracket" className="text-xs sm:text-sm py-2">
                <GitBranch className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Bracket
              </TabsTrigger>
            )}
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
            {/* Group Standings */}
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
                      {group.standings.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          No standings available for this group yet.
                        </p>
                      ) : (
                        <StandingsTable 
                          standings={group.standings} 
                          participantType={tournament.participantType}
                          formMatches={tournament.formMatches}
                        />
                      )}
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
                {tournament.standings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No standings available yet. Matches need to be played first.
                  </p>
                ) : (
                  <StandingsTable 
                    standings={tournament.standings}
                    participantType={tournament.participantType}
                    formMatches={tournament.formMatches}
                  />
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

          {/* Bracket - only for KNOCKOUT and GROUP_KNOCKOUT formats */}
          {hasKnockoutFormat && (
            <TabsContent value="bracket" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    Knockout Bracket
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sortedRounds.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Bracket will be available once knockout stage matches are scheduled.
                    </p>
                  ) : (
                    <BracketView
                      rounds={sortedRounds}
                      matchesByRound={matchesByRound}
                      participantType={tournament.participantType}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

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
                            <AvatarImage src={(player as any).photoUrl ?? undefined} />
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
                            <AvatarImage src={(team as any).logoUrl ?? undefined} />
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
                {tournament.awards.map((award) => {
                  const winner = (award as any).player ?? (award as any).team ?? null;
                  const winnerSlug = (award as any).player
                    ? `/players/${(award as any).player.slug}`
                    : (award as any).team
                    ? `/teams/${(award as any).team.slug}`
                    : null;
                  const winnerPhoto = (award as any).player?.photoUrl ?? (award as any).team?.logoUrl ?? null;
                  return (
                    <Card key={award.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 shrink-0">
                            <Award className="w-5 h-5 text-yellow-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">
                              {AWARD_TYPE_LABELS[award.type] ?? award.type}
                            </p>
                            {award.customName && (
                              <p className="text-xs text-muted-foreground">{award.customName}</p>
                            )}
                            {winner && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={winnerPhoto ?? undefined} />
                                  <AvatarFallback className="text-[8px]">
                                    {getInitials(winner.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {winnerSlug ? (
                                  <Link href={winnerSlug} className="text-xs font-semibold text-primary hover:underline">
                                    {winner.name}
                                  </Link>
                                ) : (
                                  <span className="text-xs font-semibold">{winner.name}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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


function FormBadge({ result }: { result: FormResult }) {
  const colors = {
    W: "bg-green-500",
    D: "bg-yellow-500",
    L: "bg-red-500",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white rounded-full ${colors[result]}`}
      title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
    >
      {result}
    </span>
  );
}

// Standings Table Component
function StandingsTable({
  standings,
  participantType,
  formMatches,
}: {
  standings: Array<{
    id: string;
    teamId: string | null;
    playerId: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    team: { id: string; slug: string; name: string; logoUrl?: string | null } | null;
    player: { id: string; slug: string; name: string; photoUrl?: string | null } | null;
  }>;
  participantType: string;
  formMatches: MatchForForm[];
}) {
  const isIndividual = participantType === "INDIVIDUAL";
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-10">#</TableHead>
          <TableHead>{isIndividual ? "Player" : "Team"}</TableHead>
          <TableHead className="text-center">P</TableHead>
          <TableHead className="text-center">W</TableHead>
          <TableHead className="text-center">D</TableHead>
          <TableHead className="text-center">L</TableHead>
          <TableHead className="text-center hidden sm:table-cell">GF</TableHead>
          <TableHead className="text-center hidden sm:table-cell">GA</TableHead>
          <TableHead className="text-center">GD</TableHead>
          <TableHead className="text-center font-bold">Pts</TableHead>
          <TableHead className="text-center w-[120px]">Form</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => {
          const name = isIndividual ? s.player?.name : s.team?.name;
          const photo = isIndividual ? s.player?.photoUrl : s.team?.logoUrl;
          const href = isIndividual
            ? `/players/${s.player?.slug}`
            : `/teams/${s.team?.slug}`;
          const participantId = isIndividual ? s.playerId : s.teamId;
          const form = participantId ? computeForm(participantId, formMatches, isIndividual) : [];
          return (
            <TableRow key={s.id}>
              <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <Link href={href} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={photo ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(name ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-center">{s.played}</TableCell>
              <TableCell className="text-center text-green-400">{s.won}</TableCell>
              <TableCell className="text-center text-muted-foreground">{s.drawn}</TableCell>
              <TableCell className="text-center text-red-400">{s.lost}</TableCell>
              <TableCell className="text-center hidden sm:table-cell">{s.goalsFor}</TableCell>
              <TableCell className="text-center hidden sm:table-cell">{s.goalsAgainst}</TableCell>
              <TableCell className={`text-center ${s.goalDiff > 0 ? "text-green-400" : s.goalDiff < 0 ? "text-red-400" : ""}`}>
                {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
              </TableCell>
              <TableCell className="text-center font-bold">{s.points}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {form.length > 0 ? (
                    form.map((r, idx) => <FormBadge key={idx} result={r} />)
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface BracketMatch {
  id: string;
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  status: string;
  scheduledAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
  homePlayer: { id: string; name: string; photoUrl: string | null } | null;
  awayPlayer: { id: string; name: string; photoUrl: string | null } | null;
}

function BracketView({
  rounds,
  matchesByRound,
  participantType,
}: {
  rounds: number[];
  matchesByRound: Record<number, BracketMatch[]>;
  participantType: string;
}) {
  const isIndividual = participantType === "INDIVIDUAL";
  
  // Round name mapping
  const getRoundName = (roundNum: number, totalRounds: number) => {
    const roundNames: Record<number, string> = {
      1: "Final",
      2: "Semi-finals",
      3: "Quarter-finals",
      4: "Round of 16",
      5: "Round of 32",
      6: "Round of 64",
    };
    
    // Calculate from the end if we know total rounds
    const fromFinal = totalRounds - roundNum + 1;
    if (fromFinal <= 6 && roundNames[fromFinal]) {
      return roundNames[fromFinal];
    }
    return `Round ${roundNum}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 min-w-max px-4">
        {rounds.map((roundNum, roundIndex) => (
          <div key={roundNum} className="flex flex-col">
            <h3 className="text-sm font-semibold text-center mb-4 text-muted-foreground">
              {getRoundName(roundNum, rounds.length)}
            </h3>
            <div 
              className="flex flex-col justify-center gap-4"
              style={{ 
                minHeight: `${Math.max(120, matchesByRound[roundNum].length * 100)}px` 
              }}
            >
              {matchesByRound[roundNum].map((match, matchIndex) => {
                const isFirstRound = roundIndex === 0;
                const isLastRound = roundIndex === rounds.length - 1;
                
                return (
                  <div 
                    key={match.id} 
                    className="relative"
                    style={{
                      marginTop: roundIndex > 0 ? `${Math.pow(2, roundIndex - 1) * 20}px` : 0,
                      marginBottom: roundIndex > 0 ? `${Math.pow(2, roundIndex - 1) * 20}px` : 0,
                    }}
                  >
                    {/* Connector lines */}
                    {!isFirstRound && (
                      <div className="absolute right-full top-1/2 w-4 h-px bg-border" />
                    )}
                    {!isLastRound && matchIndex % 2 === 0 && (
                      <>
                        <div className="absolute left-full top-1/2 w-4 h-px bg-border" />
                        <div className="absolute left-[calc(100%+1rem)] top-1/2 w-px bg-border"
                          style={{
                            height: `${50 + Math.pow(2, roundIndex) * 20}px`,
                            transform: 'translateY(-50%)'
                          }}
                        />
                      </>
                    )}
                    
                    <BracketMatchCard 
                      match={match} 
                      isIndividual={isIndividual}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  isIndividual,
}: {
  match: BracketMatch;
  isIndividual: boolean;
}) {
  const isCompleted = match.status === "COMPLETED";
  
  const homeName = isIndividual
    ? (match.homePlayer?.name ?? "TBD")
    : (match.homeTeam?.name ?? "TBD");
  const awayName = isIndividual
    ? (match.awayPlayer?.name ?? "TBD")
    : (match.awayTeam?.name ?? "TBD");
  const homeImg = isIndividual
    ? (match.homePlayer?.photoUrl ?? undefined)
    : (match.homeTeam?.logoUrl ?? undefined);
  const awayImg = isIndividual
    ? (match.awayPlayer?.photoUrl ?? undefined)
    : (match.awayTeam?.logoUrl ?? undefined);
  
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  const homeWon = isCompleted && homeScore > awayScore;
  const awayWon = isCompleted && awayScore > homeScore;

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="w-48 bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
        {/* Round/Status header */}
        <div className="px-2 py-1 bg-muted/50 text-[10px] text-muted-foreground flex justify-between">
          <span>{match.round || "Match"}</span>
          {match.scheduledAt && (
            <span>{formatDate(match.scheduledAt)}</span>
          )}
        </div>
        
        {/* Home participant */}
        <div className={`px-3 py-2 flex items-center justify-between gap-2 border-b border-border/50 ${homeWon ? 'bg-primary/5' : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={homeImg} />
              <AvatarFallback className="text-[8px]">
                {getInitials(homeName)}
              </AvatarFallback>
            </Avatar>
            <span className={`text-xs truncate ${homeWon ? 'font-semibold' : ''}`}>
              {homeName}
            </span>
          </div>
          {isCompleted && (
            <span className={`text-sm font-bold ${homeWon ? 'text-primary' : 'text-muted-foreground'}`}>
              {homeScore}
            </span>
          )}
        </div>
        
        {/* Away participant */}
        <div className={`px-3 py-2 flex items-center justify-between gap-2 ${awayWon ? 'bg-primary/5' : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={awayImg} />
              <AvatarFallback className="text-[8px]">
                {getInitials(awayName)}
              </AvatarFallback>
            </Avatar>
            <span className={`text-xs truncate ${awayWon ? 'font-semibold' : ''}`}>
              {awayName}
            </span>
          </div>
          {isCompleted && (
            <span className={`text-sm font-bold ${awayWon ? 'text-primary' : 'text-muted-foreground'}`}>
              {awayScore}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
