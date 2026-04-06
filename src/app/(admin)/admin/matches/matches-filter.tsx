"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Edit, X } from "lucide-react";
import { formatDate, gameLabel, statusColor, statusLabel } from "@/lib/utils";
import { DeleteButton } from "./delete-button";
import { Pagination } from "@/components/admin/pagination";

type Match = {
  id: string;
  round: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: Date | null;
  homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
  homePlayer: { id: string; name: string; slug: string; photoUrl: string | null } | null;
  awayPlayer: { id: string; name: string; slug: string; photoUrl: string | null } | null;
  motmPlayer: { id: string; name: string } | null;
  tournament: { id: string; name: string; gameCategory: string };
};

const ALL_STATUSES = ["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "POSTPONED"];

interface MatchesFilterProps {
  matches: Match[];
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
}

export function MatchesFilter({ 
  matches, 
  currentPage, 
  totalPages, 
  total, 
  itemsPerPage 
}: MatchesFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState("");
  
  // Get current filters from URL
  const statusFilter = searchParams.get("status") ?? "all";
  const tournamentFilter = searchParams.get("tournamentId") ?? "all";

  const tournaments = useMemo(
    () =>
      Array.from(
        new Map(matches.map((m) => [m.tournament.id, m.tournament.name])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [matches]
  );

  // Client-side filtering for search text
  const filteredMatches = useMemo(() => {
    if (!search) return matches;
    const q = search.toLowerCase();
    return matches.filter((m) => {
      const homeName = m.homePlayer?.name ?? m.homeTeam?.name ?? "";
      const awayName = m.awayPlayer?.name ?? m.awayTeam?.name ?? "";
      const tName = m.tournament.name;
      return (
        homeName.toLowerCase().includes(q) ||
        awayName.toLowerCase().includes(q) ||
        tName.toLowerCase().includes(q) ||
        (m.round?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [matches, search]);

  function updateFilters(updates: { status?: string; tournamentId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    
    if (updates.status !== undefined) {
      if (updates.status === "all") {
        params.delete("status");
      } else {
        params.set("status", updates.status);
      }
    }
    
    if (updates.tournamentId !== undefined) {
      if (updates.tournamentId === "all") {
        params.delete("tournamentId");
      } else {
        params.set("tournamentId", updates.tournamentId);
      }
    }
    
    // Reset to page 1 when filters change
    params.delete("page");
    
    router.push(`/admin/matches?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (search) {
      setSearch("");
    }
    router.push("/admin/matches");
  }

  const hasActiveFilters = statusFilter !== "all" || tournamentFilter !== "all" || search;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search matches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select 
          value={statusFilter} 
          onValueChange={(value) => updateFilters({ status: value })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={tournamentFilter} 
          onValueChange={(value) => updateFilters({ tournamentId: value })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tournament" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tournaments</SelectItem>
            {tournaments.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredMatches.length} of {total} matches
        {totalPages > 1 && ` (page ${currentPage} of ${totalPages})`}
      </p>

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
            {filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No matches match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredMatches.map((match) => {
                const homeName =
                  match.homePlayer?.name ??
                  match.homeTeam?.shortName ??
                  match.homeTeam?.name ??
                  "TBD";
                const awayName =
                  match.awayPlayer?.name ??
                  match.awayTeam?.shortName ??
                  match.awayTeam?.name ??
                  "TBD";
                return (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{homeName}</span>
                        <span className="text-muted-foreground mx-2">vs</span>
                        <span className="font-medium">{awayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>
                        <p>{match.tournament.name}</p>
                        <p className="text-xs opacity-70">
                          {gameLabel(match.tournament.gameCategory as never)}
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(match.status as never)}`}
                      >
                        {statusLabel(match.status as never)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {match.scheduledAt ? formatDate(match.scheduledAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`/admin/matches/${match.id}`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DeleteButton
                          matchId={match.id}
                          matchName={`${homeName} vs ${awayName}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        itemsPerPage={itemsPerPage}
        basePath="/admin/matches"
        searchParams={{
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(tournamentFilter !== "all" && { tournamentId: tournamentFilter }),
        }}
      />
    </div>
  );
}
