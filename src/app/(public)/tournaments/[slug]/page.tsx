export const revalidate = 60; // ISR — regenerate at most once per minute

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from "@/components/public/url-tabs";
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
import dynamic from "next/dynamic";

const BracketVisualization = dynamic(
  () => import("@/components/public/bracket-view").then((m) => m.BracketVisualization),
  { loading: () => <div className="h-64 animate-pulse bg-muted/50 rounded-lg" /> }
);
import { DrawReplayButton } from "@/components/public/draw-replay";
import { PlayerFixturesShare } from "@/components/public/player-fixtures-share";
import {
  formatDate,
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  formatLabel,
  getInitials,
  getRoundDisplayName,
} from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";

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
  const t = await prisma.tournament.findUnique({
    where: { slug },
    select: { name: true, description: true, bannerUrl: true },
  });
  if (!t) return { title: "Tournament Not Found" };
  
  // Only use bannerUrl for OG if it's an external URL (not base64)
  const ogImage = t.bannerUrl?.startsWith("http") ? [{ url: t.bannerUrl }] : [];
  
  return {
    title: t.name,
    description: t.description ?? `View fixtures, standings, and stats for ${t.name}.`,
    openGraph: {
      title: `${t.name} | BWL`,
      description: t.description ?? `Tournament details, fixtures, and standings for ${t.name}.`,
      images: ogImage,
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
      // bannerUrl intentionally omitted — base64 stored images bloat ISR payload
      participantType: true,
      isFeatured: true,
      prizeInfo: true,
      rules: true,
    },
  });

  if (!tournament) return null;

  const tid = tournament.id;

  // ALL queries in parallel — reduced from 8 to 6 queries
  // (formMatches and latestMOTM derived from main matches query)
  const [groups, matches, awards, teams, players, standings] = await Promise.all([
    prisma.tournamentGroup.findMany({
    where: { tournamentId: tid },
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
          team: { select: { id: true, slug: true, name: true } },
          player: { select: { id: true, slug: true, name: true } },
        },
      },
      players: {
        select: {
          id: true,
          // photoUrl is now a Cloudinary URL (~80 bytes) — safe to include in HTML.
          // SmartAvatar uses it directly; browser hits Cloudinary CDN.
          player: { select: { id: true, name: true, slug: true, photoUrl: true } },
        },
      },
    },
  }),
    // Matches
    prisma.match.findMany({
    where: { tournamentId: tid },
    orderBy: [{ roundNumber: "desc" }, { matchNumber: "asc" }],
    select: {
      id: true,
      round: true,
      roundNumber: true,
      matchNumber: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeScorePens: true,
      awayScorePens: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
      leg3HomePens: true,
      leg3AwayPens: true,
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeTeam: { select: { id: true, name: true, shortName: true } },
      awayTeam: { select: { id: true, name: true, shortName: true } },
      homePlayer: { select: { id: true, name: true } },
      awayPlayer: { select: { id: true, name: true } },
      completedAt: true,
      motmPlayerId: true,
      motmPlayer: { select: { id: true, name: true, slug: true } },
      _count: { select: { participants: true } },
    },
  }),
    // Awards
    prisma.award.findMany({
    where: { tournamentId: tid },
    select: {
      id: true,
      type: true,
      customName: true,
      description: true,
      player: { select: { id: true, name: true, slug: true } },
      team: { select: { id: true, name: true, slug: true } },
    },
  }),
    // Teams
    prisma.tournamentTeam.findMany({
    where: { tournamentId: tid },
    select: {
      team: { select: { id: true, slug: true, name: true, shortName: true } },
    },
  }),
    // Players
    prisma.tournamentPlayer.findMany({
    where: { tournamentId: tid },
    select: {
      player: { select: { id: true, slug: true, name: true } },
    },
  }),
    // Overall standings
    prisma.standing.findMany({
    where: { tournamentId: tid, groupId: null },
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
      team: { select: { id: true, slug: true, name: true } },
      player: { select: { id: true, slug: true, name: true } },
    },
  }),
  ]);

  // Derive formMatches from main matches query (avoids extra DB query)
  const formMatches = matches
    .filter((m) => m.status === "COMPLETED" && m.completedAt)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20)
    .map((m) => ({
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homePlayerId: m.homePlayerId,
      awayPlayerId: m.awayPlayerId,
    }));

  // Derive latestMOTM from main matches query (avoids extra DB query)
  const motmMatch = matches.find(
    (m) => m.status === "COMPLETED" && m.motmPlayerId && m.motmPlayer
  );
  const latestMOTM = motmMatch
    ? {
        round: motmMatch.round,
        motmPlayer: motmMatch.motmPlayer,
        homePlayer: motmMatch.homePlayer,
        awayPlayer: motmMatch.awayPlayer,
        homeTeam: motmMatch.homeTeam,
        awayTeam: motmMatch.awayTeam,
      }
    : null;

  return {
    ...tournament,
    _count: {
      teams: teams.length,
      players: players.length,
      matches: matches.length,
      groups: groups.length,
      awards: awards.length,
    },
    groups,
    matches: matches.map((m) => ({ ...m, participants: [], notes: null })),
    awards,
    teams,
    latestMOTM,
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

  // Sort matches properly: Knockout first (Final -> Semi -> etc.), then Group rounds
  const sortedMatches = [...tournament.matches].sort((a, b) => {
    const aIsKnockout = a.round && !/Group\s+[A-Z]/i.test(a.round);
    const bIsKnockout = b.round && !/Group\s+[A-Z]/i.test(b.round);
    
    // Knockout matches come first
    if (aIsKnockout && !bIsKnockout) return -1;
    if (!aIsKnockout && bIsKnockout) return 1;
    
    // Both knockout: sort by roundNumber desc (Final=2 before Semi=1)
    if (aIsKnockout && bIsKnockout) {
      return (b.roundNumber || 0) - (a.roundNumber || 0);
    }
    
    // Both group: sort by group name then round number
    const aGroup = a.round?.match(/Group\s+([A-Z])/i)?.[1] || "";
    const bGroup = b.round?.match(/Group\s+([A-Z])/i)?.[1] || "";
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    return (a.roundNumber || 0) - (b.roundNumber || 0);
  });

  const upcomingMatches = sortedMatches.filter((m) => m.status === "SCHEDULED");
  const completedMatches = sortedMatches.filter((m) => m.status === "COMPLETED");
  
  // Check if tournament has knockout format
  const hasKnockoutFormat = tournament.format === "KNOCKOUT" || tournament.format === "GROUP_KNOCKOUT";
  
  // Get knockout matches for bracket (exclude group stage matches)
  const knockoutMatches = tournament.matches.filter((m) => {
    // Must have a round number
    if (m.roundNumber === null || m.roundNumber <= 0) return false;
    // Exclude group stage matches (round contains "Group X" pattern)
    const roundName = (m.round || "").toLowerCase();
    // Exclude if it matches "group a", "group b", etc. pattern
    if (/group\s+[a-z]/.test(roundName)) return false;
    return true;
  });
  
  // Group matches by round
  const matchesByRound = knockoutMatches.reduce((acc, match) => {
    const round = match.roundNumber ?? 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, typeof knockoutMatches>);
  
  // Sort rounds in descending order so Final is rightmost, early rounds leftmost
  const sortedRounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);
  
  // Check if we have actual knockout data
  const hasKnockoutData = sortedRounds.length > 0 && knockoutMatches.length > 0;

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
                    tournament.gameCategory
                  )}`}
                >
                  {gameLabel(tournament.gameCategory)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                    tournament.status
                  )}`}
                >
                  {statusLabel(tournament.status)}
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
                {formatLabel(tournament.format)} •{" "}
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

          {/* Prize Info */}
          {tournament.prizeInfo && (
            <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 max-w-2xl">
              <Trophy className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">{tournament.prizeInfo}</p>
            </div>
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
        {/* Latest MOTM highlight */}
        {tournament.latestMOTM?.motmPlayer && (
          <Link
            href={`/players/${tournament.latestMOTM.motmPlayer.slug}`}
            className="flex items-center gap-3 p-3 mb-6 rounded-lg bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/15 transition-colors"
          >
            <SmartAvatar type="player" id={tournament.latestMOTM.motmPlayer.id} name={tournament.latestMOTM.motmPlayer.name} className="h-10 w-10" fallbackClassName="text-sm" />
            <div>
              <p className="text-sm font-semibold">
                ⭐ {tournament.latestMOTM.motmPlayer.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Man of the Match
                {tournament.latestMOTM.round && ` — ${tournament.latestMOTM.round}`}
              </p>
            </div>
          </Link>
        )}

        {/* Draw Replay + Recap buttons */}
        {tournament.groups.length >= 2 && (
          <div className="flex items-center gap-3 mb-6">
            {tournament.groups.some((g) => (g as any).players?.length > 0) && (
              <DrawReplayButton
                groups={tournament.groups.map((g) => ({
                  id: g.id,
                  name: g.name,
                  players: (g as any).players?.map((tp: any) => ({
                    id: tp.player?.id ?? tp.id,
                    name: tp.player?.name ?? tp.name ?? "?",
                    photoUrl: tp.player?.photoUrl ?? null,
                  })) ?? [],
                }))}
              />
            )}
            <Link
              href={`/tournaments/${tournament.slug}/recap`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
            >
              <Trophy className="w-4 h-4 text-primary" />
              Tournament Recap
            </Link>
          </div>
        )}

        <UrlTabs defaultValue="standings" className="space-y-6">
          <TabsList className={`bg-muted/50 w-full grid h-auto ${hasKnockoutFormat ? (tournament.rules ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5') : (tournament.rules ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}`}>
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
            {tournament.rules && (
              <TabsTrigger value="rules" className="text-xs sm:text-sm py-2">
                <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Rules
              </TabsTrigger>
            )}
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
                      {group.standings.length > 0 ? (
                        <StandingsTable
                          standings={group.standings}
                          participantType={tournament.participantType}
                          gameCategory={tournament.gameCategory}
                          formMatches={tournament.formMatches}
                        />
                      ) : (group as any).players?.length > 0 ? (
                        <div className="space-y-2">
                          {(group as any).players.map((tp: any, i: number) => {
                            const name = tp.player?.name ?? "?";
                            const playerId = tp.player?.id;
                            const slug = tp.player?.slug;
                            return (
                              <div key={tp.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                <span className="text-sm font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                                {playerId && (
                                  <SmartAvatar type="player" id={playerId} name={name} className="h-7 w-7" fallbackClassName="text-[10px]" />
                                )}
                                {slug ? (
                                  <Link href={`/players/${slug}`} className="text-sm font-medium hover:text-primary">{name}</Link>
                                ) : (
                                  <span className="text-sm font-medium">{name}</span>
                                )}
                              </div>
                            );
                          })}
                          <p className="text-xs text-muted-foreground text-center pt-2">No matches played yet</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No players in this group yet.
                        </p>
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
                    gameCategory={tournament.gameCategory}
                    formMatches={tournament.formMatches}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matches" className="mt-0">
            <div className="space-y-4">
              {/* Share Fixtures per player */}
              {tournament.matches.length > 0 && (
                <PlayerFixturesShare
                  tournamentName={tournament.name}
                  matches={tournament.matches as any}
                  players={tournament.players?.map((tp: any) => ({
                    id: tp.player?.id ?? tp.id,
                    name: tp.player?.name ?? "?",
                  })) ?? []}
                  participantType={tournament.participantType}
                />
              )}

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
                  {!hasKnockoutData ? (
                    <div className="text-center py-12 space-y-4">
                      <GitBranch className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
                      <div className="space-y-2">
                        <p className="text-muted-foreground">
                          Knockout matches have not been scheduled yet.
                        </p>
                        <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                          Once the group stage is complete, knockout matches (Quarter-finals, Semi-finals, Final) 
                          will be created and displayed here.
                        </p>
                      </div>
                      <div className="pt-4">
                        <p className="text-xs text-muted-foreground/50">
                          Group stage: {tournament.matches.filter(m => (m.round || "").match(/Group\s+[A-Z]/i)).length} matches played
                        </p>
                      </div>
                    </div>
                  ) : (
                    <BracketVisualization
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
                          <SmartAvatar type="player" id={player.id} name={player.name} className="h-10 w-10" fallbackClassName="text-sm" />
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
                          <SmartAvatar type="team" id={team.id} name={team.name} className="h-10 w-10" fallbackClassName="text-sm" />
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
                  const winner = award.player ?? award.team ?? null;
                  const winnerSlug = award.player
                    ? `/players/${award.player.slug}`
                    : award.team
                    ? `/teams/${award.team.slug}`
                    : null;
                  const winnerId = award.player?.id ?? award.team?.id;
                  const winnerType = award.player ? "player" : "team";
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
                            {award.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{award.description}</p>
                            )}
                            {winner && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {winnerId ? (
                                  <SmartAvatar type={winnerType as "player" | "team"} id={winnerId} name={winner.name} className="h-5 w-5" fallbackClassName="text-[8px]" />
                                ) : (
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[8px]">{getInitials(winner.name)}</AvatarFallback>
                                  </Avatar>
                                )}
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

          {/* Rules */}
          {tournament.rules && (
            <TabsContent value="rules" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    Tournament Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert prose-sm max-w-none">
                    {tournament.rules.split("\n").map((line, i) =>
                      line.trim() === "" ? (
                        <br key={i} />
                      ) : (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">
                          {line}
                        </p>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </UrlTabs>
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
    roundNumber: number | null;
    matchNumber: number | null;
    notes: string | null;
    homeTeam: { id: string; name: string; shortName: string | null } | null;
    awayTeam: { id: string; name: string; shortName: string | null } | null;
    homePlayer: { id: string; name: string; slug?: string } | null;
    awayPlayer: { id: string; name: string; slug?: string } | null;
    homeScore: number | null;
    awayScore: number | null;
    homeScorePens: number | null;
    awayScorePens: number | null;
    status: string;
    scheduledAt: Date | null;
    _count: { participants: number };
    participants: Array<{
      id: string;
      placement: number | null;
      score: number | null;
      player: { id: string; name: string } | null;
      team: { id: string; name: string } | null;
    }>;
  };
}) {
  const isCompleted = match.status === "COMPLETED";
  const isBattleRoyale =
    !match.homeTeam && !match.awayTeam && !match.homePlayer && !match.awayPlayer;

  if (isBattleRoyale) {
    const count = match._count.participants;

    // Parse scoring config for kill back-calculation
    let ppk = 1;
    let placementPts: { placement: number; points: number }[] = [];
    try {
      const cfg = JSON.parse(match.notes || "{}");
      ppk = cfg.pointsPerKill || 1;
      placementPts = cfg.placementPoints || [];
    } catch { /* defaults */ }
    const getPlacePts = (pl: number) => placementPts.find((p) => p.placement === pl)?.points ?? 0;

    // Top 3 by score for completed matches
    const top3 = isCompleted
      ? [...match.participants]
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 3)
          .map((p) => {
            const placePts = getPlacePts(p.placement ?? 99);
            const kills = Math.max(0, Math.round(((p.score ?? 0) - placePts) / ppk));
            return { ...p, kills };
          })
      : [];

    const PODIUM_COLORS = [
      "text-yellow-400",   // 1st
      "text-gray-400",     // 2nd
      "text-orange-400",   // 3rd
    ];

    return (
      <div className="p-4 rounded-lg bg-muted/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          {match.round ? (
            <span className="text-sm font-semibold text-primary">
              {getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-lg">🎮</span>
            <span>{count > 0 ? `${count} Players` : "Battle Royale"}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isCompleted ? "bg-green-500/20 text-green-400" :
              match.status === "LIVE" ? "bg-red-500/20 text-red-400 animate-pulse" :
              "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? "Completed" : match.status === "LIVE" ? "Live" : "Upcoming"}
            </span>
          </div>
        </div>

        {/* Top 3 podium for completed matches */}
        {isCompleted && top3.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {top3.map((p, i) => {
              const name = p.player?.name ?? p.team?.name ?? "?";
              const id = p.player?.id ?? p.team?.id;
              const type = p.player ? "player" : "team";
              return (
                <div key={p.id} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-card/60 border border-border/40">
                  {/* Rank */}
                  <span className={`text-xs font-bold ${PODIUM_COLORS[i]}`}>#{p.placement}</span>
                  {/* Avatar */}
                  {id ? (
                    <SmartAvatar type={type as "player" | "team"} id={id} name={name} className="h-9 w-9" fallbackClassName="text-[10px]" />
                  ) : (
                    <Avatar className="h-9 w-9"><AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback></Avatar>
                  )}
                  {/* Name */}
                  <p className="text-[11px] font-medium truncate w-full text-center">{name}</p>
                  {/* Stats */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">💀 {p.kills}</span>
                    <span className="flex items-center gap-0.5 font-semibold text-foreground">{p.score ?? 0}pt</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Date */}
        {match.scheduledAt && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            {formatDateTime(match.scheduledAt)}
          </p>
        )}
      </div>
    );
  }

  const isPlayerMatch = !!match.homePlayer || !!match.awayPlayer;

  const homeName = isPlayerMatch
    ? (match.homePlayer?.name ?? "TBD")
    : (match.homeTeam?.name ?? "TBD");
  const awayName = isPlayerMatch
    ? (match.awayPlayer?.name ?? "TBD")
    : (match.awayTeam?.name ?? "TBD");

  const homeId = isPlayerMatch ? match.homePlayer?.id : match.homeTeam?.id;
  const awayId = isPlayerMatch ? match.awayPlayer?.id : match.awayTeam?.id;
  const homeType = isPlayerMatch ? "player" : "team";
  const awayType = isPlayerMatch ? "player" : "team";

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
      <div className="flex-1">
        {/* Round label - centered above score */}
        {match.round && (
          <div className="text-center mb-2">
            <span className="text-sm font-semibold text-primary">{getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {homeId ? (
              <SmartAvatar type={homeType as "player" | "team"} id={homeId} name={homeName} className="h-6 w-6" fallbackClassName="text-[10px]" />
            ) : (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{getInitials(homeName)}</AvatarFallback>
              </Avatar>
            )}
            <span className="font-medium">{homeName}</span>
          </div>
          <div className="text-center min-w-[60px]">
            {isCompleted ? (
              <div>
                <span className="text-xl font-bold">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
                {match.homeScorePens != null && match.awayScorePens != null && (
                  <p className="text-[10px] text-muted-foreground">({match.homeScorePens}–{match.awayScorePens} pens)</p>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">vs</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-medium">{awayName}</span>
            {awayId ? (
              <SmartAvatar type={awayType as "player" | "team"} id={awayId} name={awayName} className="h-6 w-6" fallbackClassName="text-[10px]" />
            ) : (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{getInitials(awayName)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
        {/* Date below score */}
        {match.scheduledAt && (
          <div className="text-center mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDateTime(match.scheduledAt)}
            </span>
          </div>
        )}
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
  gameCategory,
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
    team: { id: string; slug: string; name: string } | null;
    player: { id: string; slug: string; name: string } | null;
  }>;
  participantType: string;
  gameCategory: string;
  formMatches: MatchForForm[];
}) {
  const isIndividual = participantType === "INDIVIDUAL";
  const isPUBG = gameCategory === "PUBG";
  const isSnookerOrCheckers = gameCategory === "SNOOKER" || gameCategory === "CHECKERS";
  const frameLabel = gameCategory === "CHECKERS" ? "GW" : "FW";
  const frameLabelFull = gameCategory === "CHECKERS" ? "Games" : "Frames";

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-10">#</TableHead>
          <TableHead>{isIndividual ? "Player" : "Team"}</TableHead>
          <TableHead className="text-center">MP</TableHead>
          {isPUBG ? (
            <>
              <TableHead className="text-center">💀 Kills</TableHead>
              <TableHead className="text-center">🐔</TableHead>
              <TableHead className="text-center font-bold">Total Pts</TableHead>
            </>
          ) : isSnookerOrCheckers ? (
            <>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center" title={`${frameLabelFull} Won`}>{frameLabel}</TableHead>
              <TableHead className="text-center" title={`${frameLabelFull} Lost`}>{frameLabel}A</TableHead>
              <TableHead className="text-center font-bold">Pts</TableHead>
              <TableHead className="text-center w-[120px]">Form</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">D</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center hidden sm:table-cell">GF</TableHead>
              <TableHead className="text-center hidden sm:table-cell">GA</TableHead>
              <TableHead className="text-center">GD</TableHead>
              <TableHead className="text-center font-bold">Pts</TableHead>
              <TableHead className="text-center w-[120px]">Form</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => {
          const name = isIndividual ? s.player?.name : s.team?.name;
          const href = isIndividual
            ? `/players/${s.player?.slug}`
            : `/teams/${s.team?.slug}`;
          const participantId = isIndividual ? s.playerId : s.teamId;
          const form = participantId ? computeForm(participantId, formMatches, isIndividual) : [];

          // Tiebreaker indicator — show why this row is above the previous with same points
          let tiebreaker: string | null = null;
          if (!isPUBG && i > 0) {
            const prev = standings[i - 1];
            if (s.points === prev.points && s.goalDiff !== prev.goalDiff) {
              tiebreaker = "GD";
            } else if (s.points === prev.points && s.goalDiff === prev.goalDiff && s.goalsFor !== prev.goalsFor) {
              tiebreaker = "GF";
            } else if (s.points === prev.points && s.goalDiff === prev.goalDiff && s.goalsFor === prev.goalsFor) {
              tiebreaker = "=";
            }
          }

          return (
            <TableRow key={s.id}>
              <TableCell className="font-medium text-muted-foreground">
                <div className="flex flex-col items-center">
                  <span>{i + 1}</span>
                  {tiebreaker && tiebreaker !== "=" && (
                    <span className="text-[9px] text-muted-foreground/60" title={`Separated by ${tiebreaker === "GD" ? "goal difference" : "goals scored"}`}>{tiebreaker}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Link href={href} className="flex items-center gap-2 hover:text-primary transition-colors">
                  {isIndividual && s.player ? (
                    <SmartAvatar type="player" id={s.player.id} name={name ?? ""} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                  ) : s.team ? (
                    <SmartAvatar type="team" id={s.team.id} name={name ?? ""} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                  ) : (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(name ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="font-medium">{name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-center">{s.played}</TableCell>
              {isPUBG ? (
                <>
                  <TableCell className="text-center">{s.goalsFor}</TableCell>
                  <TableCell className="text-center">{s.won}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{s.points}</TableCell>
                </>
              ) : isSnookerOrCheckers ? (
                <>
                  <TableCell className="text-center text-green-400">{s.won}</TableCell>
                  <TableCell className="text-center text-red-400">{s.lost}</TableCell>
                  <TableCell className="text-center">{s.goalsFor}</TableCell>
                  <TableCell className="text-center">{s.goalsAgainst}</TableCell>
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
                </>
              ) : (
                <>
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
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// BracketMatch interface, BracketView, and BracketMatchCard moved to
// src/components/public/bracket-view.tsx as BracketVisualization

// Keep this for backward compat — the type is now in the component
type BracketMatch = {
  id: string;
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  status: string;
  scheduledAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePens: number | null;
  awayScorePens: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homeTeam: { id: string; name: string; shortName: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null } | null;
  homePlayer: { id: string; name: string } | null;
  awayPlayer: { id: string; name: string } | null;
};
