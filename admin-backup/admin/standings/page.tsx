export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart3, ExternalLink, Trophy } from "lucide-react";
import { getInitials, gameLabel, gameColor, statusColor, statusLabel } from "@/lib/utils";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Standings" };

async function getAllStandings() {
  // Get tournaments that have standings
  const tournaments = await prisma.tournament.findMany({
    where: {
      standings: { some: {} },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      standings: {
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }, { goalsFor: "desc" }],
        include: {
          team: { select: { id: true, name: true, logoUrl: true, slug: true } },
          player: { select: { id: true, name: true, photoUrl: true, slug: true } },
          group: { select: { id: true, name: true } },
        },
      },
    },
  });

  return tournaments;
}

export default async function StandingsPage() {
  await requireRole("ADMIN");
  const tournaments = await getAllStandings();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Standings"
        description="Points tables across all active tournaments"
      />

      <main className="flex-1 p-6 space-y-8">
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No standings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Standings are computed automatically when matches are completed.
            </p>
            <Link
              href="/admin/matches"
              className="text-sm text-primary hover:underline"
            >
              Go to Matches
            </Link>
          </div>
        ) : (
          tournaments.map((tournament) => {
            // Group standings by group if present
            const hasGroups = tournament.standings.some((s) => s.group);
            const isIndividual = tournament.standings.some((s) => s.playerId);

            const standingsByGroup: Record<string, typeof tournament.standings> = {};
            if (hasGroups) {
              for (const s of tournament.standings) {
                const key = s.group?.name ?? "Ungrouped";
                if (!standingsByGroup[key]) standingsByGroup[key] = [];
                standingsByGroup[key].push(s);
              }
            } else {
              standingsByGroup["__all"] = tournament.standings;
            }

            return (
              <Card key={tournament.id}>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(tournament.gameCategory)}`}
                          >
                            {gameLabel(tournament.gameCategory)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(tournament.status)}`}
                          >
                            {statusLabel(tournament.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/admin/tournaments/${tournament.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Manage
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {Object.entries(standingsByGroup).map(([groupName, standings]) => (
                    <div key={groupName}>
                      {hasGroups && (
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                          {groupName}
                        </h4>
                      )}
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>
                                {isIndividual ? "Player" : "Team"}
                              </TableHead>
                              <TableHead className="text-center w-12">P</TableHead>
                              <TableHead className="text-center w-12">W</TableHead>
                              <TableHead className="text-center w-12">D</TableHead>
                              <TableHead className="text-center w-12">L</TableHead>
                              <TableHead className="text-center w-16">GF</TableHead>
                              <TableHead className="text-center w-16">GA</TableHead>
                              <TableHead className="text-center w-16">GD</TableHead>
                              <TableHead className="text-center w-16 font-bold">Pts</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {standings.map((standing, idx) => {
                              const name = standing.team?.name ?? standing.player?.name ?? "Unknown";
                              const logo = standing.team?.logoUrl ?? standing.player?.photoUrl;
                              const href = standing.team
                                ? `/admin/teams/${standing.team.id}`
                                : standing.player
                                  ? `/admin/players/${standing.player.id}`
                                  : null;

                              return (
                                <TableRow key={standing.id}>
                                  <TableCell className="text-muted-foreground text-sm font-mono">
                                    {idx + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-7 w-7">
                                        <AvatarImage src={logo ?? undefined} />
                                        <AvatarFallback className="text-xs">
                                          {getInitials(name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {href ? (
                                        <Link
                                          href={href}
                                          className="font-medium hover:text-primary transition-colors text-sm"
                                        >
                                          {name}
                                        </Link>
                                      ) : (
                                        <span className="font-medium text-sm">{name}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-sm">{standing.played}</TableCell>
                                  <TableCell className="text-center text-sm">{standing.won}</TableCell>
                                  <TableCell className="text-center text-sm">{standing.drawn}</TableCell>
                                  <TableCell className="text-center text-sm">{standing.lost}</TableCell>
                                  <TableCell className="text-center text-sm">{standing.goalsFor}</TableCell>
                                  <TableCell className="text-center text-sm">{standing.goalsAgainst}</TableCell>
                                  <TableCell className={`text-center text-sm font-medium ${standing.goalDiff > 0 ? "text-green-400" : standing.goalDiff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                    {standing.goalDiff > 0 ? `+${standing.goalDiff}` : standing.goalDiff}
                                  </TableCell>
                                  <TableCell className="text-center font-bold text-sm">
                                    {standing.points}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
