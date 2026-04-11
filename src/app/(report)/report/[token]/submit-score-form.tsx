"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { submitScore } from "@/lib/actions/score-report";
import { useRouter } from "next/navigation";

interface SubmitScoreFormProps {
  token: string;
  homeName: string;
  awayName: string;
}

export function SubmitScoreForm({ token, homeName, awayName }: SubmitScoreFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const homeScore = Number(fd.get("homeScore"));
    const awayScore = Number(fd.get("awayScore"));

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      setError("Please enter valid scores");
      return;
    }

    startTransition(async () => {
      const result = await submitScore(token, homeScore, awayScore);
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to submit score");
      }
    });
  }

  if (success) {
    return (
      <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <p className="text-sm font-medium text-emerald-400">Score submitted!</p>
        <p className="text-xs text-muted-foreground mt-2">
          Waiting for your opponent to confirm. They have 24 hours to respond — after that, the score is auto-confirmed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Enter the final score of the match
      </p>

      <div className="grid grid-cols-3 items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="homeScore" className="text-xs text-center block">
            {homeName}
          </Label>
          <Input
            id="homeScore"
            name="homeScore"
            type="number"
            min={0}
            required
            className="text-center text-2xl font-bold h-14"
            placeholder="0"
          />
        </div>
        <div className="flex justify-center pb-3 text-muted-foreground text-2xl font-light">
          –
        </div>
        <div className="space-y-2">
          <Label htmlFor="awayScore" className="text-xs text-center block">
            {awayName}
          </Label>
          <Input
            id="awayScore"
            name="awayScore"
            type="number"
            min={0}
            required
            className="text-center text-2xl font-bold h-14"
            placeholder="0"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md text-center">{error}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Score
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Your opponent will be asked to confirm this score. If they don&apos;t respond within 24 hours, it&apos;s auto-confirmed.
      </p>
    </form>
  );
}
