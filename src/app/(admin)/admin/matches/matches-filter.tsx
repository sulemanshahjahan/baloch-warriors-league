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
import { Search, Edit, X, ChevronDown, ChevronUp } from "lucide-react";
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
  _count: { participants: number };
};

const ALL_STATUSES = ["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "POSTPONED"];

const GAME_ICONS: Record<string, string> = {
  PUBG: "🎮",
  EFOOTBALL: "⚽",
  FOOTBALL: "🏈",
  SNOOKER: "🎱",
  CHECKERS: "♟️",
};

interface MatchesFilterProps {
  matches: Match[];
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
}

function getMatchLabel(match: Match): string {
  if (!match.homeTeam && !match.awayTeam && !match.homePlayer && !match.awayPlayer) {
    const count = match._count.participants;
    return count > 0 ? `${count} Players` : "Battle Royale";
  }
  const home = match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD";
  const away = match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD";
  return `${home} vs ${away}`;
}

function MatchRow({ match }: { match: Match }) {
  const isBattleRoyale =
    !match.homeTeam && !match.awayTeam && !match.homePlayer && !match.awayPlayer;
  const count = match._count.participants;

  const homeName = match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name;
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name;
  const label = getMatchLabel(match);

  return (
    <TableRow>
      <TableCell>
        <div className="text-sm">
          {isBattleRoyale ? (
            <span className="flex items-center gap-1.5 font-medium">
              <span>🎮</span>
              <span>{count > 0 ? `${count} Players` : "Battle Royale"}</span>
            </span>
          ) : (
            <>
              <span className="font-medium">{homeName ?? "TBD"}</span>
              <span className="text-muted-foreground mx-2">vs</span>
              <span className="font-medium">{awayName ?? "TBD"}</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {match.tournament.name}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {match.round ?? "—"}
      </TableCell>
      <TableCell className="text-center font-bold text-sm">
        {match.status === "COMPLETED"
          ? isBattleRoyale
            ? <span className="text-xs text-muted-foreground">View results</span>
            : `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
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
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href={`/admin/matches/${match.id}`}>
              <Edit className="w-4 h-4" />
            </Link>
          </Button>
          <DeleteButton matchId={match.id} matchName={label} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function GameSection({ gameCategory, matches }: { gameCategory: string; matches: Match[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const icon = GAME_ICONS[gameCategory] ?? "🏆";
  const label = gameLabel(gameCategory);

  const scheduled = matches.filter((m) => m.status === "SCHEDULED" || m.status === "LIVE").length;
  const completed = matches.filter((m) => m.status === "COMPLETED").length;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">
            {matches.length} match{matches.length !== 1 ? "es" : ""}
            {scheduled > 0 && ` · ${scheduled} upcoming`}
            {completed > 0 && ` · ${completed} completed`}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
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
              <MatchRow key={match.id} match={match} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function MatchesFilter({
  matches,
  currentPage,
  totalPages,
  total,
  itemsPerPage,
}: MatchesFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");

  const statusFilter = searchParams.get("status") ?? "all";
  const tournamentFilter = searchParams.get("tournamentId") ?? "all";

  const tournaments = useMemo(
    () =>
      Array.from(
        new Map(matches.map((m) => [m.tournament.id, m.tournament.name])).entries()
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [matches]
  );

  const filteredMatches = useMemo(() => {
    if (!search) return matches;
    const q = search.toLowerCase();
    return matches.filter((m) => {
      const homeName = m.homePlayer?.name ?? m.homeTeam?.name ?? "";
      const awayName = m.awayPlayer?.name ?? m.awayTeam?.name ?? "";
      return (
        homeName.toLowerCase().includes(q) ||
        awayName.toLowerCase().includes(q) ||
        m.tournament.name.toLowerCase().includes(q) ||
        (m.round?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [matches, search]);

  // Group by game category, preserving order of first appearance
  const groupedMatches = useMemo(() => {
    const order: string[] = [];
    const groups: Record<string, Match[]> = {};
    for (const m of filteredMatches) {
      const cat = m.tournament.gameCategory;
      if (!groups[cat]) {
        groups[cat] = [];
        order.push(cat);
      }
      groups[cat].push(m);
    }
    return order.map((cat) => ({ gameCategory: cat, matches: groups[cat] }));
  }, [filteredMatches]);

  function updateFilters(updates: { status?: string; tournamentId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.status !== undefined) {
      updates.status === "all" ? params.delete("status") : params.set("status", updates.status);
    }
    if (updates.tournamentId !== undefined) {
      updates.tournamentId === "all"
        ? params.delete("tournamentId")
        : params.set("tournamentId", updates.tournamentId);
    }
    params.delete("page");
    router.push(`/admin/matches?${params.toString()}`);
  }

  function clearFilters() {
    setSearch("");
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

        <Select value={statusFilter} onValueChange={(value) => updateFilters({ status: value })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
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

      {filteredMatches.length === 0 ? (
        <div className="rounded-lg border border-border py-8 text-center text-muted-foreground text-sm">
          No matches match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedMatches.map(({ gameCategory, matches: groupMatches }) => (
            <GameSection key={gameCategory} gameCategory={gameCategory} matches={groupMatches} />
          ))}
        </div>
      )}

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
