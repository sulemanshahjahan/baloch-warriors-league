import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ResolvedCosmetic } from "@/lib/cosmetics";

/**
 * Loadout card thumbnail. Uses the provided art image when present (optimized
 * via next/image), otherwise a pure-CSS fallback look. Drop-in upgrade path:
 * give any item a `thumbnailAsset` and it renders here automatically.
 */
export function LoadoutThumbnail({ item }: { item: ResolvedCosmetic }) {
  if (item.thumbnailAsset) {
    return (
      <div className="bwl-loadout-thumb bwl-loadout-thumb--img">
        <Image src={item.thumbnailAsset} alt="" fill sizes="96px" className="object-cover" />
      </div>
    );
  }
  return <div className={cn("bwl-loadout-thumb", item.thumbnailClass)} aria-hidden />;
}
