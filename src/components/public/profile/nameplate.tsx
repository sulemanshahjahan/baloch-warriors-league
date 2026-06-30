import { cn } from "@/lib/utils";
import { RARITY_CHIP, type ResolvedCosmetic } from "@/lib/cosmetics";

/**
 * Player name with an optional equipped nameplate treatment (gradient + glow +
 * accent slash + rarity chip). With no nameplate it renders a plain bold name.
 */
export function Nameplate({
  name,
  nameplate,
}: {
  name: string;
  nameplate?: ResolvedCosmetic | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1
          className={cn(
            "bwl-name text-2xl sm:text-3xl font-black tracking-tight leading-tight break-words",
            nameplate?.className,
          )}
        >
          {name}
        </h1>
        {nameplate && (
          <span
            className={cn(
              "hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              RARITY_CHIP[nameplate.rarity],
            )}
          >
            {nameplate.rarity}
          </span>
        )}
      </div>
      {nameplate && <span className="bwl-name-accent" aria-hidden />}
    </div>
  );
}
