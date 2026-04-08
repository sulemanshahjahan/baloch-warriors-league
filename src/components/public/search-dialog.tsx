"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Shield, Trophy, ArrowRight } from "lucide-react";
import { SmartAvatar } from "./smart-avatar";
import { gameLabel } from "@/lib/utils";

interface SearchResults {
  players: Array<{ id: string; name: string; slug: string; position: string | null }>;
  teams: Array<{ id: string; name: string; slug: string; shortName: string | null }>;
  tournaments: Array<{ id: string; name: string; slug: string; gameCategory: string; status: string }>;
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  // Build flat list of all results for keyboard nav
  const allItems: Array<{ href: string; label: string; type: string }> = [];
  if (results) {
    for (const p of results.players) allItems.push({ href: `/players/${p.slug}`, label: p.name, type: "player" });
    for (const t of results.teams) allItems.push({ href: `/teams/${t.slug}`, label: t.name, type: "team" });
    for (const t of results.tournaments) allItems.push({ href: `/tournaments/${t.slug}`, label: t.name, type: "tournament" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      navigate(allItems[selectedIndex].href);
    }
  }

  const totalResults = results ? results.players.length + results.teams.length + results.tournaments.length : 0;
  let flatIdx = 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-sm text-muted-foreground"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setResults(null); } }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search players, teams, tournaments..."
              className="border-0 focus-visible:ring-0 h-12 text-sm"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
            )}

            {!loading && query.length >= 2 && totalResults === 0 && (
              <div className="p-8 text-sm text-muted-foreground text-center">
                No results for &quot;{query}&quot;
              </div>
            )}

            {!loading && results && totalResults > 0 && (
              <div className="py-2">
                {results.players.length > 0 && (
                  <div>
                    <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</p>
                    {results.players.map((p) => {
                      const idx = flatIdx++;
                      return (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/players/${p.slug}`)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors ${idx === selectedIndex ? "bg-muted/50" : ""}`}
                        >
                          <SmartAvatar type="player" id={p.id} name={p.name} className="h-7 w-7" fallbackClassName="text-[10px]" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            {p.position && <p className="text-xs text-muted-foreground">{p.position}</p>}
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {results.teams.length > 0 && (
                  <div>
                    <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teams</p>
                    {results.teams.map((t) => {
                      const idx = flatIdx++;
                      return (
                        <button
                          key={t.id}
                          onClick={() => navigate(`/teams/${t.slug}`)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors ${idx === selectedIndex ? "bg-muted/50" : ""}`}
                        >
                          <SmartAvatar type="team" id={t.id} name={t.name} className="h-7 w-7" fallbackClassName="text-[10px]" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            {t.shortName && <p className="text-xs text-muted-foreground">{t.shortName}</p>}
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {results.tournaments.length > 0 && (
                  <div>
                    <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tournaments</p>
                    {results.tournaments.map((t) => {
                      const idx = flatIdx++;
                      return (
                        <button
                          key={t.id}
                          onClick={() => navigate(`/tournaments/${t.slug}`)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors ${idx === selectedIndex ? "bg-muted/50" : ""}`}
                        >
                          <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{gameLabel(t.gameCategory)}</p>
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!loading && query.length < 2 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Type at least 2 characters to search
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
