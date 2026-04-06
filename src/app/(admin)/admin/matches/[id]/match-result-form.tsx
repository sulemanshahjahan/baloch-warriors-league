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
import { Loader2, Save } from "lucide-react";
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
  motmPlayerId: string | null;
  players: Player[];
}

export function MatchResultForm({
  matchId,
  currentStatus,
  homeScore,
  awayScore,
  homeScorePens,
  awayScorePens,
  motmPlayerId,
  players,
}: MatchResultFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [motm, setMotm] = useState<string>(motmPlayerId ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    formData.set("status", status);
    formData.set("motmPlayerId", motm);

    startTransition(async () => {
      const result = await updateMatchResult(matchId, formData);
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError((result as any).error ?? '');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 p-2 rounded-md">
          Result saved. Standings updated.
        </p>
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
          <Select value={motm} onValueChange={setMotm}>
            <SelectTrigger>
              <SelectValue placeholder="Select player..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        <Save className="w-4 h-4" />
        Save Result
      </Button>
    </form>
  );
}
