"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Frame, Palette, Image as ImageIcon, Sparkles, ChevronDown } from "lucide-react";
import type { ResolvedCosmetic } from "@/lib/cosmetics";
import { LoadoutThumbnail } from "./loadout-thumbnail";

const CARD_TONE: Record<string, string> = {
  COMMON: "bwl-loadout--common",
  RARE: "bwl-loadout--rare",
  EPIC: "bwl-loadout--epic",
  LEGENDARY: "bwl-loadout--legendary",
};
const CHIP_TONE: Record<string, string> = {
  COMMON: "text-zinc-300 border-zinc-400/40 bg-zinc-400/10",
  RARE: "text-sky-300 border-sky-400/50 bg-sky-400/10",
  EPIC: "text-violet-300 border-violet-400/50 bg-violet-400/10",
  LEGENDARY: "text-amber-300 border-amber-400/50 bg-amber-400/10",
};
const ICON_TONE: Record<string, string> = {
  COMMON: "text-zinc-300",
  RARE: "text-sky-300",
  EPIC: "text-violet-300",
  LEGENDARY: "text-amber-300",
};

function iconFor(type: ResolvedCosmetic["type"]) {
  if (type === "PROFILE_FRAME") return <Frame className="w-4 h-4" />;
  if (type === "NAME_COLOR") return <Palette className="w-4 h-4" />;
  if (type === "PROFILE_BANNER") return <ImageIcon className="w-4 h-4" />;
  return <Sparkles className="w-4 h-4" />;
}

/** Collapsible "Equipped Loadout" — closed by default to keep the hero compact. */
export function EquippedLoadout({ items }: { items: ResolvedCosmetic[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div className="mt-5 max-w-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span className="h-px w-5 bg-primary/70" />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground transition-colors">
          Equipped Loadout
        </h2>
        <span className="text-[10px] font-bold text-muted-foreground rounded-full border border-border px-1.5 py-px">
          {items.length}
        </span>
        <ChevronDown className={cn("w-4 h-4 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-2 mt-2.5">
          {items.map((it) => (
            <div key={it.key} className={cn("bwl-loadout-card", CARD_TONE[it.rarity])}>
              <LoadoutThumbnail item={it} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm leading-tight truncate">{it.shortName}</p>
                <p className="text-xs text-muted-foreground leading-tight truncate">{it.description}</p>
                <span
                  className={cn(
                    "inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                    CHIP_TONE[it.rarity],
                  )}
                >
                  {it.rarity}
                </span>
              </div>
              <span className={cn("bwl-loadout-ico", ICON_TONE[it.rarity])}>{iconFor(it.type)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
