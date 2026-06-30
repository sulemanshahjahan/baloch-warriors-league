import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import type { ResolvedCosmetic } from "@/lib/cosmetics";

/**
 * Loadout card thumbnail. Uses an image asset when present (frames reuse the
 * existing *-card-bg art), otherwise a pure-CSS look. Drop-in upgrade path:
 * give any item a `thumbnailAsset` and it renders here automatically.
 */
export function LoadoutThumbnail({ item }: { item: ResolvedCosmetic }) {
  if (item.thumbnailAsset) {
    return (
      <div
        className="bwl-loadout-thumb bwl-loadout-thumb--img"
        style={{ backgroundImage: `url(${item.thumbnailAsset})` }}
      >
        <span className="absolute inset-0 z-[1] grid place-items-center text-white/85">
          <Shield className="w-5 h-5 drop-shadow" />
        </span>
      </div>
    );
  }
  return <div className={cn("bwl-loadout-thumb", item.thumbnailClass)} aria-hidden />;
}
