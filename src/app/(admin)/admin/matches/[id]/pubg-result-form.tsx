"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trophy, Medal, GripVertical, Skull, ChevronDown, ChevronUp } from "lucide-react";
import { updatePUBGMatchResult } from "@/lib/actions/match";

interface Participant {
  id: string;
  teamId?: string | null;
  playerId?: string | null;
  team?: { name: string } | null;
  player?: { name: string } | null;
  placement: number | null;
  score: number | null;
}

interface PUBGResultFormProps {
  matchId: string;
  currentStatus: string;
  participants: Participant[];
  pointsPerKill: number;
  placementPoints: { placement: number; points: number }[];
}

const MEDAL_COLORS = [
  "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", // 1st
  "text-gray-300 bg-gray-300/10 border-gray-300/30",       // 2nd
  "text-orange-400 bg-orange-400/10 border-orange-400/30", // 3rd
];

export function PUBGResultForm({
  matchId,
  currentStatus,
  participants,
  pointsPerKill,
  placementPoints,
}: PUBGResultFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);

  // Ordered list = placement order. Index 0 = 1st place.
  const [ordered, setOrdered] = useState<Participant[]>(() =>
    [...participants].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
  );

  // Back-calculate kills from saved score: kills = (totalScore - placementPts) / pointsPerKill
  const [kills, setKills] = useState<Record<string, number>>(() => {
    const k: Record<string, number> = {};
    participants.forEach((p) => {
      const placePts = placementPoints.find((pp) => pp.placement === (p.placement ?? 1))?.points ?? 0;
      const savedKills = Math.max(0, Math.round(((p.score ?? 0) - placePts) / pointsPerKill));
      k[p.id] = savedKills;
    });
    return k;
  });

  // Drag state — source and current-hover indices
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getPlacementPoints = (placement: number) => {
    const pp = placementPoints.find((p) => p.placement === placement);
    return pp?.points ?? 0;
  };

  const getTotal = (participantId: string, placement: number) =>
    getPlacementPoints(placement) + (kills[participantId] ?? 0) * pointsPerKill;

  // ── Drag handlers ──────────────────────────────────────────
  function onDragStart(e: React.DragEvent, index: number) {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragItem.current === null || dragItem.current === index) return;
    dragOverItem.current = index;
    setDragOverIndex(index);
  }

  function onDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragItem.current;
    if (from === null || from === index) return;

    setOrdered((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(from, 1);
      next.splice(index, 0, dragged);
      return next;
    });

    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIndex(null);
  }

  function onDragEnd() {
    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIndex(null);
  }

  // ── Kill counter helpers ───────────────────────────────────
  function addKill(id: string, delta: number) {
    setKills((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }

  // ── Submit ─────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Build results: position in list = placement
    const results: Record<string, { placement: number; kills: number }> = {};
    ordered.forEach((p, i) => {
      results[p.id] = { placement: i + 1, kills: kills[p.id] ?? 0 };
    });

    const formData = new FormData();
    formData.set("status", "COMPLETED");
    formData.set("participants", JSON.stringify(results));

    startTransition(async () => {
      const res = await updatePUBGMatchResult(matchId, formData);
      if (res.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-md">
          ✓ Results saved — standings updated.
        </p>
      )}

      {/* Collapsible scoring reference */}
      <button
        type="button"
        onClick={() => setScoringOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-medium">Scoring system</span>
        {scoringOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {scoringOpen && (
        <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-xs">
          <div className="grid grid-cols-4 gap-x-4 gap-y-1 mb-2">
            {placementPoints.map((p) => (
              <div key={p.placement} className="flex justify-between gap-1">
                <span className="text-muted-foreground">#{p.placement}</span>
                <span className="font-semibold">{p.points}pts</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground border-t border-border pt-2">
            +{pointsPerKill} pt per kill
          </p>
        </div>
      )}

      {/* Instruction */}
      <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
        <GripVertical className="w-3.5 h-3.5" />
        Drag rows to set finish order — top = 1st place
      </p>

      {/* Player list */}
      <div className="space-y-1.5">
        {ordered.map((participant, index) => {
          const placement = index + 1;
          const name = participant.team?.name ?? participant.player?.name ?? "Unknown";
          const total = getTotal(participant.id, placement);
          const placePts = getPlacementPoints(placement);
          const killCount = kills[participant.id] ?? 0;
          const medalClass = MEDAL_COLORS[index] ?? "text-muted-foreground bg-muted/30 border-border/50";
          const isTop3 = index < 3;

          return (
            <div
              key={participant.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all select-none cursor-grab active:cursor-grabbing active:opacity-50 ${
                dragOverIndex === index && dragItem.current !== index
                  ? "border-primary border-2 bg-primary/5 scale-[1.01]"
                  : isTop3
                  ? `border-opacity-40 ${medalClass.split(" ").slice(2).join(" ")}`
                  : "border-border/50 bg-card/50"
              }`}
            >
              {/* Drag handle */}
              <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />

              {/* Placement badge */}
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-sm font-bold ${medalClass}`}>
                {placement <= 3 ? (
                  placement === 1 ? <Trophy className="w-4 h-4" /> :
                  <Medal className="w-4 h-4" />
                ) : (
                  <span>{placement}</span>
                )}
              </div>

              {/* Name + pts breakdown */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-sm truncate">{name}</p>
                  {placement === 1 && (
                    <span className="text-xs shrink-0">🐔</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {placePts}pts place
                  {killCount > 0 && ` + ${killCount * pointsPerKill}pts kills`}
                </p>
              </div>

              {/* Kill counter */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => addKill(participant.id, -1)}
                  className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-lg font-bold leading-none transition-colors"
                >
                  −
                </button>
                <div className="flex items-center gap-1 w-10 justify-center">
                  <Skull className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm font-semibold tabular-nums">{killCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => addKill(participant.id, 1)}
                  className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-lg font-bold leading-none transition-colors"
                >
                  +
                </button>
              </div>

              {/* Total */}
              <div className={`w-14 text-center shrink-0`}>
                <span className={`text-sm font-bold tabular-nums ${isTop3 ? medalClass.split(" ")[0] : ""}`}>
                  {total}
                </span>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live leaderboard summary */}
      <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Live standings preview</p>
        <div className="space-y-1">
          {[...ordered]
            .map((p, i) => ({
              p,
              placement: i + 1,
              total: getTotal(p.id, i + 1),
              killCount: kills[p.id] ?? 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map(({ p, placement, total, killCount }, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-3">{i + 1}.</span>
                  <span className="font-medium">{p.team?.name ?? p.player?.name}</span>
                  {placement === 1 && <span>🐔</span>}
                  <span className="text-muted-foreground">#{placement}</span>
                </div>
                <div className="flex items-center gap-2">
                  {killCount > 0 && (
                    <span className="text-muted-foreground">💀{killCount}</span>
                  )}
                  <span className="font-bold tabular-nums">{total}pts</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Results
      </Button>
    </form>
  );
}
