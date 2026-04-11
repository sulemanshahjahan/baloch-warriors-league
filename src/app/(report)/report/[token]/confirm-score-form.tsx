"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, Share2 } from "lucide-react";
import { confirmScore, disputeScore } from "@/lib/actions/score-report";
import { generateAndShareScorecard } from "@/lib/share-scorecard";
import { useRouter } from "next/navigation";

interface ConfirmScoreFormProps {
  token: string;
  reportId: string;
  homeScore: number;
  awayScore: number;
  homeName: string;
  awayName: string;
  tournamentName: string;
  matchId: string;
  round: string | null;
  matchNumber: number | null;
  homePhoto: string | null;
  awayPhoto: string | null;
}

export function ConfirmScoreForm({
  token,
  reportId,
  homeScore,
  awayScore,
  homeName,
  awayName,
  tournamentName,
  matchId,
  round,
  matchNumber,
  homePhoto,
  awayPhoto,
}: ConfirmScoreFormProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await confirmScore(token, reportId);
      if (result.success) {
        setConfirmed(true);
        router.refresh();
        // Auto-share scorecard
        const canvas = canvasRef.current;
        if (canvas) {
          try {
            await generateAndShareScorecard(canvas, {
              homeName, awayName, homeScore, awayScore,
              tournamentName, matchId, round, matchNumber,
              homePhoto, awayPhoto,
            });
          } catch { /* share failed, that's ok */ }
        }
      } else {
        setError(result.error ?? "Failed to confirm");
      }
    });
  }

  function handleDispute() {
    setError("");
    startTransition(async () => {
      const result = await disputeScore(token, reportId, disputeReason);
      if (result.success) {
        setDisputed(true);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to dispute");
      }
    });
  }

  if (confirmed) {
    return (
      <div className="space-y-4">
        <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm font-medium text-emerald-400">Score confirmed! Match completed.</p>
          <p className="text-3xl font-black mt-2">
            {homeScore} <span className="text-muted-foreground mx-1">–</span> {awayScore}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Standings and rankings have been updated.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={async () => {
            const canvas = canvasRef.current;
            if (canvas) {
              await generateAndShareScorecard(canvas, {
                homeName, awayName, homeScore, awayScore,
                tournamentName, matchId, round, matchNumber,
                homePhoto, awayPhoto,
              });
            }
          }}
        >
          <Share2 className="w-4 h-4" />
          Share Scorecard
        </Button>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    );
  }

  if (disputed) {
    return (
      <div className="text-center p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <p className="text-sm font-medium text-destructive">Score disputed</p>
        <p className="text-xs text-muted-foreground mt-2">
          The admin has been notified and will review the match.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center p-4 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground mb-2">Opponent submitted this score:</p>
        <p className="text-4xl font-black">
          {homeScore} <span className="text-muted-foreground mx-2">–</span> {awayScore}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {homeName} vs {awayName}
        </p>
      </div>

      <p className="text-sm text-center text-muted-foreground">
        Is this correct?
      </p>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md text-center">{error}</p>
      )}

      {!showDisputeForm ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDisputeForm(true)}
            disabled={isPending}
          >
            <X className="w-4 h-4" />
            Dispute
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder="What's the correct score? (optional)"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDisputeForm(false)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleDispute}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Submit Dispute
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
