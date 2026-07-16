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
import { Loader2, Sparkles, Eye, ArrowRight } from "lucide-react";
import { previewCardRanks, recomputeCardRanks } from "@/lib/actions/card-rank";

type PreviewChange = {
  playerId: string;
  name: string;
  slug: string;
  oldRank: number;
  newRank: number;
  delta: number;
  reason: string;
};

export function RecomputeRanksButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ changes: PreviewChange[]; total: number } | null>(null);
  const [result, setResult] = useState<{ changed: number; total: number; draftNewsId?: string } | null>(null);
  const [error, setError] = useState("");

  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  function handlePreview() {
    setError("");
    setResult(null);
    startTransition(async () => {
      const r = await previewCardRanks();
      if (r.success) {
        setPreview({ changes: r.changes, total: r.totalProcessed });
      } else {
        setError(r.error ?? "Failed to preview card ranks");
      }
    });
  }

  function handleApply() {
    setError("");
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

  const ups = preview?.changes.filter((c) => c.delta > 0).length ?? 0;
  const downs = preview?.changes.filter((c) => c.delta < 0).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="w-4 h-4 mr-1" />
          Recompute Card Ranks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recompute Card Ranks</DialogTitle>
          <DialogDescription>
            {result
              ? "Done."
              : preview
                ? "Dry run only — nothing has been saved yet. Review the changes below, then apply."
                : "Preview first: this dry run calculates every active player's rank from current stats (ELO, win rate, clean sheets, goal diff) without saving anything."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Dry-run result */}
        {preview && !result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
                {preview.total} players checked
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                {ups} up
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                {downs} down
              </span>
            </div>

            {preview.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                No ranks would change — every player is already at their computed rank.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
                {preview.changes
                  .slice()
                  .sort((a, b) => b.delta - a.delta)
                  .map((c) => (
                    <div key={c.playerId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <span className="text-muted-foreground">{c.oldRank}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="font-bold">{c.newRank}</span>
                        <span
                          className={`text-xs font-bold w-8 text-right ${
                            c.delta > 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {c.delta > 0 ? "+" : ""}
                          {c.delta}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {preview.changes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Applying will save a rank-change record per player, send one summary push, and create a{" "}
                <strong>draft</strong> news post to review in News admin.
              </p>
            )}
          </div>
        )}

        {/* Applied result */}
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
          {result ? (
            <Button onClick={() => setOpen(false)}>Close</Button>
          ) : !preview ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                Dry Run (Preview)
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset} disabled={isPending}>
                Back
              </Button>
              <Button onClick={handleApply} disabled={isPending || preview.changes.length === 0}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Apply {preview.changes.length > 0 ? `${preview.changes.length} Change${preview.changes.length === 1 ? "" : "s"}` : "Changes"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
