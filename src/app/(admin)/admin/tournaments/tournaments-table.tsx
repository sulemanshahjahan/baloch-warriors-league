"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Edit, Eye } from "lucide-react";
import { formatDate, gameLabel, gameColor, statusLabel, statusColor, formatLabel } from "@/lib/utils";
import { DeleteTournamentButton } from "./delete-button";
import { CloneTournamentButton } from "./clone-button";
import { BulkDeleteBar } from "@/components/admin/bulk-delete-bar";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { bulkDeleteTournaments } from "@/lib/actions/tournament";

interface Tournament {
  id: string;
  name: string;
  slug: string;
  gameCategory: string;
  format: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  _count: { matches: number; teams: number; players: number };
}

export function TournamentsTable({ tournaments }: { tournaments: Tournament[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === tournaments.length ? new Set() : new Set(tournaments.map((t) => t.id)));
  }

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <ResponsiveTable><Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size === tournaments.length && tournaments.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Tournament</TableHead>
              <TableHead className="text-center">Participants</TableHead>
              <TableHead className="text-center">Matches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tournaments.map((t) => (
              <TableRow key={t.id} className={selected.has(t.id) ? "bg-primary/5" : ""}>
                <TableCell>
                  <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                </TableCell>
                <TableCell>
                  <div>
                    <Link href={`/admin/tournaments/${t.id}`} className="font-medium hover:text-primary hover:underline">
                      {t.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${gameColor(t.gameCategory)}`}>
                        {gameLabel(t.gameCategory)}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatLabel(t.format)}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm">
                  {t._count.teams + t._count.players}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {t._count.matches}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.startDate ? formatDate(t.startDate) : "TBD"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/admin/tournaments/${t.id}`}><Eye className="w-4 h-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/admin/tournaments/${t.id}/edit`}><Edit className="w-4 h-4" /></Link>
                    </Button>
                    <CloneTournamentButton id={t.id} />
                    <DeleteTournamentButton id={t.id} name={t.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></ResponsiveTable>
      </div>

      <BulkDeleteBar
        selectedIds={[...selected]}
        entityName="tournament"
        onClear={() => setSelected(new Set())}
        onDelete={async (ids) => {
          const result = await bulkDeleteTournaments(ids);
          return { success: result.success, error: result.success ? undefined : result.error };
        }}
      />
    </>
  );
}
