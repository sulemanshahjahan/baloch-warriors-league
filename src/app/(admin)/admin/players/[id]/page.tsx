export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getPlayerById, getPlayerStats } from "@/lib/actions/player";
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
import { Edit, User, Trophy, Award, Activity, ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatDate, gameLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PlayerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerDetailPage({ params }: PlayerDetailPageProps) {
  const { id } = await params;
  const player = await getPlayerById(id);

  if (!player) notFound();

  const stats = await getPlayerStats(id);

  const currentTeam = player.teams.find((t) => t.team)?.team;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={player.name}
        description={player.nickname ? `"${player.nickname}"` : "Player Profile"}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/admin/players"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Players
        </Link>

        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={player.photoUrl ?? undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(player.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{player.name}</h1>
              {player.nickname && (
                <p className="text-muted-foreground">&quot;{player.nickname}&quot;</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {player.position && (
                  <Badge variant="secondary">{player.position}</Badge>
                )}
                {player.skillLevel && (
                  <Badge variant="outline" className="text-yellow-500">
                    LVL {player.skillLevel}
                  </Badge>
                )}
                {currentTeam && (
                  <Link
                    href={`/admin/teams/${currentTeam.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {currentTeam.name}
                  </Link>
                )}
              </div>
            </div>
          </div>
          <Button asChild>
            <Link href={`/admin/players/${id}/edit`}>
              <Edit className="w-4 h-4" />
              Edit Player
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    player.isActive
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {player.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {player.nationality && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Nationality
                  </span>
                  <span className="text-sm">{player.nationality}</span>
                </div>
              )}
              {player.dateOfBirth && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Date of Birth
                  </span>
                  <span className="text-sm">{formatDate(player.dateOfBirth)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Joined</span>
                <span className="text-sm">{formatDate(player.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
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
                  { label: "Own Goals", value: stats.ownGoals },
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
        </div>

        {/* Team History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Team History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {player.teams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Not associated with any teams yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Jersey #</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                    <TableHead className="text-right">Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {player.teams.map(({ team, jerseyNumber, joinedAt, leftAt, isActive }) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <Link
                          href={`/admin/teams/${team.id}`}
                          className="font-medium hover:text-primary hover:underline flex items-center gap-2"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={team.logoUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(team.name)}
                            </AvatarFallback>
                          </Avatar>
                          {team.name}
                          {isActive && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                              Current
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {jerseyNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(joinedAt)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {leftAt ? formatDate(leftAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Awards */}
        {player.awards.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                Awards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {player.awards.map((award) => (
                  <div
                    key={award.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{award.type}</p>
                      {award.tournament && (
                        <p className="text-xs text-muted-foreground">
                          <Link
                            href={`/admin/tournaments/${award.tournament.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {award.tournament.name}
                          </Link>
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(award.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Match Events */}
        {player.matchEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Event</TableHead>
                    <TableHead>Tournament</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {player.matchEvents.slice(0, 10).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <span className="font-medium">{event.type}</span>
                        {event.minute && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({event.minute}&apos;)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.match?.tournament?.name && (
                          <>
                            {event.match.tournament.name}
                            <span className="text-xs opacity-70 ml-1">
                              ({gameLabel(event.match.tournament.gameCategory)})
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
