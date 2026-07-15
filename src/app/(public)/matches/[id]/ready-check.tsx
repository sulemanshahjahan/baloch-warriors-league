"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { POLL_INTERVAL_MS, type RandomTeam } from "@/lib/randomTeams";

// Mirrors ReadyStateDTO in src/lib/match-ready.ts.
interface ReadyState {
  matchId: string;
  enabled: boolean;
  serverTime: string;
  lockDurationMs: number;
  viewerSide: "home" | "away" | null;
  home: { name: string; ready: boolean };
  away: { name: string; ready: boolean };
  assignedTeam: RandomTeam | null;
  assignedAt: string | null;
  lockedUntil: string | null;
  locked: boolean;
  stale: boolean;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MatchReadyCheck({ initialState }: { initialState: ReadyState }) {
  const [state, setState] = useState<ReadyState>(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0); // forces a re-render for the countdown

  // Offset between the server clock and this browser's clock, refreshed on
  // every response. The countdown is cosmetic — the server owns the lock.
  const offsetRef = useRef(0);
  const matchId = initialState.matchId;

  const apply = useCallback((dto: ReadyState) => {
    offsetRef.current = new Date(dto.serverTime).getTime() - Date.now();
    setState(dto);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/ready-state`, { cache: "no-store" });
      if (res.ok) apply(await res.json());
    } catch {
      /* transient — the next poll will retry */
    }
  }, [matchId, apply]);

  // Poll for the opponent's changes while the page is open.
  useEffect(() => {
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // 1s ticker for the countdown; when the lock elapses, pull fresh state once
  // so the buttons re-enable from the server's truth (not the local clock).
  const lockExpiredRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (state.locked && state.lockedUntil) {
        const remaining = new Date(state.lockedUntil).getTime() - (Date.now() + offsetRef.current);
        if (remaining <= 0 && !lockExpiredRef.current) {
          lockExpiredRef.current = true;
          refetch();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state.locked, state.lockedUntil, refetch]);
  useEffect(() => {
    if (!state.locked) lockExpiredRef.current = false;
  }, [state.locked]);

  const act = useCallback(
    async (action: "ready" | "unready") => {
      setError("");
      setPending(true);
      try {
        const res = await fetch(`/api/matches/${matchId}/${action}`, { method: "POST" });
        const data = await res.json();
        if (res.ok) apply(data);
        else setError(data.error ?? "Something went wrong.");
      } catch {
        setError("Network error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [matchId, apply],
  );

  if (!state.enabled) return null;

  const bothReady = state.home.ready && state.away.ready;
  const remainingMs = state.lockedUntil
    ? new Date(state.lockedUntil).getTime() - (Date.now() + offsetRef.current)
    : 0;

  function renderSide(side: "home" | "away") {
    const data = state[side];
    const isViewer = state.viewerSide === side;
    const actionable = isViewer && !state.locked;

    // Read-only status (opponent, spectator, or anyone during the lock).
    if (!actionable) {
      return (
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              data.ready
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {data.ready && <CheckCircle2 className="h-4 w-4" />}
            {data.ready ? "Ready" : "Not Ready"}
          </div>
          {isViewer && state.locked && (
            <span className="text-[11px] text-muted-foreground">Locked in</span>
          )}
        </div>
      );
    }

    // The viewer's own actionable button.
    if (!data.ready) {
      return (
        <button
          onClick={() => act("ready")}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Ready
        </button>
      );
    }

    // Ready + waiting for opponent → distinct "waiting" style; click to unready.
    if (!bothReady) {
      return (
        <button
          onClick={() => act("unready")}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-50 animate-pulse"
          title="Waiting for your opponent — click to unready"
        >
          <CheckCircle2 className="h-4 w-4" />
          Ready ✓
        </button>
      );
    }

    // Both ready and lock expired → offer Unready.
    return (
      <button
        onClick={() => act("unready")}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-transparent px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Unready
      </button>
    );
  }

  return (
    <div className="mt-8">
      {/* Two ready buttons, aligned under the two players. */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex justify-center">{renderSide("home")}</div>
        <div className="flex justify-center">{renderSide("away")}</div>
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-destructive">{error}</p>
      )}

      {state.viewerSide === null && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Playing this match?{" "}
          <Link href="/player/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>{" "}
          to ready up.
        </p>
      )}

      {/* Assigned team card */}
      {state.assignedTeam && (
        <div className="mx-auto mt-6 max-w-md">
          <div
            className={cn(
              "rounded-xl border p-5 text-center transition-colors",
              state.locked
                ? "border-primary/40 bg-primary/10"
                : state.stale
                  ? "border-border bg-card/40 opacity-70"
                  : "border-emerald-500/30 bg-emerald-500/10",
            )}
          >
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Shuffle className="h-3.5 w-3.5" />
              {state.stale ? "Previous Team" : "Random Team"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {state.assignedTeam.region} <span className="mx-1 opacity-50">→</span>
              {state.assignedTeam.league}
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              {state.assignedTeam.team}
            </p>

            {state.locked && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-sm font-semibold text-primary">
                <Lock className="h-3.5 w-3.5" />
                Locked for <span className="tabular-nums">{fmt(remainingMs)}</span>
              </div>
            )}
            {!state.locked && !state.stale && (
              <p className="mt-3 text-xs text-emerald-400">
                Lock expired — either player may unready to re-roll.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
