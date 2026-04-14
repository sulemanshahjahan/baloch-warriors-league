"use client";

import { useState, useTransition, useRef } from "react";
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
import { Loader2, Save, Share2 } from "lucide-react";
import { updateMatchResult } from "@/lib/actions/match";
import { generateAndShareScorecard } from "@/lib/share-scorecard";

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
  matchNumber: number | null;
  homePhoto: string | null;
  awayPhoto: string | null;
  // Knockout leg fields
  isKnockout: boolean;
  leg2HomeScore: number | null;
  leg2AwayScore: number | null;
  leg3HomeScore: number | null;
  leg3AwayScore: number | null;
  leg3HomePens: number | null;
  leg3AwayPens: number | null;
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
  matchNumber,
  homePhoto,
  awayPhoto,
  isKnockout,
  leg2HomeScore: initialLeg2Home,
  leg2AwayScore: initialLeg2Away,
  leg3HomeScore: initialLeg3Home,
  leg3AwayScore: initialLeg3Away,
  leg3HomePens: initialLeg3HomePens,
  leg3AwayPens: initialLeg3AwayPens,
}: MatchResultFormProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [motm, setMotm] = useState<string>(motmPlayerId ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedScores, setSavedScores] = useState<{ home: number; away: number } | null>(null);

  async function autoShareScorecard(hScore: number, aScore: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await generateAndShareScorecard(canvas, {
        homeName, awayName, homeScore: hScore, awayScore: aScore,
        tournamentName, matchId, round, matchNumber,
        homePhoto, awayPhoto,
      });
    } catch {
      // Fallback: open WhatsApp with text only
      const shareUrl = `https://bwlleague.com/matches/${matchId}`;
      const scoreline = `${homeName} ${hScore}–${aScore} ${awayName}`;
      const shareText = [
        `🏆 ${tournamentName}`, round || null, ``,
        `*FULL-TIME*`, `*${scoreline}*`, ``,
        `🔗 Match details:`, shareUrl,
      ].filter((line) => line !== null).join("\n");
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    }
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
          // Auto-generate scorecard image and open share dialog
          autoShareScorecard(hScore, aScore);
        }
        router.refresh();
      } else {
        setError((result as { error?: string }).error ?? '');
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
            {savedScores && " Share dialog opened!"}
          </p>
          {savedScores && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => autoShareScorecard(savedScores.home, savedScores.away)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Re-share Scorecard
              </button>
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

      {/* Knockout 2-Leg Section */}
      {isKnockout && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">2-Leg Knockout</p>
          <p className="text-[10px] text-muted-foreground">Leg 1 scores are the Home/Away scores above. Enter Leg 2 and Decider below.</p>

          <div className="grid grid-cols-3 items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="leg2HomeScore" className="text-xs">{homeName} (Leg 2)</Label>
              <Input id="leg2HomeScore" name="leg2HomeScore" type="number" min={0} defaultValue={initialLeg2Home ?? ""} className="h-9" />
            </div>
            <div className="flex justify-center pb-1.5 text-muted-foreground text-sm font-bold">–</div>
            <div className="space-y-1">
              <Label htmlFor="leg2AwayScore" className="text-xs">{awayName} (Leg 2)</Label>
              <Input id="leg2AwayScore" name="leg2AwayScore" type="number" min={0} defaultValue={initialLeg2Away ?? ""} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-3 items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="leg3HomeScore" className="text-xs">{homeName} (Decider)</Label>
              <Input id="leg3HomeScore" name="leg3HomeScore" type="number" min={0} defaultValue={initialLeg3Home ?? ""} className="h-9" />
            </div>
            <div className="flex justify-center pb-1.5 text-muted-foreground text-sm font-bold">–</div>
            <div className="space-y-1">
              <Label htmlFor="leg3AwayScore" className="text-xs">{awayName} (Decider)</Label>
              <Input id="leg3AwayScore" name="leg3AwayScore" type="number" min={0} defaultValue={initialLeg3Away ?? ""} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="leg3HomePens" className="text-xs">Decider Pens (Home)</Label>
              <Input id="leg3HomePens" name="leg3HomePens" type="number" min={0} defaultValue={initialLeg3HomePens ?? ""} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="leg3AwayPens" className="text-xs">Decider Pens (Away)</Label>
              <Input id="leg3AwayPens" name="leg3AwayPens" type="number" min={0} defaultValue={initialLeg3AwayPens ?? ""} className="h-9" />
            </div>
          </div>
        </div>
      )}

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

      {/* Hidden canvas for scorecard image generation */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </form>
  );
}
