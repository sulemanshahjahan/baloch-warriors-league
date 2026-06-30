import { TrendingUp, Coins, Sparkles } from "lucide-react";
import { legacyProgress } from "@/lib/legacy";

interface RecentXp {
  id: string;
  xp: number;
  coins: number;
  reason: string;
  createdAt: Date;
}

interface LegacyProgressCardProps {
  totalXp: number;
  coins: number;
  recent: RecentXp[];
}

const TIER_GLOW: Record<string, string> = {
  Rookie: "from-zinc-500/20 to-zinc-700/10 text-zinc-300 border-zinc-500/30",
  Regular: "from-emerald-500/20 to-emerald-700/10 text-emerald-300 border-emerald-500/30",
  Contender: "from-sky-500/20 to-sky-700/10 text-sky-300 border-sky-500/30",
  Star: "from-violet-500/20 to-violet-700/10 text-violet-300 border-violet-500/30",
  Elite: "from-amber-500/20 to-amber-700/10 text-amber-300 border-amber-500/30",
  Legend: "from-orange-500/25 to-red-600/10 text-orange-300 border-orange-500/40",
  "Hall of Fame": "from-yellow-400/30 to-amber-600/10 text-yellow-200 border-yellow-400/50",
};

export function LegacyProgressCard({ totalXp, coins, recent }: LegacyProgressCardProps) {
  const p = legacyProgress(totalXp);
  const glow = TIER_GLOW[p.tier] ?? TIER_GLOW.Rookie;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${glow} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-foreground/90">BWL Legacy</h3>
        </div>
        <div className="flex items-center gap-1.5 text-amber-300 text-sm font-bold">
          <Coins className="w-4 h-4" />
          {coins.toLocaleString()}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 mb-1.5">
        <div>
          <p className="text-3xl font-black leading-none text-foreground">
            Lvl {p.level}
          </p>
          <p className="text-xs font-semibold mt-1 opacity-90">{p.tier}</p>
        </div>
        <p className="text-xs text-foreground/60 mb-0.5">
          {p.isMaxLevel ? "Max level" : `${p.xpIntoLevel.toLocaleString()} / ${p.xpForNextLevel.toLocaleString()} XP`}
        </p>
      </div>

      {/* XP bar */}
      <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all"
          style={{ width: `${p.progressPercent}%` }}
        />
      </div>
      {!p.isMaxLevel && (
        <p className="text-[11px] text-foreground/60 mt-1.5">
          {(p.xpForNextLevel - p.xpIntoLevel).toLocaleString()} XP to Level {p.nextLevel}
        </p>
      )}

      {/* Recent XP */}
      {recent.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-foreground/50 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Recent
          </p>
          <ul className="space-y-1">
            {recent.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground/70 truncate pr-2">{r.reason}</span>
                <span className="shrink-0 font-semibold text-emerald-300">
                  +{r.xp}
                  {r.coins > 0 && <span className="text-amber-300"> · +{r.coins}🪙</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
