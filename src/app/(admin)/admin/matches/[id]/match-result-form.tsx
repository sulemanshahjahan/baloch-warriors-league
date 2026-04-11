"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Share2, MessageCircle } from "lucide-react";
import { updateMatchResult } from "@/lib/actions/match";

interface Player {
  id: string;
  name: string;
}

interface MatchResultFormProps {
  matchId: string;
  currentStatus: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePens: number | null;
  awayScorePens: number | null;
  homeClub: string | null;
  awayClub: string | null;
  homeFormation: string | null;
  awayFormation: string | null;
  isDerby: boolean;
  rivalNote: string | null;
  highlights: string | null;
  motmPlayerId: string | null;
  players: Player[];
  gameCategory: string;
  homeName: string;
  awayName: string;
  tournamentName: string;
  round: string | null;
}

export function MatchResultForm({
  matchId,
  currentStatus,
  homeScore,
  awayScore,
  homeScorePens,
  awayScorePens,
  homeClub,
  awayClub,
  homeFormation,
  awayFormation,
  isDerby: initialDerby,
  rivalNote,
  highlights,
  motmPlayerId,
  players,
  gameCategory,
  homeName,
  awayName,
  tournamentName,
  round,
}: MatchResultFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [motm, setMotm] = useState<string>(motmPlayerId ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedScores, setSavedScores] = useState<{ home: number; away: number } | null>(null);

  function buildWhatsAppUrl(hScore: number, aScore: number) {
    const shareUrl = `https://bwlleague.com/matches/${matchId}`;
    const scoreline = `${homeName} ${hScore}–${aScore} ${awayName}`;
    const shareText = [
      `🏆 ${tournamentName}`,
      round ? round : null,
      ``,
      `*FULL-TIME*`,
      `*${scoreline}*`,
      ``,
      `🔗 Match details:`,
      shareUrl,
    ]
      .filter((line) => line !== null)
      .join("\n");
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSavedScores(null);

    const formData = new FormData(e.currentTarget);
    formData.set("status", status);
    formData.set("motmPlayerId", motm);

    const hScore = Number(formData.get("homeScore"));
    const aScore = Number(formData.get("awayScore"));

    startTransition(async () => {
      const result = await updateMatchResult(matchId, formData);
      if (result.success) {
        setSuccess(true);
        if (status === "COMPLETED") {
          setSavedScores({ home: hScore, away: aScore });
          // Auto-open WhatsApp with pre-filled result
          window.open(buildWhatsAppUrl(hScore, aScore), "_blank");
        }
        router.refresh();
      } else {
        setError(result.error ?? '');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
      )}
      {success && (
        <div className="bg-emerald-400/10 border border-emerald-400/20 p-3 rounded-md space-y-2">
          <p className="text-sm text-emerald-400 font-medium">
            Result saved. Standings updated.
            {savedScores && " WhatsApp opened — just tap send!"}
          </p>
          {savedScores && (
            <div className="flex flex-wrap gap-2">
              <a
                href={buildWhatsAppUrl(savedScores.home, savedScores.away)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Re-share to WhatsApp
              </a>
              <a
                href={`/matches/${matchId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Scorecard Image
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="homeScore">Home Score</Label>
          <Input
            id="homeScore"
            name="homeScore"
            type="number"
            min={0}
            defaultValue={homeScore ?? ""}
            required
          />
        </div>
        <div className="flex justify-center pb-1 text-muted-foreground font-bold">
          –
        </div>
        <div className="space-y-2">
          <Label htmlFor="awayScore">Away Score</Label>
          <Input
            id="awayScore"
            name="awayScore"
            type="number"
            min={0}
            defaultValue={awayScore ?? ""}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="homeScorePens">Home Pens (optional)</Label>
          <Input
            id="homeScorePens"
            name="homeScorePens"
            type="number"
            min={0}
            defaultValue={homeScorePens ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awayScorePens">Away Pens (optional)</Label>
          <Input
            id="awayScorePens"
            name="awayScorePens"
            type="number"
            min={0}
            defaultValue={awayScorePens ?? ""}
          />
        </div>
      </div>

      {gameCategory === "EFOOTBALL" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="homeClub">Home Club</Label>
              <Input id="homeClub" name="homeClub" defaultValue={homeClub ?? ""} placeholder="e.g. Man City" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="awayClub">Away Club</Label>
              <Input id="awayClub" name="awayClub" defaultValue={awayClub ?? ""} placeholder="e.g. Bayern" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="homeFormation">Home Formation</Label>
              <Input id="homeFormation" name="homeFormation" defaultValue={homeFormation ?? ""} placeholder="e.g. 4-3-3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="awayFormation">Away Formation</Label>
              <Input id="awayFormation" name="awayFormation" defaultValue={awayFormation ?? ""} placeholder="e.g. 3-5-2" />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
        <input type="hidden" name="isDerby" value={initialDerby ? "true" : "false"} />
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            name="isDerbyCheck"
            defaultChecked={initialDerby}
            className="rounded"
            onChange={(e) => {
              const hidden = e.target.form?.querySelector('input[name="isDerby"]') as HTMLInputElement;
              if (hidden) hidden.value = e.target.checked ? "true" : "false";
            }}
          />
          🔥 Derby / Rivalry Match
        </label>
        <Input name="rivalNote" defaultValue={rivalNote ?? ""} placeholder="Rivalry note (optional)" className="flex-1 h-8 text-xs" />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="LIVE">Live</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="POSTPONED">Postponed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          <Label>Man of the Match</Label>
          <Select value={motm || "none"} onValueChange={(v) => setMotm(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select player..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {gameCategory === "EFOOTBALL" && players.length > 0 && (
        <div className="space-y-2">
          <Label>Player Ratings (1–10)</Label>
          <div className="grid grid-cols-2 gap-2">
            {players.slice(0, 2).map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs truncate flex-1">{p.name}</span>
                <Input
                  name={`rating_${p.id}`}
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  placeholder="—"
                  className="w-16 h-8 text-xs text-center"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="highlights">Match Summary / Highlights</Label>
        <Textarea
          id="highlights"
          name="highlights"
          defaultValue={highlights ?? ""}
          placeholder="Write a brief match summary, key moments, talking points..."
          rows={3}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">Shown on the public match detail page.</p>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        <Save className="w-4 h-4" />
        Save Result
      </Button>
    </form>
  );
}
