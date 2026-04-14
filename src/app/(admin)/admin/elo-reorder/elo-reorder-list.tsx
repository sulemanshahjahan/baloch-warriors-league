"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, Check, ArrowUpDown } from "lucide-react";
import { reorderAndRecalculateElo } from "@/lib/actions/elo-reorder";

interface Match {
  id: string;
  round: string | null;
  homeScore: number | null;
  awayScore: number | null;
  leg2HomeScore: number | null;
  leg2AwayScore: number | null;
  completedAt: Date | null;
  homePlayer: { name: string } | null;
  awayPlayer: { name: string } | null;
  tournament: { name: string };
}

interface EloReorderListProps {
  matches: Match[];
}

export function EloReorderList({ matches }: EloReorderListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    matches.forEach((m, i) => { init[m.id] = String(i + 1); });
    return init;
  });
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleOrderChange(matchId: string, value: string) {
    setOrders((prev) => ({ ...prev, [matchId]: value }));
  }

  function handleAutoNumber() {
    // Re-number sequentially based on current input order
    const sorted = [...matches].sort((a, b) => {
      const oa = parseInt(orders[a.id]) || 999;
      const ob = parseInt(orders[b.id]) || 999;
      return oa - ob;
    });
    const newOrders: Record<string, string> = {};
    sorted.forEach((m, i) => { newOrders[m.id] = String(i + 1); });
    setOrders(newOrders);
  }

  function handleSubmit() {
    setError("");
    setResult(null);

    // Validate all orders are numbers
    const entries = matches.map((m) => ({
      id: m.id,
      order: parseInt(orders[m.id]) || 0,
    }));

    const missing = entries.filter((e) => e.order <= 0);
    if (missing.length > 0) {
      setError(`${missing.length} matches have invalid order numbers`);
      return;
    }

    // Sort by order number
    entries.sort((a, b) => a.order - b.order);
    const orderedIds = entries.map((e) => e.id);

    startTransition(async () => {
      const res = await reorderAndRecalculateElo(orderedIds);
      if (res.success) {
        setResult(`ELO recalculated for ${res.processed} matches in your order!`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed");
      }
    });
  }

  // Sort matches by current order for display
  const sortedMatches = [...matches].sort((a, b) => {
    const oa = parseInt(orders[a.id]) || 999;
    const ob = parseInt(orders[b.id]) || 999;
    return oa - ob;
  });

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Set Match Order for ELO Calculation
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleAutoNumber} className="text-xs">
                <ArrowUpDown className="w-3 h-3" />
                Re-number
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {isPending ? "Recalculating..." : "Recalculate ELO"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-3">{error}</p>}
          {result && <p className="text-sm text-emerald-400 bg-emerald-500/10 p-2 rounded mb-3">{result}</p>}

          <p className="text-xs text-muted-foreground mb-4">
            Enter the order number (1 = first match played, 2 = second, etc.) for each match.
            Matches will be processed in this order for ELO calculation.
          </p>

          <div className="space-y-1.5">
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_100px_80px] gap-2 px-3 py-2 text-xs text-muted-foreground font-medium border-b border-border/50">
              <span>Order</span>
              <span>Match</span>
              <span className="text-center">Score</span>
              <span className="text-center">Legs</span>
            </div>

            {sortedMatches.map((m) => {
              const homeName = m.homePlayer?.name ?? "?";
              const awayName = m.awayPlayer?.name ?? "?";
              const has2Legs = m.leg2HomeScore != null;
              const aggH = has2Legs ? (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) : (m.homeScore ?? 0);
              const aggA = has2Legs ? (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) : (m.awayScore ?? 0);

              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[60px_1fr_100px_80px] gap-2 items-center px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50"
                >
                  <Input
                    type="number"
                    min={1}
                    value={orders[m.id]}
                    onChange={(e) => handleOrderChange(m.id, e.target.value)}
                    className="h-8 w-14 text-center text-sm font-bold"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {homeName} vs {awayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {m.round}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-center">
                    {aggH} - {aggA}
                  </p>
                  <div className="text-center">
                    {has2Legs ? (
                      <Badge variant="outline" className="text-[10px]">2-leg</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">1</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
