"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STORE_ITEMS } from "@/lib/cosmetics";
import { adjustPlayerLegacy, grantCosmetic, equipCosmetic, createSeason, setActiveSeason, createRaffle, drawRaffle } from "@/lib/actions/legacy-admin";

interface Season { id: string; name: string; isActive: boolean; startDate: string | null; endDate: string | null }
interface PlayerLite { id: string; name: string; legacyLevel: number; legacyTier: string; coins: number }
interface Audit { id: string; action: string; reason: string; targetPlayerId: string; createdAt: string }
interface RaffleLite { id: string; name: string; prize: string; isActive: boolean; entries: number }

export function LegacyAdminPanel({ seasons, players, recentAudit, raffles }: { seasons: Season[]; players: PlayerLite[]; recentAudit: Audit[]; raffles: RaffleLite[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");

  // adjust form
  const [playerId, setPlayerId] = useState("");
  const [xp, setXp] = useState("");
  const [coins, setCoins] = useState("");
  const [reason, setReason] = useState("");

  // cosmetic
  const [cosPlayer, setCosPlayer] = useState("");
  const [cosItem, setCosItem] = useState("");

  // season
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");

  // raffle
  const [raffleName, setRaffleName] = useState("");
  const [rafflePrize, setRafflePrize] = useState("");
  const [raffleCost, setRaffleCost] = useState("100");

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      setMsg("");
      const r = await fn();
      setMsg(r.success ? ok : r.error || "Failed");
      if (r.success) router.refresh();
    });

  return (
    <div className="space-y-6 max-w-4xl">
      {msg && <p className="text-sm px-3 py-2 rounded bg-muted">{msg}</p>}

      {/* Seasons */}
      <Card>
        <CardHeader><CardTitle className="text-base">Seasons</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {seasons.length === 0 && <p className="text-sm text-muted-foreground">No seasons yet.</p>}
          {seasons.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/40">
              <span className="text-sm font-medium">{s.name} {s.isActive && <span className="text-emerald-400 text-xs">● active</span>}</span>
              <Button size="sm" variant={s.isActive ? "secondary" : "outline"} disabled={isPending}
                onClick={() => run(() => setActiveSeason(s.isActive ? null : s.id), s.isActive ? "Deactivated" : "Activated")}>
                {s.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
            <Input placeholder="Season name (e.g. Road to Glory)" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
            <Input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
            <Input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
          </div>
          <Button size="sm" disabled={isPending || !seasonName} onClick={() => run(() => createSeason(seasonName, seasonStart || undefined, seasonEnd || undefined), "Season created")}>Create Season</Button>
        </CardContent>
      </Card>

      {/* Manual adjust */}
      <Card>
        <CardHeader><CardTitle className="text-base">Manual XP / Coins</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Player</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — Lvl {p.legacyLevel} · {p.coins}🪙</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">XP (±)</Label><Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Coins (±)</Label><Input type="number" value={coins} onChange={(e) => setCoins(e.target.value)} /></div>
          </div>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" disabled={isPending || !playerId || !reason}
            onClick={() => run(() => adjustPlayerLegacy(playerId, { xp: Number(xp) || 0, coins: Number(coins) || 0, reason }), "Adjusted")}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {/* Cosmetics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Grant / Equip Cosmetic</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={cosPlayer} onValueChange={setCosPlayer}>
              <SelectTrigger><SelectValue placeholder="Player" /></SelectTrigger>
              <SelectContent>{players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={cosItem} onValueChange={setCosItem}>
              <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
              <SelectContent>{STORE_ITEMS.map((i) => <SelectItem key={i.key} value={i.key}>{i.name} ({i.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={isPending || !cosPlayer || !cosItem} onClick={() => run(() => grantCosmetic(cosPlayer, cosItem), "Granted")}>Grant</Button>
            <Button size="sm" disabled={isPending || !cosPlayer || !cosItem} onClick={() => run(() => equipCosmetic(cosPlayer, cosItem), "Equipped")}>Grant & Equip</Button>
            <Button size="sm" variant="ghost" disabled={isPending || !cosPlayer} onClick={() => run(() => equipCosmetic(cosPlayer, null), "Cleared")}>Unequip frame</Button>
          </div>
        </CardContent>
      </Card>

      {/* Raffles */}
      <Card>
        <CardHeader><CardTitle className="text-base">Raffles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {raffles.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/40">
              <span className="text-sm font-medium truncate">{r.name} — {r.prize} <span className="text-muted-foreground">({r.entries} entries{r.isActive ? "" : " · drawn"})</span></span>
              {r.isActive && <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => drawRaffle(r.id), "Winner drawn")}>Draw winner</Button>}
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
            <Input placeholder="Raffle name" value={raffleName} onChange={(e) => setRaffleName(e.target.value)} />
            <Input placeholder="Prize (e.g. BWL Jersey)" value={rafflePrize} onChange={(e) => setRafflePrize(e.target.value)} />
            <Input type="number" placeholder="Coins / ticket" value={raffleCost} onChange={(e) => setRaffleCost(e.target.value)} />
          </div>
          <Button size="sm" disabled={isPending || !raffleName || !rafflePrize} onClick={() => run(() => createRaffle(raffleName, rafflePrize, Number(raffleCost) || 100), "Raffle created")}>Create Raffle</Button>
        </CardContent>
      </Card>

      {/* Audit */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Admin Actions</CardTitle></CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? <p className="text-sm text-muted-foreground">No actions yet.</p> : (
            <ul className="space-y-1 text-xs">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{a.action} — {a.reason}</span>
                  <span className="shrink-0">{new Date(a.createdAt).toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
