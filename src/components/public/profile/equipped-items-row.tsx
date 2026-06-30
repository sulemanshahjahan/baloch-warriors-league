import { cn } from "@/lib/utils";
import { Frame, Palette, Image as ImageIcon, Sparkles } from "lucide-react";
import type { ResolvedCosmetic } from "@/lib/cosmetics";

const RARITY_TONE: Record<string, string> = {
  COMMON: "text-zinc-200 border-zinc-400/30",
  RARE: "text-sky-300 border-sky-400/40",
  EPIC: "text-violet-300 border-violet-400/40",
  LEGENDARY: "text-amber-300 border-amber-400/50",
};

function iconFor(type: ResolvedCosmetic["type"]) {
  if (type === "PROFILE_FRAME") return <Frame className="w-2.5 h-2.5" />;
  if (type === "NAME_COLOR") return <Palette className="w-2.5 h-2.5" />;
  if (type === "PROFILE_BANNER") return <ImageIcon className="w-2.5 h-2.5" />;
  return <Sparkles className="w-2.5 h-2.5" />;
}

/** Compact premium glass panel of equipped cosmetics. Hidden when empty. */
export function EquippedItemsRow({ items }: { items: ResolvedCosmetic[] }) {
  if (!items.length) return null;
  return (
    <div className="bwl-equipped-panel mt-2.5">
      <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold leading-none">
        Equipped
      </span>
      <div className="bwl-equip-grid">
        {items.map((it) => (
          <span key={it.key} className={cn("bwl-equip-chip", RARITY_TONE[it.rarity] ?? RARITY_TONE.COMMON)}>
            <span className="bwl-equip-ico">{iconFor(it.type)}</span>
            <span className="truncate">{it.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
