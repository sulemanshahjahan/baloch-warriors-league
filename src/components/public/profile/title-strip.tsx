import { cn } from "@/lib/utils";
import { playerClassFor } from "@/lib/cosmetics";

/**
 * Player-class status strip (e.g. LEGENDARY PLAYER) derived from card rank.
 * Distinct from earned achievement titles, which stay in the engagement section.
 */
export function TitleStrip({ cardRank }: { cardRank: number }) {
  const pc = playerClassFor(cardRank);
  return <span className={cn("bwl-title-strip", pc.className)}>{pc.label}</span>;
}
