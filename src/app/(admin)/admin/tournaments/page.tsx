export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getTournaments } from "@/lib/actions/tournament";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trophy,
  Edit,
  Eye,
} from "lucide-react";
import {
  formatDate,
  gameLabel,
  gameColor,
  statusLabel,
  statusColor,
  formatLabel,
} from "@/lib/utils";
import { DeleteTournamentButton } from "./delete-button";
import { CloneTournamentButton } from "./clone-button";

export const metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  await requireRole("EDITOR");
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Tournaments"
        description={`${tournaments.length} tournament${tournaments.length !== 1 ? "s" : ""} total`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/tournaments/new">
              <Plus className="w-4 h-4" />
              New Tournament
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No tournaments yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first tournament to get started.
            </p>
            <Button asChild>
              <Link href="/admin/tournaments/new">
                <Plus className="w-4 h-4" />
                New Tournament
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Tournament</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Teams</TableHead>
                  <TableHead className="text-center">Matches</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.isFeatured && (
                          <span className="text-xs text-accent">Featured</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${gameColor(t.gameCategory)}`}
                      >
                        {gameLabel(t.gameCategory)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLabel(t.format)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}
                      >
                        {statusLabel(t.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>
                        <div>{t.startDate ? formatDate(t.startDate) : "—"}</div>
                        {t.endDate && (
                          <div className="text-xs opacity-70">
                            → {formatDate(t.endDate)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t._count.teams + t._count.players}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {t._count.matches}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <Link href={`/admin/tournaments/${t.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <Link href={`/admin/tournaments/${t.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <CloneTournamentButton id={t.id} />
                        <DeleteTournamentButton id={t.id} name={t.name} />
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
