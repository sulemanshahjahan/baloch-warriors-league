"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { bulkUpdateMatchResults } from "@/lib/actions/match";

interface PendingMatch {
  id: string;
  round: string | null;
  homePlayer: { name: string } | null;
  awayPlayer: { name: string } | null;
  homeTeam: { name: string; shortName: string | null } | null;
  awayTeam: { name: string; shortName: string | null } | null;
  tournament: { name: string };
}

export default function BulkMatchEntryPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matches, setMatches] = useState<PendingMatch[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ updated: number; errors: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/matches?status=SCHEDULED&limit=50")
      .then((r) => r.json())
      .then((res) => {
        const data = res.matches ?? res;
        const pending = (data as PendingMatch[]).filter(
          (m: any) => m.status === "SCHEDULED"
        );
        setMatches(pending);
        const initial: Record<string, { home: string; away: string }> = {};
        for (const m of pending) initial[m.id] = { home: "", away: "" };
        setScores(initial);
      })
      .catch(() => setError("Failed to load matches"))
      .finally(() => setLoading(false));
  }, []);

  function updateScore(matchId: string, side: "home" | "away", value: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value },
    }));
  }

  function handleSubmit() {
    // Collect only matches with both scores filled
    const toSave = Object.entries(scores)
      .filter(([, s]) => s.home !== "" && s.away !== "")
      .map(([matchId, s]) => ({
        matchId,
        homeScore: parseInt(s.home, 10),
        awayScore: parseInt(s.away, 10),
      }))
      .filter((r) => !isNaN(r.homeScore) && !isNaN(r.awayScore) && r.homeScore >= 0 && r.awayScore >= 0);

    if (toSave.length === 0) {
      setError("Enter scores for at least one match.");
      return;
    }

    setError("");
    setResult(null);

    startTransition(async () => {
      const res = await bulkUpdateMatchResults(toSave);
      if (res.success && res.data) {
        setResult(res.data);
        // Remove saved matches from list
        const savedIds = new Set(toSave.map((s) => s.matchId));
        setMatches((prev) => prev.filter((m) => !savedIds.has(m.id)));
        router.refresh();
      } else {
        setError(res.error ?? "Failed to save");
      }
    });
  }

  const filledCount = Object.values(scores).filter((s) => s.home !== "" && s.away !== "").length;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Bulk Result Entry" description="Enter multiple match scores at once" />

      <main className="flex-1 p-6 space-y-6">
        <Link href="/admin/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Matches
        </Link>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">{error}</div>
        )}

        {result && (
          <div className="p-3 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Saved {result.updated} of {result.total} matches.
            {result.errors > 0 && ` (${result.errors} failed)`}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Pending Matches ({matches.length})
              </CardTitle>
              <Button onClick={handleSubmit} disabled={isPending || filledCount === 0} size="sm">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save {filledCount > 0 ? `${filledCount} Result${filledCount > 1 ? "s" : ""}` : "Results"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading matches...</div>
            ) : matches.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No pending matches to enter results for.</div>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => {
                  const homeName = match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD";
                  const awayName = match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD";
                  const s = scores[match.id];

                  return (
                    <div key={match.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      {/* Tournament + Round */}
                      <div className="w-32 shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground truncate">{match.tournament.name}</p>
                        {match.round && <p className="text-[10px] text-muted-foreground/60">{match.round}</p>}
                      </div>

                      {/* Home */}
                      <span className="flex-1 text-sm font-medium text-right truncate">{homeName}</span>

                      {/* Score inputs */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          value={s?.home ?? ""}
                          onChange={(e) => updateScore(match.id, "home", e.target.value)}
                          className="w-14 h-9 text-center text-sm font-bold"
                          placeholder="—"
                        />
                        <span className="text-muted-foreground text-xs">–</span>
                        <Input
                          type="number"
                          min={0}
                          value={s?.away ?? ""}
                          onChange={(e) => updateScore(match.id, "away", e.target.value)}
                          className="w-14 h-9 text-center text-sm font-bold"
                          placeholder="—"
                        />
                      </div>

                      {/* Away */}
                      <span className="flex-1 text-sm font-medium truncate">{awayName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
