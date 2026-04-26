"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { recomputeCardRanks } from "@/lib/actions/card-rank";

export function RecomputeRanksButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ changed: number; total: number; draftNewsId?: string } | null>(null);
  const [error, setError] = useState("");

  function handleRun() {
    setError("");
    setResult(null);
    startTransition(async () => {
      const r = await recomputeCardRanks();
      if (r.success) {
        setResult({ changed: r.changed, total: r.totalProcessed, draftNewsId: r.draftNewsId });
        router.refresh();
      } else {
        setError(r.error ?? "Failed to recompute card ranks");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="w-4 h-4 mr-1" />
          Recompute Card Ranks
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recompute Card Ranks</DialogTitle>
          <DialogDescription>
            Recalculates every active player&apos;s card rank from current stats (ELO, win rate, clean sheets, goal diff).
            <br />
            <br />
            This will:
            <ul className="list-disc ml-5 mt-2 space-y-1 text-xs">
              <li>Save a rank-change record for every player whose rank shifts (with the stat breakdown)</li>
              <li>Send one summary push notification</li>
              <li>Create a <strong>draft</strong> news post — review and publish it from the News admin</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
            <p>
              Processed <strong>{result.total}</strong> players.{" "}
              <strong>{result.changed}</strong> rank{result.changed === 1 ? "" : "s"} changed.
            </p>
            {result.draftNewsId && (
              <p className="text-muted-foreground">
                Draft news post created — visit <code>/admin/news</code> to review and publish.
              </p>
            )}
            {result.changed === 0 && (
              <p className="text-muted-foreground">No ranks changed — all players already at their computed rank.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleRun} disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Run Recompute
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpen(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
