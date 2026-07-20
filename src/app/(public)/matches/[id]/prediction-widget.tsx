"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitPrediction } from "@/lib/actions/player-economy";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  matchId: string;
  homeName: string;
  awayName: string;
  loggedIn: boolean;
  myPick: "HOME" | "AWAY" | "DRAW" | null;
  counts: { HOME: number; DRAW: number; AWAY: number };
}

export function PredictionWidget({ matchId, homeName, awayName, loggedIn, myPick, counts }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [pick, setPick] = useState<Props["myPick"]>(myPick);
  const [msg, setMsg] = useState("");

  const total = counts.HOME + counts.DRAW + counts.AWAY;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  function choose(p: "HOME" | "AWAY" | "DRAW") {
    if (!loggedIn) return;
    setMsg("");
    start(async () => {
      const r = await submitPrediction(matchId, p);
      if (r.success) { setPick(p); setMsg("Prediction saved! +20 XP if correct."); router.refresh(); }
      else setMsg(r.error ?? "Failed");
    });
  }

  const options: { key: "HOME" | "DRAW" | "AWAY"; label: string; c: number }[] = [
    { key: "HOME", label: homeName, c: counts.HOME },
    { key: "DRAW", label: "Draw", c: counts.DRAW },
    { key: "AWAY", label: awayName, c: counts.AWAY },
  ];

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-4">
      <p className="text-sm font-bold flex items-center gap-1.5 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Predict the result</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => choose(o.key)}
            disabled={!loggedIn || isPending}
            className={`rounded-lg border p-2 text-center transition-colors ${pick === o.key ? "border-primary bg-primary/15" : "border-border hover:bg-muted/50"} ${!loggedIn ? "opacity-70 cursor-default" : ""}`}
          >
            <span className="block text-xs font-semibold truncate">{o.label}</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">{pct(o.c)}%</span>
            {pick === o.key && <span className="block text-[10px] text-primary font-bold">Your pick</span>}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        {total > 0 ? `${total} ${total === 1 ? "vote" : "votes"}` : "No votes yet — be the first"}
      </p>
      {isPending && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</p>}
      {msg && <p className="text-xs mt-2 text-emerald-400">{msg}</p>}
      {!loggedIn && (
        <p className="text-xs text-muted-foreground mt-2">
          <Link href="/player/login" className="text-primary hover:underline font-medium">Sign in</Link> to predict and earn coins.
        </p>
      )}
    </div>
  );
}
