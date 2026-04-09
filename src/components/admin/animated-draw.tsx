"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, Play, Check, X } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";

interface Player {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface Group {
  id: string;
  name: string;
}

interface Assignment {
  playerId: string;
  groupId: string;
}

interface AnimatedDrawProps {
  players: Player[];
  groups: Group[];
  onComplete: (assignments: Assignment[]) => Promise<void>;
}

type DrawState = "idle" | "drawing" | "revealing" | "done";

export function AnimatedDraw({ players, groups, onComplete }: AnimatedDrawProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DrawState>("idle");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [currentHighlight, setCurrentHighlight] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Shuffle and assign players to groups evenly
  const generateDraw = useCallback(() => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const result: Assignment[] = [];
    shuffled.forEach((player, i) => {
      const groupIndex = i % groups.length;
      result.push({ playerId: player.id, groupId: groups[groupIndex].id });
    });
    return result;
  }, [players, groups]);

  const startDraw = useCallback(() => {
    const result = generateDraw();
    setAssignments(result);
    setRevealedIndex(-1);
    setCurrentHighlight(null);
    setState("drawing");

    // Start the cycling animation for 3 seconds
    let cycleCount = 0;
    const cycle = () => {
      if (cycleCount < 20) {
        setCurrentHighlight(players[Math.floor(Math.random() * players.length)].id);
        cycleCount++;
        timerRef.current = setTimeout(cycle, 150);
      } else {
        setCurrentHighlight(null);
        setState("revealing");
        // Start revealing one by one
        revealNext(result, 0);
      }
    };
    cycle();
  }, [generateDraw, players]);

  const revealNext = (result: Assignment[], index: number) => {
    if (index >= result.length) {
      setState("done");
      return;
    }
    setRevealedIndex(index);
    setCurrentHighlight(result[index].playerId);

    // Show the player for 1.5 seconds, then move to next
    timerRef.current = setTimeout(() => {
      setCurrentHighlight(null);
      timerRef.current = setTimeout(() => {
        revealNext(result, index + 1);
      }, 300);
    }, 1500);
  };

  const handleConfirm = async () => {
    setSaving(true);
    await onComplete(assignments);
    setSaving(false);
    setOpen(false);
    setState("idle");
  };

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
    setState("idle");
    setRevealedIndex(-1);
    setCurrentHighlight(null);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (players.length === 0 || groups.length === 0) return null;

  // Build group contents from revealed assignments
  const groupContents: Record<string, Player[]> = {};
  groups.forEach((g) => { groupContents[g.id] = []; });
  assignments.slice(0, revealedIndex + 1).forEach((a) => {
    const player = players.find((p) => p.id === a.playerId);
    if (player && groupContents[a.groupId]) {
      groupContents[a.groupId].push(player);
    }
  });

  // Current player being revealed
  const currentPlayer = revealedIndex >= 0 && revealedIndex < assignments.length
    ? players.find((p) => p.id === assignments[revealedIndex].playerId)
    : null;
  const currentGroup = revealedIndex >= 0 && revealedIndex < assignments.length
    ? groups.find((g) => g.id === assignments[revealedIndex].groupId)
    : null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Shuffle className="w-4 h-4" />
        Animated Draw
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Header */}
          <div className="absolute top-4 right-4">
            <Button variant="ghost" size="icon" onClick={handleCancel} className="text-white/60 hover:text-white">
              <X className="w-6 h-6" />
            </Button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 text-center">
            {state === "idle" && "Group Draw"}
            {state === "drawing" && "Shuffling..."}
            {state === "revealing" && "Revealing Players"}
            {state === "done" && "Draw Complete!"}
          </h1>
          <p className="text-white/50 text-sm mb-6">
            {state === "idle" && `${players.length} players → ${groups.length} groups`}
            {state === "revealing" && `${revealedIndex + 1} of ${assignments.length}`}
            {state === "done" && "Confirm to save the draw"}
          </p>

          {/* Current reveal spotlight */}
          {state === "revealing" && currentPlayer && currentGroup && (
            <div className="mb-6 flex flex-col items-center animate-in zoom-in-75 duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
                <SmartAvatar
                  type="player"
                  id={currentPlayer.id}
                  name={currentPlayer.name}
                  photoUrl={currentPlayer.photoUrl}
                  className="h-20 w-20 ring-4 ring-primary relative"
                  fallbackClassName="text-2xl"
                />
              </div>
              <p className="text-white font-bold text-lg mt-3">{currentPlayer.name}</p>
              <p className="text-primary font-semibold text-sm">→ {currentGroup.name}</p>
            </div>
          )}

          {/* Shuffling animation */}
          {state === "drawing" && (
            <div className="mb-6 flex flex-wrap justify-center gap-2 max-w-md">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`transition-all duration-150 ${
                    currentHighlight === p.id
                      ? "scale-125 ring-2 ring-primary rounded-full"
                      : "opacity-40 scale-90"
                  }`}
                >
                  <SmartAvatar
                    type="player"
                    id={p.id}
                    name={p.name}
                    photoUrl={p.photoUrl}
                    className="h-10 w-10"
                    fallbackClassName="text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Groups grid */}
          <div className={`grid gap-4 w-full max-w-4xl ${
            groups.length <= 2 ? "grid-cols-2" : groups.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
          }`}>
            {groups.map((group) => (
              <div
                key={group.id}
                className={`bg-card/80 border border-border/50 rounded-xl p-4 transition-all ${
                  currentGroup?.id === group.id ? "ring-2 ring-primary border-primary/50 scale-[1.02]" : ""
                }`}
              >
                <h3 className="text-sm font-bold text-center text-white/80 mb-3 pb-2 border-b border-border/30">
                  {group.name}
                </h3>
                <div className="space-y-2 min-h-[80px]">
                  {groupContents[group.id]?.map((player, i) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-500"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <SmartAvatar
                        type="player"
                        id={player.id}
                        name={player.name}
                        photoUrl={player.photoUrl}
                        className="h-7 w-7"
                        fallbackClassName="text-[9px]"
                      />
                      <span className="text-white text-xs font-medium truncate">{player.name}</span>
                    </div>
                  ))}
                  {(groupContents[group.id]?.length ?? 0) === 0 && (
                    <p className="text-white/20 text-xs text-center py-4">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex gap-3">
            {state === "idle" && (
              <Button onClick={startDraw} size="lg" className="min-w-[200px]">
                <Play className="w-5 h-5" />
                Start Draw
              </Button>
            )}
            {state === "done" && (
              <>
                <Button variant="outline" onClick={startDraw}>
                  <Shuffle className="w-4 h-4" />
                  Redraw
                </Button>
                <Button onClick={handleConfirm} disabled={saving} size="lg">
                  <Check className="w-5 h-5" />
                  {saving ? "Saving..." : "Confirm & Save"}
                </Button>
              </>
            )}
          </div>

          {/* Progress bar */}
          {state === "revealing" && (
            <div className="w-full max-w-md mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${((revealedIndex + 1) / assignments.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
