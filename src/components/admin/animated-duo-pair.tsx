"use client";

// Fullscreen animated auto-pair draw for 2v2 duos.
// Mirrors the look of <AnimatedDraw> (group draw): shuffle → reveal each duo
// one by one → confirm. The pairing is computed on the client (so it can be
// revealed) using the same balanced-random algorithm as the server, then the
// final pairs are persisted via the parent's onConfirm.
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, Play, Check, X } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { pairBalancedRandom } from "@/lib/duo-pairing";

export interface DrawPlayer {
  id: string;
  name: string;
  photoUrl: string | null;
  cardRank: number;
  skillLevel: number | null;
}

interface AnimatedDuoPairProps {
  open: boolean;
  players: DrawPlayer[];
  ratingSource: "CARD" | "SKILL";
  onClose: () => void;
  onConfirm: (pairs: { player1Id: string; player2Id: string }[]) => Promise<void>;
}

interface RevealDuo {
  player1: DrawPlayer;
  player2: DrawPlayer;
}

type DrawState = "idle" | "drawing" | "revealing" | "done";

export function AnimatedDuoPair({ open, players, ratingSource, onClose, onConfirm }: AnimatedDuoPairProps) {
  const [state, setState] = useState<DrawState>("idle");
  const [duos, setDuos] = useState<RevealDuo[]>([]);
  const [unpaired, setUnpaired] = useState<DrawPlayer | null>(null);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ratingOf = useCallback(
    (p: DrawPlayer) => (ratingSource === "SKILL" ? p.skillLevel ?? 70 : p.cardRank),
    [ratingSource]
  );

  // Reset whenever the overlay is (re)opened.
  useEffect(() => {
    if (open) {
      setState("idle");
      setDuos([]);
      setUnpaired(null);
      setRevealedIndex(-1);
      setHighlight(null);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [open]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const revealNext = useCallback((result: RevealDuo[], index: number) => {
    if (index >= result.length) {
      setState("done");
      return;
    }
    setRevealedIndex(index);
    timerRef.current = setTimeout(() => revealNext(result, index + 1), 1300);
  }, []);

  const startDraw = useCallback(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const { duos: paired, unpaired: odd } = pairBalancedRandom(
      players.map((p) => ({ id: p.id, name: p.name, rating: ratingOf(p) }))
    );
    const result: RevealDuo[] = paired.map((d) => ({
      player1: byId.get(d.player1.id)!,
      player2: byId.get(d.player2.id)!,
    }));

    setDuos(result);
    setUnpaired(odd ? byId.get(odd.id) ?? null : null);
    setRevealedIndex(-1);
    setState("drawing");

    // Shuffle flourish for ~3s, then reveal.
    let cycles = 0;
    const cycle = () => {
      if (cycles < 18 && players.length > 0) {
        setHighlight(players[Math.floor(Math.random() * players.length)].id);
        cycles++;
        timerRef.current = setTimeout(cycle, 150);
      } else {
        setHighlight(null);
        setState("revealing");
        revealNext(result, 0);
      }
    };
    cycle();
  }, [players, ratingOf, revealNext]);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(duos.map((d) => ({ player1Id: d.player1.id, player2Id: d.player2.id })));
    setSaving(false);
  };

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  };

  if (!open) return null;

  const revealedDuos = duos.slice(0, revealedIndex + 1);
  const current = revealedIndex >= 0 && revealedIndex < duos.length ? duos[revealedIndex] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={handleCancel} className="text-white/60 hover:text-white">
          <X className="w-6 h-6" />
        </Button>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 text-center">
        {state === "idle" && "Duo Draw"}
        {state === "drawing" && "Pairing..."}
        {state === "revealing" && "Revealing Duos"}
        {state === "done" && "Pairing Complete!"}
      </h1>
      <p className="text-white/50 text-sm mb-6">
        {state === "idle" && `${players.length} players → ${Math.floor(players.length / 2)} duos · by ${ratingSource === "SKILL" ? "skill level" : "card rank"}`}
        {state === "revealing" && `${revealedIndex + 1} of ${duos.length}`}
        {state === "done" && "Confirm to save the duos"}
      </p>

      {/* Spotlight: the duo currently being revealed */}
      {state === "revealing" && current && (
        <div className="mb-6 flex items-center gap-4 animate-in zoom-in-75 duration-500">
          <div className="flex flex-col items-center">
            <SmartAvatar type="player" id={current.player1.id} name={current.player1.name} photoUrl={current.player1.photoUrl} className="h-16 w-16 ring-4 ring-primary" fallbackClassName="text-xl" />
            <p className="text-white text-xs mt-1">{current.player1.name}</p>
          </div>
          <span className="text-primary text-2xl font-black">&amp;</span>
          <div className="flex flex-col items-center">
            <SmartAvatar type="player" id={current.player2.id} name={current.player2.name} photoUrl={current.player2.photoUrl} className="h-16 w-16 ring-4 ring-primary" fallbackClassName="text-xl" />
            <p className="text-white text-xs mt-1">{current.player2.name}</p>
          </div>
        </div>
      )}

      {/* Shuffle flourish */}
      {state === "drawing" && (
        <div className="mb-6 flex flex-wrap justify-center gap-2 max-w-md">
          {players.map((p) => (
            <div key={p.id} className={`transition-all duration-150 ${highlight === p.id ? "scale-125 ring-2 ring-primary rounded-full" : "opacity-40 scale-90"}`}>
              <SmartAvatar type="player" id={p.id} name={p.name} photoUrl={p.photoUrl} className="h-10 w-10" fallbackClassName="text-xs" />
            </div>
          ))}
        </div>
      )}

      {/* Revealed duos grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-4xl">
        {revealedDuos.map((d, i) => (
          <div key={`${d.player1.id}-${d.player2.id}`} className="bg-card/80 border border-border/50 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-500" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex -space-x-2">
              <SmartAvatar type="player" id={d.player1.id} name={d.player1.name} photoUrl={d.player1.photoUrl} className="h-9 w-9 border-2 border-background" fallbackClassName="text-[10px]" />
              <SmartAvatar type="player" id={d.player2.id} name={d.player2.name} photoUrl={d.player2.photoUrl} className="h-9 w-9 border-2 border-background" fallbackClassName="text-[10px]" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{d.player1.name} &amp; {d.player2.name}</p>
              <p className="text-white/40 text-xs">{ratingOf(d.player1)} + {ratingOf(d.player2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Unpaired warning */}
      {state === "done" && unpaired && (
        <p className="mt-4 text-amber-400 text-sm">⚠ {unpaired.name} is unpaired (odd number of players).</p>
      )}

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        {state === "idle" && (
          <Button onClick={startDraw} size="lg" className="min-w-[200px]" disabled={players.length < 2}>
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
            <Button onClick={handleConfirm} disabled={saving || duos.length === 0} size="lg">
              <Check className="w-5 h-5" />
              {saving ? "Saving..." : "Confirm & Save"}
            </Button>
          </>
        )}
      </div>

      {/* Progress */}
      {state === "revealing" && (
        <div className="w-full max-w-md mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((revealedIndex + 1) / duos.length) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
