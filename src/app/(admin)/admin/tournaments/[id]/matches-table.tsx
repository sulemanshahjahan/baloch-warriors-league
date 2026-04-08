"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, ChevronDown } from "lucide-react";
import { formatDate, getRoundDisplayName } from "@/lib/utils";
import { QuickMatchEditor } from "./quick-match-editor";

interface Match {
  id: string;
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  status: string;
  scheduledAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string; shortName: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null } | null;
  homePlayer?: { id: string; name: string } | null;
  awayPlayer?: { id: string; name: string } | null;
}

const PAGE_SIZE = 8;

export function PaginatedMatchesTable({
  matches,
  participantType,
}: {
  matches: Match[];
  participantType: string;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(matches.length / PAGE_SIZE);
  const visible = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No matches scheduled yet.
      </p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Round</TableHead>
            <TableHead>Home</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead>Away</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((match) => (
            <TableRow key={match.id}>
              <TableCell className="text-sm text-muted-foreground">
                {getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}
              </TableCell>
              <TableCell className="font-medium text-sm">
                {match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD"}
              </TableCell>
              <TableCell className="text-center">
                <QuickMatchEditor match={match as never} participantType={participantType as "TEAM" | "INDIVIDUAL"} />
              </TableCell>
              <TableCell className="font-medium text-sm">
                {match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD"}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 px-1">
          <span className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, matches.length)} of {matches.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
