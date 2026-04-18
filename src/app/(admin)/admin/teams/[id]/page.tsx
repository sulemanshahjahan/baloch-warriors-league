export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getTeamById } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Users, Trophy, UserPlus, User, ArrowLeft } from "lucide-react";
import { RemovePlayerButton } from "./remove-player-button";
import { ReactivatePlayerButton } from "./reactivate-player-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, gameLabel, statusColor, statusLabel } from "@/lib/utils";

interface TeamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  await requireRole("EDITOR");
  const { id } = await params;
  const team = await getTeamById(id);

  if (!team) notFound();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={team.name}
        description={team.shortName ?? "Team Details"}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/admin/teams"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Teams
        </Link>

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={team.logoUrl ?? undefined} />
              <AvatarFallback
                className="text-lg"
                style={{
                  backgroundColor: team.primaryColor
                    ? `${team.primaryColor}33`
                    : undefined,
                }}
              >
                {getInitials(team.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              {team.shortName && (
                <p className="text-muted-foreground">{team.shortName}</p>
              )}
            </div>
          </div>
          <Button asChild>
            <Link href={`/admin/teams/${id}/edit`}>
              <Edit className="w-4 h-4" />
              Edit Team
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Team Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    team.isActive
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {team.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {team.primaryColor && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">
                    Primary Color
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: team.primaryColor }}
                    />
                    <span className="text-sm font-mono">{team.primaryColor}</span>
                  </div>
                </div>
              )}
              {team.captain && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Captain</span>
                  <Link
                    href={`/admin/players/${team.captain.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {team.captain.name}
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">
                  {new Date(team.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Tournaments */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Tournament History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {team.tournaments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Not enrolled in any tournaments yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {team.tournaments.map(({ tournament }) => (
                    <div
                      key={tournament.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <Link
                          href={`/admin/tournaments/${tournament.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {tournament.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {gameLabel(tournament.gameCategory)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                          tournament.status
                        )}`}
                      >
                        {statusLabel(tournament.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Squad */}
        {(() => {
          const activePlayers = team.players.filter((p) => p.isActive);
          const formerPlayers = team.players.filter((p) => !p.isActive);

          return (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      Squad ({activePlayers.length})
                    </CardTitle>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/players?teamId=${id}`}>
                        <UserPlus className="w-4 h-4" />
                        Add Player
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activePlayers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        No players in the squad yet.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <Link href="/admin/players/new">Add First Player</Link>
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Player</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead className="text-center">Jersey #</TableHead>
                          <TableHead className="text-right">Joined</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePlayers.map(({ id: teamPlayerId, player, jerseyNumber, joinedAt }) => (
                          <TableRow key={teamPlayerId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={player.photoUrl ?? undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(player.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <Link
                                  href={`/admin/players/${player.id}`}
                                  className="font-medium hover:text-primary hover:underline"
                                >
                                  {player.name}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {player.position ?? "—"}
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {jerseyNumber ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {new Date(joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })}
                            </TableCell>
                            <TableCell>
                              <RemovePlayerButton
                                teamPlayerId={teamPlayerId}
                                teamId={id}
                                playerName={player.name}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Transfer History */}
              {formerPlayers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Former Players
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Player</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead className="text-right">Joined</TableHead>
                          <TableHead className="text-right">Left</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formerPlayers.map(({ id: teamPlayerId, player, joinedAt, leftAt }) => (
                          <TableRow key={teamPlayerId} className="opacity-60">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={player.photoUrl ?? undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(player.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <Link
                                  href={`/admin/players/${player.id}`}
                                  className="font-medium hover:text-primary hover:underline"
                                >
                                  {player.name}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {player.position ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {new Date(joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {leftAt ? new Date(leftAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "—"}
                            </TableCell>
                            <TableCell>
                              <ReactivatePlayerButton teamPlayerId={teamPlayerId} teamId={id} playerName={player.name} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}
