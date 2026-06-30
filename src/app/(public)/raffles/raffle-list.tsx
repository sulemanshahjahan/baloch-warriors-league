"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Coins, Loader2, Trophy } from "lucide-react";
import { buyRaffleTickets } from "@/lib/actions/player-economy";

export interface RaffleView {
  id: string;
  name: string;
  prize: string;
  costPerTicket: number;
  isActive: boolean;
  winnerName: string | null;
  totalTickets: number;
  myTickets: number;
}

export function RaffleList({ raffles, loggedIn, coins }: { raffles: RaffleView[]; loggedIn: boolean; coins: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [msg, setMsg] = useState("");

  function buy(id: string) {
    setBusy(id); setMsg("");
    start(async () => {
      const r = await buyRaffleTickets(id, 1);
      setBusy(null);
      setMsg(r.success ? (r.message ?? "Done") : (r.error ?? "Failed"));
      if (r.success) router.refresh();
    });
  }

  if (raffles.length === 0) return <p className="text-muted-foreground">No raffles right now. Check back soon!</p>;

  return (
    <div className="space-y-4">
      {!loggedIn && <p className="text-sm rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"><Link href="/player/login" className="text-primary font-semibold hover:underline">Sign in</Link> to enter raffles with your coins.</p>}
      {msg && <p className="text-sm px-3 py-2 rounded bg-muted">{msg}</p>}
      {raffles.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <Gift className="w-8 h-8 text-amber-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold">{r.name}</p>
              <p className="text-sm text-muted-foreground">🎁 {r.prize}</p>
              <p className="text-xs text-muted-foreground mt-1">{r.totalTickets} tickets sold · {r.myTickets > 0 && <span className="text-emerald-400">you have {r.myTickets}</span>}</p>
            </div>
            {r.isActive ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-300 flex items-center gap-1"><Coins className="w-4 h-4" />{r.costPerTicket}/ticket</span>
                <Button size="sm" disabled={!loggedIn || busy === r.id || coins < r.costPerTicket} onClick={() => buy(r.id)}>
                  {busy === r.id && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Buy ticket
                </Button>
              </div>
            ) : (
              <span className="text-sm flex items-center gap-1 text-yellow-300 font-semibold"><Trophy className="w-4 h-4" />{r.winnerName ?? "Drawn"}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
