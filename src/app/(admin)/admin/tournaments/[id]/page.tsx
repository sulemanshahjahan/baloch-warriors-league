export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/header";
import { getTournamentById, getAvailableTeams, getAvailablePlayers } from "@/lib/actions/tournament";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Plus, Users, User, Swords, BarChart3, Award } from "lucide-react";
import { ScheduleGenerator, GenerateKnockoutButton } from "./schedule-generator";
import { PUBGScheduleGenerator } from "./pubg-schedule-generator";
import {
  formatDate,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  formatLabel,
} from "@/lib/utils";
import { TeamEnrollment } from "./team-enrollment";
import { PlayerEnrollment } from "./player-enrollment";
import { AwardsManager } from "./awards-manager";
import { GroupsManager } from "./groups-manager";
import { RecomputeStandingsButton } from "./recompute-standings-button";
import { CollapsibleSection } from "@/components/admin/collapsible-section";
import { PaginatedMatchesTable } from "./matches-table";

interface TournamentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  await requireRole("EDITOR");
  const { id } = await params;
  const [tournament, availableTeams, availablePlayers] = await Promise.all([
    getTournamentById(id),
    getAvailableTeams(id),
    getAvailablePlayers(id),
  ]);

  if (!tournament) notFound();

  // Single batch query instead of N+1 per-team queries
  const teamIds = tournament.teams.map((t) => t.team.id);
  const allPlayers = teamIds.length > 0
    ? await prisma.teamPlayer.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        select: { player: { select: { id: true, name: true, photoUrl: true } } },
      }).then((rows) => rows.map((r) => r.player))
    : [];

  // Sort matches: Knockout first, then Group rounds
  const sortedMatches = [...tournament.matches].sort((a, b) => {
    const aIsKnockout = a.round && !/Group\s+[A-Z]/i.test(a.round);
    const bIsKnockout = b.round && !/Group\s+[A-Z]/i.test(b.round);
    if (aIsKnockout && !bIsKnockout) return -1;
    if (!aIsKnockout && bIsKnockout) return 1;
    if (aIsKnockout && bIsKnockout) return (b.roundNumber || 0) - (a.roundNumber || 0);
    const aGroup = a.round?.match(/Group\s+([A-Z])/i)?.[1] || "";
    const bGroup = b.round?.match(/Group\s+([A-Z])/i)?.[1] || "";
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    return (a.roundNumber || 0) - (b.roundNumber || 0);
  });

  const isPUBG = tournament.gameCategory === "PUBG";

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={tournament.name}
        description={`${gameLabel(tournament.gameCategory)} · ${formatLabel(tournament.format)}`}
      />

      <main className="flex-1 p-6 space-y-4">
        {/* Compact meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${gameColor(tournament.gameCategory)}`}>
            {gameLabel(tournament.gameCategory)}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(tournament.status)}`}>
            {statusLabel(tournament.status)}
          </span>
          <span className="text-xs text-muted-foreground">
            {tournament.startDate ? formatDate(tournament.startDate) : "Date TBD"}
            {tournament.endDate && ` → ${formatDate(tournament.endDate)}`}
          </span>
          <div className="ml-auto">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/tournaments/${id}/edit`}>
                <Edit className="w-3 h-3" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        {/* Participants — side by side, collapsed by default if populated */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CollapsibleSection
            icon={<Users className="w-4 h-4 text-blue-400" />}
            title="Teams"
            count={tournament.teams.length}
            defaultOpen={tournament.teams.length === 0}
          >
            <TeamEnrollment
              tournamentId={id}
              enrolledTeams={tournament.teams}
              availableTeams={availableTeams}
            />
          </CollapsibleSection>

          <CollapsibleSection
            icon={<User className="w-4 h-4 text-purple-400" />}
            title="Players"
            count={tournament.players.length}
            defaultOpen={tournament.players.length === 0}
          >
            <PlayerEnrollment
              tournamentId={id}
              enrolledPlayers={tournament.players}
              availablePlayers={availablePlayers}
            />
          </CollapsibleSection>
        </div>

        {/* Groups — only for GROUP_KNOCKOUT, collapsed when set up */}
        {tournament.format === "GROUP_KNOCKOUT" && (
          <CollapsibleSection
            icon={<Users className="w-4 h-4 text-blue-400" />}
            title="Groups"
            count={tournament.groups.length}
            defaultOpen={tournament.groups.length === 0}
          >
            <GroupsManager
              tournamentId={id}
              groups={tournament.groups}
              participantType={tournament.participantType}
              unassignedParticipants={
                tournament.participantType === "INDIVIDUAL"
                  ? tournament.players
                      .filter((p) => !p.groupId)
                      .map((p) => ({
                        id: p.id,
                        tournamentId: p.id,
                        name: p.player.name,
                        photoUrl: p.player.photoUrl,
                        skillLevel: p.player.skillLevel,
                      }))
                  : tournament.teams
                      .filter((t) => !t.groupId)
                      .map((t) => ({
                        id: t.id,
                        tournamentId: t.id,
                        name: t.team.name,
                        photoUrl: t.team.logoUrl,
                      }))
              }
            />
          </CollapsibleSection>
        )}

        {/* Awards — collapsed by default */}
        <CollapsibleSection
          icon={<Award className="w-4 h-4 text-accent" />}
          title="Awards"
          count={tournament.awards.length}
          defaultOpen={false}
        >
          <AwardsManager
            tournamentId={id}
            awards={tournament.awards}
            teams={tournament.teams.map((t) => t.team)}
            players={allPlayers}
          />
        </CollapsibleSection>

        {/* Standings — open by default, compact */}
        <CollapsibleSection
          icon={<BarChart3 className="w-4 h-4 text-yellow-400" />}
          title="Standings"
          count={tournament.standings.length}
          defaultOpen={tournament.standings.length > 0}
          actions={
            <div className="flex items-center gap-2">
              <a
                href={`/api/export?type=standings&tournamentId=${id}&format=csv`}
                download
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                📥 CSV
              </a>
              <a
                href={`/api/export?type=matches&tournamentId=${id}&format=csv`}
                download
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                📥 Matches
              </a>
              <RecomputeStandingsButton tournamentId={id} />
            </div>
          }
        >
          {tournament.standings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No standings yet. Play some matches first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{tournament.participantType === "INDIVIDUAL" ? "Player" : "Team"}</TableHead>
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
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {tournament.participantType === "INDIVIDUAL" ? s.player?.name : s.team?.name}
                    </TableCell>
                    <TableCell className="text-center text-sm">{s.played}</TableCell>
                    <TableCell className="text-center text-sm">{s.won}</TableCell>
                    <TableCell className="text-center text-sm">{s.drawn}</TableCell>
                    <TableCell className="text-center text-sm">{s.lost}</TableCell>
                    <TableCell className="text-center text-sm">{s.goalsFor}</TableCell>
                    <TableCell className="text-center text-sm">{s.goalsAgainst}</TableCell>
                    <TableCell className="text-center text-sm">{s.goalDiff}</TableCell>
                    <TableCell className="text-center text-sm font-bold">{s.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CollapsibleSection>

        {/* Matches — paginated, open by default */}
        <CollapsibleSection
          icon={<Swords className="w-4 h-4 text-orange-400" />}
          title="Matches"
          count={tournament.matches.length}
          defaultOpen={true}
          actions={
            <div className="flex items-center gap-2">
              {isPUBG ? (
                <PUBGScheduleGenerator
                  tournamentId={id}
                  participantCount={tournament.teams.length + tournament.players.length}
                  participantType={tournament.participantType}
                  scheduledMatchesCount={tournament.matches.filter((m) => m.status === "SCHEDULED").length}
                />
              ) : (
                <>
                  <ScheduleGenerator
                    tournamentId={id}
                    participantCount={tournament.teams.length + tournament.players.length}
                    hasGroups={tournament.groups.length > 0}
                    participantType={tournament.participantType}
                    groupCount={tournament.groups.length}
                    scheduledMatchesCount={tournament.matches.filter((m) => m.status === "SCHEDULED").length}
                  />
                  {tournament.groups.length > 0 && (
                    <GenerateKnockoutButton
                      tournamentId={id}
                      groupCount={tournament.groups.length}
                    />
                  )}
                </>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/matches/new?tournamentId=${id}`}>
                  <Plus className="w-3 h-3" />
                  Add
                </Link>
              </Button>
            </div>
          }
        >
          <PaginatedMatchesTable
            matches={sortedMatches as never[]}
            participantType={tournament.participantType}
          />
        </CollapsibleSection>
      </main>
    </div>
  );
}
