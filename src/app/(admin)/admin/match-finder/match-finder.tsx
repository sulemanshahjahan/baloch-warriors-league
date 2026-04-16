"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Save, ExternalLink, Share2 } from "lucide-react";
import { updateMatchResult } from "@/lib/actions/match";
import { generateAndShareScorecard } from "@/lib/share-scorecard";
import Link from "next/link";

interface Player {
  id: string;
  name: string;
  slug: string;
}

interface Tournament {
  id: string;
  name: string;
}

interface MatchResult {
  id: string;
  round: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  leg2HomeScore: number | null;
  leg2AwayScore: number | null;
  leg3HomeScore: number | null;
  leg3AwayScore: number | null;
  scheduledAt: string | null;
  completedAt: string | null;
  tournament: { name: string };
  homePlayer: { id: string; name: string; photoUrl: string | null } | null;
  awayPlayer: { id: string; name: string; photoUrl: string | null } | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
}

interface MatchFinderProps {
  players: Player[];
  tournaments: Tournament[];
}

export function MatchFinder({ players, tournaments }: MatchFinderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [tournamentFilter, setTournamentFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Filter players as user types
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = players.filter((p) =>
      p.name.toLowerCase().includes(q)
    ).slice(0, 8);
    setSuggestions(filtered);
    setShowSuggestions(true);
  }, [query, players]);

  // Fetch matches when player is selected
  useEffect(() => {
    if (!selectedPlayer) {
      setMatches([]);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set("playerId", selectedPlayer.id);
    if (tournamentFilter) params.set("tournamentId", tournamentFilter);

    fetch(`/api/matches/by-player?${params}`)
      .then((r) => r.json())
      .then((data) => setMatches(data.matches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [selectedPlayer, tournamentFilter]);

  function selectPlayer(player: Player) {
    setSelectedPlayer(player);
    setQuery(player.name);
    setShowSuggestions(false);
  }

  function clearSearch() {
    setQuery("");
    setSelectedPlayer(null);
    setMatches([]);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-4xl space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedPlayer && e.target.value !== selectedPlayer.name) {
                  setSelectedPlayer(null);
                }
              }}
              onFocus={() => query.length >= 1 && setShowSuggestions(true)}
              placeholder="Type player name..."
              className="pl-10 h-12 text-lg"
              autoFocus
            />
            {selectedPlayer && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {tournaments.length > 1 && (
            <select
              value={tournamentFilter}
              onChange={(e) => setTournamentFilter(e.target.value)}
              className="h-12 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All Tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && !selectedPlayer && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p)}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">Select</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedPlayer && !loading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {matches.length} match{matches.length !== 1 ? "es" : ""} for <span className="font-semibold text-foreground">{selectedPlayer.name}</span>
          </p>

          {matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}

          {matches.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No matches found.</p>
          )}
        </div>
      )}

      {!selectedPlayer && !loading && (
        <p className="text-center text-muted-foreground py-12">
          Start typing a player name to find their matches
        </p>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: MatchResult }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPending, startTransition] = useTransition();
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedScores, setSavedScores] = useState<{ h: number; a: number } | null>(null);

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const isCompleted = match.status === "COMPLETED";
  const has2Legs = match.leg2HomeScore != null;

  const displayHome = has2Legs
    ? (match.homeScore ?? 0) + (match.leg2HomeScore ?? 0) + (match.leg3HomeScore ?? 0)
    : (match.homeScore ?? 0);
  const displayAway = has2Legs
    ? (match.awayScore ?? 0) + (match.leg2AwayScore ?? 0) + (match.leg3AwayScore ?? 0)
    : (match.awayScore ?? 0);

  async function shareScorecard(h: number, a: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await generateAndShareScorecard(canvas, {
        homeName, awayName, homeScore: h, awayScore: a,
        tournamentName: match.tournament.name,
        matchId: match.id, round: match.round, matchNumber: null,
        homePhoto: match.homePlayer?.photoUrl ?? null,
        awayPhoto: match.awayPlayer?.photoUrl ?? null,
      });
    } catch { /* share failed */ }
  }

  function handleQuickScore() {
    const h = parseInt(homeScore), a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    const fd = new FormData();
    fd.set("homeScore", homeScore);
    fd.set("awayScore", awayScore);
    fd.set("status", "COMPLETED");

    startTransition(async () => {
      const result = await updateMatchResult(match.id, fd);
      if (result.success) {
        setSaved(true);
        setSavedScores({ h, a });
        router.refresh();
        // Auto-open share dialog
        shareScorecard(h, a);
      }
    });
  }

  if (saved) {
    return (
      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
        <p className="text-sm text-emerald-400">
          {homeName} {savedScores?.h} - {savedScores?.a} {awayName} — Saved!
        </p>
        {savedScores && (
          <button
            onClick={() => shareScorecard(savedScores.h, savedScores.a)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Re-share Scorecard
          </button>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {homeName} {homeScore} - {awayScore} {awayName} — Saved!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/30 transition-colors">
      {/* Match info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{homeName}</span>
          {isCompleted ? (
            <span className="text-sm font-black shrink-0">
              {displayHome} - {displayAway}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground shrink-0">vs</span>
          )}
          <span className="text-sm font-medium truncate">{awayName}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground truncate">{match.tournament.name}</span>
          {match.round && <span className="text-[10px] text-muted-foreground">· {match.round}</span>}
          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${isCompleted ? "text-emerald-400 border-emerald-400/30" : "text-amber-400 border-amber-400/30"}`}>
            {match.status}
          </Badge>
          {has2Legs && <Badge variant="outline" className="text-[10px] px-1 py-0">Agg</Badge>}
        </div>
      </div>

      {/* Quick score entry for non-completed */}
      {!isCompleted && (
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number" min={0} placeholder="H"
            value={homeScore} onChange={(e) => setHomeScore(e.target.value)}
            className="w-12 h-7 text-center text-xs"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="number" min={0} placeholder="A"
            value={awayScore} onChange={(e) => setAwayScore(e.target.value)}
            className="w-12 h-7 text-center text-xs"
          />
          <Button size="sm" onClick={handleQuickScore} disabled={isPending} className="h-7 px-2">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </Button>
        </div>
      )}

      {/* Link to full match page */}
      <Link href={`/admin/matches/${match.id}`} className="shrink-0">
        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      </Link>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
