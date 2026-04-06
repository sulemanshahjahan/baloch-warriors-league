export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getTournamentById, getAvailableTeams, getAvailablePlayers } from "@/lib/actions/tournament";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Plus, Users, User, Swords, BarChart3, Award } from "lucide-react";
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

interface TournamentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const { id } = await params;
  const [tournament, availableTeams, availablePlayers] = await Promise.all([
    getTournamentById(id),
    getAvailableTeams(id),
    getAvailablePlayers(id),
  ]);

  if (!tournament) notFound();

  // Get all enrolled players from teams for awards selection
  const enrolledPlayerIds = tournament.players.map((p) => p.player.id);
  const enrolledTeamPlayers = await Promise.all(
    tournament.teams.map(async ({ team }) => {
      const teamData = await import("@/lib/actions/team").then((m) =>
        m.getTeamById(team.id)
      );
      return teamData?.players.map((tp) => tp.player) ?? [];
    })
  );
  const allPlayers = enrolledTeamPlayers.flat();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={tournament.name}
        description={`${gameLabel(tournament.gameCategory)} · ${formatLabel(tournament.format)}`}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gameColor(tournament.gameCategory)}`}
          >
            {gameLabel(tournament.gameCategory)}
          </span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor(tournament.status)}`}
          >
            {statusLabel(tournament.status)}
          </span>
          <span className="text-sm text-muted-foreground">
            {tournament.startDate ? formatDate(tournament.startDate) : "Date TBD"}
            {tournament.endDate && ` → ${formatDate(tournament.endDate)}`}
          </span>

          <div className="ml-auto flex gap-2">
            <Button asChild size="sm">
              <Link href={`/admin/tournaments/${id}/edit`}>
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        {/* Description */}
        {tournament.description && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{tournament.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Teams */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Teams
                <Badge variant="secondary" className="ml-1">
                  {tournament.teams.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TeamEnrollment
                tournamentId={id}
                enrolledTeams={tournament.teams}
                availableTeams={availableTeams}
              />
            </CardContent>
          </Card>

          {/* Individual Players */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                Individual Players
                <Badge variant="secondary" className="ml-1">
                  {tournament.players.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerEnrollment
                tournamentId={id}
                enrolledPlayers={tournament.players}
                availablePlayers={availablePlayers}
              />
            </CardContent>
          </Card>
        </div>

        {/* Awards */}
        <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                Awards
                <Badge variant="secondary" className="ml-1">
                  {tournament.awards.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AwardsManager
                tournamentId={id}
                awards={tournament.awards}
                teams={tournament.teams.map((t) => t.team)}
                players={allPlayers}
              />
            </CardContent>
          </Card>

        {/* Standings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-yellow-400" />
                Standings
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {tournament.standings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No standings yet. Play some matches first.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
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
                      <TableCell className="text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {s.team?.name}
                      </TableCell>
                      <TableCell className="text-center text-sm">{s.played}</TableCell>
                      <TableCell className="text-center text-sm">{s.won}</TableCell>
                      <TableCell className="text-center text-sm">{s.drawn}</TableCell>
                      <TableCell className="text-center text-sm">{s.lost}</TableCell>
                      <TableCell className="text-center text-sm">{s.goalsFor}</TableCell>
                      <TableCell className="text-center text-sm">{s.goalsAgainst}</TableCell>
                      <TableCell className="text-center text-sm">{s.goalDiff}</TableCell>
                      <TableCell className="text-center text-sm font-bold">
                        {s.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Matches */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Swords className="w-4 h-4 text-orange-400" />
                Matches
                <Badge variant="secondary">{tournament.matches.length}</Badge>
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/matches/new?tournamentId=${id}`}>
                  <Plus className="w-3 h-3" />
                  Add Match
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tournament.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No matches scheduled yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Away</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tournament.matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {match.round ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(match as any).homePlayer?.name ?? match.homeTeam?.name ?? "TBD"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        {match.status === "COMPLETED"
                          ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
                          : "vs"}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(match as any).awayPlayer?.name ?? match.awayTeam?.name ?? "TBD"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${statusColor(match.status)}`}
                        >
                          {statusLabel(match.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {match.scheduledAt ? formatDate(match.scheduledAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/matches/${match.id}`}>
                            <Edit className="w-3 h-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
