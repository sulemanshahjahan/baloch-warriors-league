export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getMatches } from "@/lib/actions/match";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Swords, Edit } from "lucide-react";
import { formatDate, gameLabel, statusColor, statusLabel } from "@/lib/utils";

export const metadata = { title: "Matches" };

export default async function MatchesPage() {
  const matches = await getMatches();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Matches"
        description={`${matches.length} match${matches.length !== 1 ? "es" : ""} total`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/matches/new">
              <Plus className="w-4 h-4" />
              New Match
            </Link>
          </Button>
        </div>

        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Swords className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No matches yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule the first match for your tournaments.
            </p>
            <Button asChild>
              <Link href="/admin/matches/new">
                <Plus className="w-4 h-4" />
                New Match
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Match</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">
                          {match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD"}
                        </span>
                        <span className="text-muted-foreground mx-2">vs</span>
                        <span className="font-medium">
                          {match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>
                        <p>{match.tournament.name}</p>
                        <p className="text-xs opacity-70">
                          {gameLabel(match.tournament.gameCategory)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {match.round ?? "—"}
                    </TableCell>
                    <TableCell className="text-center font-bold text-sm">
                      {match.status === "COMPLETED"
                        ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(match.status)}`}
                      >
                        {statusLabel(match.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {match.scheduledAt ? formatDate(match.scheduledAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`/admin/matches/${match.id}`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
