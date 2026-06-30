import { CalendarClock, ScrollText, ShieldCheck, CheckCircle2, Coins } from "lucide-react";

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

// ── Active Contracts ──────────────────────────────────────────

interface ContractView {
  id: string;
  title: string;
  type: string;
  progress: number;
  target: number;
  status: string;
  rewardXp: number;
  rewardCoins: number;
}

export function ActiveContractsCard({ contracts }: { contracts: ContractView[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4 text-amber-300" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/90">Active Contracts</h3>
      </div>
      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">New contracts appear after your next match.</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const done = c.status === "COMPLETED";
            const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
            return (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${done ? "text-emerald-400" : ""}`}>
                    {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {c.title}
                  </span>
                  <span className="text-xs shrink-0 text-emerald-300 font-semibold">
                    +{c.rewardXp}
                    {c.rewardCoins > 0 && <span className="text-amber-300"> · +{c.rewardCoins}🪙</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${done ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{Math.min(c.progress, c.target)}/{c.target}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Respect Score ─────────────────────────────────────────────

const RESPECT_COLOR = (score: number) =>
  score >= 90 ? "text-emerald-400 border-emerald-500/30"
  : score >= 75 ? "text-sky-400 border-sky-500/30"
  : score >= 60 ? "text-amber-300 border-amber-500/30"
  : score >= 40 ? "text-orange-400 border-orange-500/30"
  : "text-red-400 border-red-500/30";

export function RespectCard({ score, label }: { score: number; label: string }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 sm:p-5 ${RESPECT_COLOR(score).split(" ")[1]}`}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className={`w-4 h-4 ${RESPECT_COLOR(score).split(" ")[0]}`} />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/90">Respect</h3>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-3xl font-black ${RESPECT_COLOR(score).split(" ")[0]}`}>{score}</p>
        <p className="text-xs text-foreground/60 mb-1">/ 100 · {label}</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full bg-current ${RESPECT_COLOR(score).split(" ")[0]}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
        <Coins className="w-3 h-3" /> Earned by completing matches & tournaments fairly.
      </p>
    </div>
  );
}
