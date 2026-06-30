import { cn } from "@/lib/utils";
import { Frame, Palette, Image as ImageIcon, Sparkles } from "lucide-react";
import type { ResolvedCosmetic } from "@/lib/cosmetics";

const RARITY_TONE: Record<string, string> = {
  COMMON: "text-zinc-300 border-zinc-400/30 bg-zinc-400/[0.07]",
  RARE: "text-sky-300 border-sky-400/40 bg-sky-400/[0.07]",
  EPIC: "text-violet-300 border-violet-400/40 bg-violet-400/[0.07]",
  LEGENDARY: "text-amber-300 border-amber-400/50 bg-amber-400/[0.08]",
};

function iconFor(type: ResolvedCosmetic["type"]) {
  if (type === "PROFILE_FRAME") return <Frame className="w-3 h-3" />;
  if (type === "NAME_COLOR") return <Palette className="w-3 h-3" />;
  if (type === "PROFILE_BANNER") return <ImageIcon className="w-3 h-3" />;
  return <Sparkles className="w-3 h-3" />;
}

/** Premium "Equipped" chips row. Renders nothing when nothing is equipped. */
export function EquippedItemsRow({ items }: { items: ResolvedCosmetic[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mr-0.5">
        Equipped
      </span>
      {items.map((it) => (
        <span key={it.key} className={cn("bwl-equip-chip", RARITY_TONE[it.rarity] ?? RARITY_TONE.COMMON)}>
          {iconFor(it.type)}
          <span className="truncate max-w-[10rem]">{it.name}</span>
        </span>
      ))}
    </div>
  );
}
