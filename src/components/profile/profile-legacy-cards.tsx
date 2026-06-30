import { CalendarClock } from "lucide-react";

// ── Season Progress ───────────────────────────────────────────

interface SeasonCardProps {
  name: string;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  nextLevel: number | null;
  daysLeft: number | null;
}

export function SeasonProgressCard(p: SeasonCardProps) {
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-indigo-700/10 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-sky-300" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/90">{p.name}</h3>
        </div>
        {p.daysLeft != null && (
          <span className="text-xs text-sky-200/80">{p.daysLeft > 0 ? `${p.daysLeft}d left` : "Ending"}</span>
        )}
      </div>
      <div className="flex items-end justify-between mb-1.5">
        <p className="text-2xl font-black text-foreground">Season Lvl {p.level}</p>
        <p className="text-xs text-foreground/60 mb-0.5">
          {p.nextLevel ? `${p.xpIntoLevel} / ${p.xpForNextLevel} XP` : "Max"}
        </p>
      </div>
      <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-300" style={{ width: `${p.progressPercent}%` }} />
      </div>
    </div>
  );
}
