"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords, Calendar, ArrowRight, ChevronLeft, ChevronRight, Search, X, ArrowDownUp, Trophy, Gamepad2 } from "lucide-react";
import {
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  getRoundDisplayName,
} from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { DuoTeamAvatar } from "@/components/public/duo-team-avatar";

type Facets = { tournaments: { slug: string; name: string; gameCategory: string }[]; games: string[] };

type Match = {
  id: string;
  status: string;
  scheduledAt: string | null;
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePens: number | null;
  awayScorePens: number | null;
  leg2HomeScore: number | null;
  leg2AwayScore: number | null;
  leg3HomeScore: number | null;
  leg3AwayScore: number | null;
  leg3HomePens: number | null;
  leg3AwayPens: number | null;
  completedAt: string | null;
  tournament: { name: string; slug: string; gameCategory: string };
  homeTeam: { id: string; name: string; shortName: string | null; isDuo?: boolean; players?: { player: { id: string; name: string; photoUrl: string | null } }[] } | null;
  awayTeam: { id: string; name: string; shortName: string | null; isDuo?: boolean; players?: { player: { id: string; name: string; photoUrl: string | null } }[] } | null;
  homePlayer: { id: string; name: string } | null;
  awayPlayer: { id: string; name: string } | null;
};

const ITEMS_PER_PAGE = 10;

function MatchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-28 rounded-lg bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isCompleted = match.status === "COMPLETED";
  const isLive = match.status === "LIVE";
  const hasPens = match.homeScorePens != null && match.awayScorePens != null;
  const has2Legs = match.leg2HomeScore != null;

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate max-w-[160px]">
                {match.tournament.name}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${gameColor(match.tournament.gameCategory)}`}>
                {gameLabel(match.tournament.gameCategory)}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor(match.status)}`}>
              {isLive ? "LIVE" : statusLabel(match.status)}
            </span>
          </div>

          {match.round && (
            <div className="text-center mb-3">
              <span className="text-sm font-semibold text-primary">
                {getRoundDisplayName(match.round, match.roundNumber, match.matchNumber)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              {match.homePlayer ? (
                <SmartAvatar type="player" id={match.homePlayer.id} name={homeName} className="h-12 w-12 shrink-0" fallbackClassName="text-sm" />
              ) : match.homeTeam ? (
                <DuoTeamAvatar id={match.homeTeam.id} name={homeName} isDuo={match.homeTeam.isDuo} members={match.homeTeam.players?.map((p) => p.player)} className="h-12 w-12 shrink-0" memberClassName="h-9 w-9" fallbackClassName="text-xs" />
              ) : null}
              <p className="font-medium text-xs text-center leading-tight line-clamp-2 w-full">{homeName}</p>
            </div>

            <div className="text-center shrink-0 px-1">
              {isCompleted || isLive ? (
                <div>
                  {has2Legs ? (
                    <>
                      <span className="text-2xl font-black whitespace-nowrap">
                        {(match.homeScore ?? 0) + (match.leg2HomeScore ?? 0)} - {(match.awayScore ?? 0) + (match.leg2AwayScore ?? 0)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">Agg</p>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-black whitespace-nowrap">
                        {match.homeScore ?? 0} - {match.awayScore ?? 0}
                      </span>
                      {hasPens && (
                        <p className="text-xs text-muted-foreground whitespace-nowrap">({match.homeScorePens}–{match.awayScorePens} pens)</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground font-medium">vs</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              {match.awayPlayer ? (
                <SmartAvatar type="player" id={match.awayPlayer.id} name={awayName} className="h-12 w-12 shrink-0" fallbackClassName="text-sm" />
              ) : match.awayTeam ? (
                <DuoTeamAvatar id={match.awayTeam.id} name={awayName} isDuo={match.awayTeam.isDuo} members={match.awayTeam.players?.map((p) => p.player)} className="h-12 w-12 shrink-0" memberClassName="h-9 w-9" fallbackClassName="text-xs" />
              ) : null}
              <p className="font-medium text-xs text-center leading-tight line-clamp-2 w-full">{awayName}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            {match.scheduledAt ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {formatDateTime(new Date(match.scheduledAt))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Date TBD</span>
            )}
            <span className="text-sm text-primary flex items-center gap-1">
              Details <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ message = "No matches found." }: { message?: string }) {
  return (
    <div className="text-center py-16">
      <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export function MatchesClient() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [facets, setFacets] = useState<Facets>({ tournaments: [], games: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [tab, setTab] = useState("all"); // status quick filter
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounced search
  const [sort, setSort] = useState("latest");
  const [game, setGame] = useState("all");
  const [tournament, setTournament] = useState("all");

  // Debounce the search box → q
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const statusOf = (t: string) =>
    t === "upcoming" ? "SCHEDULED" : t === "completed" ? "COMPLETED" : t === "live" ? "LIVE" : undefined;

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE), sort });
      const status = statusOf(tab);
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      if (game !== "all") params.set("game", game);
      if (tournament !== "all") params.set("tournament", tournament);
      const res = await fetch(`/api/matches?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMatches(data.matches);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.facets) setFacets(data.facets);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, tab, q, sort, game, tournament]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const resetPage = () => setPage(1);
  const hasFilters = q !== "" || game !== "all" || tournament !== "all" || sort !== "latest" || tab !== "all";
  const clearAll = () => { setSearch(""); setQ(""); setGame("all"); setTournament("all"); setSort("latest"); setTab("all"); setPage(1); };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">Matches</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">All Fixtures &amp; Results</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">Search, filter and sort every BWL match.</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter bar */}
        <div className="space-y-3 mb-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player, duo or tournament…"
              className="pl-9 pr-9 h-11"
              inputMode="search"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Select value={sort} onValueChange={(v) => { setSort(v); resetPage(); }}>
              <SelectTrigger className="h-10"><ArrowDownUp className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="goals">Most goals</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tournament} onValueChange={(v) => { setTournament(v); resetPage(); }}>
              <SelectTrigger className="h-10"><Trophy className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" /><SelectValue placeholder="Tournament" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tournaments</SelectItem>
                {facets.tournaments.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={game} onValueChange={(v) => { setGame(v); resetPage(); }}>
              <SelectTrigger className="h-10 col-span-2 sm:col-span-1"><Gamepad2 className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" /><SelectValue placeholder="Game" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All games</SelectItem>
                {facets.games.map((g) => (
                  <SelectItem key={g} value={g}>{gameLabel(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status tabs */}
          <Tabs value={tab} onValueChange={(v) => { setTab(v); resetPage(); }}>
            <TabsList className="bg-muted/50 w-full grid grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="completed">Results</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Result count + clear */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${total} match${total === 1 ? "" : "es"}`}
            </span>
            {hasFilters && (
              <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Failed to load matches. Please refresh.</p>
          </div>
        ) : loading ? (
          <MatchSkeleton />
        ) : matches.length === 0 ? (
          <EmptyState message={q ? `No matches found for “${q}”.` : "No matches match your filters."} />
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
