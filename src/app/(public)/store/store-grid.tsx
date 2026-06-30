"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STORE_ITEMS, RARITY_BORDER, type StoreItem } from "@/lib/cosmetics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Frame, Palette, Image as ImageIcon, Check, Loader2 } from "lucide-react";
import { buyStoreItem, equipMyCosmetic } from "@/lib/actions/player-economy";

export interface StoreViewer {
  coins: number;
  level: number;
  respect: number;
  owned: string[];
  equipped: { profileFrame: string | null; nameColor: string | null; profileBanner: string | null };
}

const GROUPS: { type: StoreItem["type"]; label: string; icon: React.ReactNode }[] = [
  { type: "PROFILE_FRAME", label: "Profile Frames", icon: <Frame className="w-4 h-4 text-amber-300" /> },
  { type: "NAME_COLOR", label: "Name Colors", icon: <Palette className="w-4 h-4 text-fuchsia-300" /> },
  { type: "PROFILE_BANNER", label: "Profile Banners", icon: <ImageIcon className="w-4 h-4 text-sky-300" /> },
];

function equippedKey(me: StoreViewer, item: StoreItem) {
  return item.type === "NAME_COLOR" ? me.equipped.nameColor : item.type === "PROFILE_BANNER" ? me.equipped.profileBanner : me.equipped.profileFrame;
}

export function StoreGrid({ me }: { me: StoreViewer | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [msg, setMsg] = useState("");

  const act = (key: string, fn: () => Promise<{ success: boolean; error?: string; message?: string }>) => {
    setBusy(key); setMsg("");
    start(async () => {
      const r = await fn();
      setBusy(null);
      setMsg(r.success ? (r.message ?? "Done") : (r.error ?? "Failed"));
      if (r.success) router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      {!me && (
        <p className="text-sm rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Link href="/player/login" className="text-primary font-semibold hover:underline">Sign in</Link> to buy and equip items with your coins.
        </p>
      )}
      {msg && <p className="text-sm px-3 py-2 rounded bg-muted">{msg}</p>}

      {GROUPS.map((g) => {
        const items = STORE_ITEMS.filter((i) => i.type === g.type);
        return (
          <Card key={g.type}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">{g.icon} {g.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((item) => {
                  const owned = me?.owned.includes(item.key) ?? false;
                  const isEquipped = me ? equippedKey(me, item) === item.key : false;
                  const meetsReq = me ? (!item.minLevel || me.level >= item.minLevel) && (!item.minRespect || me.respect >= item.minRespect) : true;
                  const affordable = me ? me.coins >= item.cost : false;
                  return (
                    <div key={item.key} className={`rounded-xl border p-3 ${RARITY_BORDER[item.rarity]}`}>
                      <div className="h-16 rounded-lg mb-2 flex items-center justify-center bg-muted/40 overflow-hidden">
                        {item.type === "NAME_COLOR" ? (
                          <span className={`bwl-name text-xl font-black ${item.css}`}>Warrior</span>
                        ) : item.type === "PROFILE_BANNER" ? (
                          <div className={`bwl-banner w-full h-full ${item.css}`} />
                        ) : (
                          <div className={`bwl-frame h-12 w-12 ${item.css}`}>
                            <div className="bwl-frame__inner">
                              <div className="w-full h-full bg-zinc-600" />
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold truncate" title={item.displayName}>{item.displayName}</p>
                      <div className="flex items-center justify-between mt-1 mb-2">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1"><Coins className="w-3 h-3" />{item.cost.toLocaleString()}</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{item.rarity}</span>
                      </div>
                      {(item.minLevel || item.minRespect) && (
                        <p className="text-[11px] text-muted-foreground mb-1">{item.minLevel ? `Lvl ${item.minLevel}+` : ""}{item.minLevel && item.minRespect ? " · " : ""}{item.minRespect ? `Respect ${item.minRespect}+` : ""}</p>
                      )}
                      {me && (
                        isEquipped ? (
                          <Button size="sm" variant="secondary" className="w-full" disabled><Check className="w-3.5 h-3.5 mr-1" />Equipped</Button>
                        ) : owned ? (
                          <Button size="sm" variant="outline" className="w-full" disabled={busy === item.key} onClick={() => act(item.key, () => equipMyCosmetic(item.key))}>
                            {busy === item.key && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Equip
                          </Button>
                        ) : (
                          <Button size="sm" className="w-full" disabled={busy === item.key || !meetsReq || !affordable} onClick={() => act(item.key, () => buyStoreItem(item.key))}>
                            {busy === item.key && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                            {!meetsReq ? "Locked" : !affordable ? "Need coins" : "Buy"}
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
