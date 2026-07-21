"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Layers } from "lucide-react";
import {
  generateStage1Groups,
  closeStage1,
  computeStage2Seeds,
  generateStage2Draw,
  generateStage2Knockout,
} from "@/lib/actions/stage-progression";

type Stage = { id: string; name: string; kind: string; orderIndex: number };
type Seed = { seed: number; playerId: string; name: string; source: string };

export function StageProgressionPanel({
  tournamentId,
  stages,
}: {
  tournamentId: string;
  stages: Stage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [seeds, setSeeds] = useState<Seed[] | null>(null);

  const run = (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg({ ok: res.success, text: res.success ? "Done." : res.error ?? "Failed" });
      if (res.success) router.refresh();
    });
  };

  const preview = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await computeStage2Seeds(tournamentId);
      if (res.ok) setSeeds(res.seeds);
      else setMsg({ ok: false, text: res.error });
    });
  };

  const has = (kind: string, order?: number) =>
    stages.some((s) => s.kind === kind && (order === undefined || s.orderIndex === order));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" /> Multi-stage (BWL Cup)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          20 players → 4 groups of 5 → playoff (4th-placers) → 2 groups of 7 → knockout.
          Enroll exactly 20 players, then run each step once its predecessor is complete.
        </p>

        {stages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...stages].sort((a, b) => a.orderIndex - b.orderIndex).map((s) => (
              <span key={s.id} className="text-[11px] rounded border border-border bg-muted/40 px-2 py-0.5">
                {s.orderIndex}. {s.name} <span className="text-muted-foreground">({s.kind})</span>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => generateStage1Groups(tournamentId))}>
            1. Generate Stage 1 (4×5)
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !has("GROUP", 0)} onClick={() => run(() => closeStage1(tournamentId))}>
            2. Close Stage 1 → Playoff
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !has("PLAYOFF")} onClick={preview}>
            3a. Preview Stage 2 seeds
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !has("PLAYOFF")} onClick={() => run(() => generateStage2Draw(tournamentId))}>
            3b. Generate Stage 2 draw
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !has("GROUP", 2)} onClick={() => run(() => generateStage2Knockout(tournamentId))}>
            4. Generate Knockout
          </Button>
        </div>

        {pending && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Working…
          </p>
        )}
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-500" : "text-destructive"}`}>{msg.text}</p>
        )}

        {seeds && (
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium mb-2">Stage 2 seed list (snake: X = 1,4,5,8,9,12,13 · Y = 2,3,6,7,10,11,14)</p>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              {seeds.map((s) => (
                <li key={s.seed} className="flex justify-between gap-2">
                  <span><span className="text-muted-foreground">{s.seed}.</span> {s.name}</span>
                  <span className="text-muted-foreground">{s.source}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => { setSeeds(null); run(() => generateStage2Draw(tournamentId)); }}>
                Confirm & generate draw
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSeeds(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
