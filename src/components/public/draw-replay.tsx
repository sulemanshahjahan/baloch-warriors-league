"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, Play, X } from "lucide-react";
import { SmartAvatar } from "./smart-avatar";

interface Player {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface GroupWithPlayers {
  id: string;
  name: string;
  players: Player[];
}

interface DrawReplayProps {
  groups: GroupWithPlayers[];
}

type ReplayState = "idle" | "shuffling" | "revealing" | "done";

export function DrawReplayButton({ groups }: DrawReplayProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ReplayState>("idle");
  const [revealOrder, setRevealOrder] = useState<Array<{ player: Player; groupName: string }>>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const allPlayers = groups.flatMap((g) => g.players);

  // Build reveal order — interleave groups for dramatic effect
  const buildRevealOrder = useCallback(() => {
    const order: Array<{ player: Player; groupName: string }> = [];
    const maxLen = Math.max(...groups.map((g) => g.players.length));
    for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (group.players[i]) {
          order.push({ player: group.players[i], groupName: group.name });
        }
      }
    }
    return order;
  }, [groups]);

  const startReplay = useCallback(() => {
    const order = buildRevealOrder();
    setRevealOrder(order);
    setRevealedIndex(-1);
    setHighlight(null);
    setState("shuffling");

    // Shuffle animation for 3 seconds
    let cycleCount = 0;
    const cycle = () => {
      if (cycleCount < 20) {
        setHighlight(allPlayers[Math.floor(Math.random() * allPlayers.length)]?.id ?? null);
        cycleCount++;
        timerRef.current = setTimeout(cycle, 150);
      } else {
        setHighlight(null);
        setState("revealing");
        revealNext(order, 0);
      }
    };
    cycle();
  }, [buildRevealOrder, allPlayers]);

  const revealNext = (order: Array<{ player: Player; groupName: string }>, index: number) => {
    if (index >= order.length) {
      setState("done");
      return;
    }
    setRevealedIndex(index);
    setHighlight(order[index].player.id);

    timerRef.current = setTimeout(() => {
      setHighlight(null);
      timerRef.current = setTimeout(() => revealNext(order, index + 1), 200);
    }, 1200);
  };

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
    setState("idle");
    setRevealedIndex(-1);
  };

  if (groups.length < 2 || allPlayers.length === 0) return null;

  // Build revealed group contents
  const revealedGroups: Record<string, Player[]> = {};
  groups.forEach((g) => { revealedGroups[g.name] = []; });
  revealOrder.slice(0, revealedIndex + 1).forEach((r) => {
    if (revealedGroups[r.groupName]) revealedGroups[r.groupName].push(r.player);
  });

  const current = revealedIndex >= 0 && revealedIndex < revealOrder.length ? revealOrder[revealedIndex] : null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setState("idle"); }}>
        <Shuffle className="w-4 h-4" />
        Watch Draw
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <button onClick={handleClose} className="absolute top-4 right-4 text-white/40 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>

          <h1 className="text-2xl sm:text-4xl font-black text-white mb-1 text-center">
            {state === "idle" && "🏆 Group Draw"}
            {state === "shuffling" && "Shuffling..."}
            {state === "revealing" && "Drawing Groups"}
            {state === "done" && "✨ Draw Complete!"}
          </h1>
          <p className="text-white/40 text-sm mb-8">
            {state === "idle" && `${allPlayers.length} players · ${groups.length} groups`}
            {state === "revealing" && `${revealedIndex + 1} of ${revealOrder.length}`}
            {state === "done" && `${allPlayers.length} players assigned`}
          </p>

          {/* Spotlight — current player being revealed */}
          {state === "revealing" && current && (
            <div className="mb-8 flex flex-col items-center animate-in zoom-in-75 duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/40 rounded-full blur-2xl animate-pulse" />
                <SmartAvatar
                  type="player"
                  id={current.player.id}
                  name={current.player.name}
                  photoUrl={current.player.photoUrl}
                  className="h-24 w-24 ring-4 ring-primary relative"
                  fallbackClassName="text-3xl"
                />
              </div>
              <p className="text-white font-bold text-xl mt-4">{current.player.name}</p>
              <p className="text-primary font-bold text-lg animate-in slide-in-from-bottom-2 duration-300">→ {current.groupName}</p>
            </div>
          )}

          {/* Shuffle phase — all players cycling */}
          {state === "shuffling" && (
            <div className="mb-8 flex flex-wrap justify-center gap-2 max-w-lg">
              {allPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`transition-all duration-150 ${
                    highlight === p.id ? "scale-150 ring-2 ring-primary rounded-full" : "opacity-30 scale-75"
                  }`}
                >
                  <SmartAvatar type="player" id={p.id} name={p.name} photoUrl={p.photoUrl} className="h-10 w-10" fallbackClassName="text-xs" />
                </div>
              ))}
            </div>
          )}

          {/* Groups */}
          <div className={`grid gap-3 w-full max-w-5xl ${
            groups.length <= 2 ? "grid-cols-2" : groups.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
          }`}>
            {groups.map((group) => (
              <div
                key={group.id}
                className={`bg-card/60 backdrop-blur border border-border/30 rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                  current?.groupName === group.name ? "ring-2 ring-primary scale-[1.02] border-primary/50" : ""
                }`}
              >
                <h3 className="text-sm font-bold text-center text-white/70 mb-3 pb-2 border-b border-border/20">
                  {group.name}
                </h3>
                <div className="space-y-1.5 min-h-[60px]">
                  {(revealedGroups[group.name] ?? []).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 animate-in slide-in-from-top-3 fade-in duration-500"
                    >
                      <SmartAvatar type="player" id={player.id} name={player.name} photoUrl={player.photoUrl} className="h-6 w-6" fallbackClassName="text-[8px]" />
                      <span className="text-white text-xs font-medium truncate">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8">
            {state === "idle" && (
              <Button onClick={startReplay} size="lg" className="min-w-[200px] text-lg h-12">
                <Play className="w-5 h-5" />
                Play Draw
              </Button>
            )}
            {state === "done" && (
              <Button variant="outline" onClick={startReplay}>
                <Shuffle className="w-4 h-4" />
                Replay
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {state === "revealing" && (
            <div className="w-full max-w-md mt-6 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((revealedIndex + 1) / revealOrder.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
