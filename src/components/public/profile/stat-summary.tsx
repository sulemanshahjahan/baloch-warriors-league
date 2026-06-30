import Link from "next/link";
import { BarChart3, Trophy, Star, Shield } from "lucide-react";

interface Seg {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub: string;
  tone: string; // text-* colour driving the icon glow
  href?: string;
}

/**
 * Compact 3-up glass stat panel under the hero identity. Presentation only —
 * values come straight from existing player fields (no stat logic changes).
 */
export function StatSummary({
  cardRank,
  elo,
  level,
  tier,
  respect,
}: {
  cardRank: number;
  elo: number;
  level: number;
  tier: string;
  respect: number;
}) {
  const hasElo = elo !== 100; // default rating → show Respect instead
  const segs: Seg[] = [
    { icon: <BarChart3 className="w-4 h-4" />, value: cardRank, label: "OVR", sub: "Player Card", tone: "text-primary" },
    hasElo
      ? { icon: <Trophy className="w-4 h-4" />, value: elo, label: "ELO", sub: "Ranking", tone: "text-yellow-400", href: "/rankings" }
      : { icon: <Shield className="w-4 h-4" />, value: respect, label: "RESPECT", sub: "Standing", tone: "text-emerald-400" },
    { icon: <Star className="w-4 h-4" />, value: `Lvl ${level}`, label: tier, sub: "Player Level", tone: "text-amber-300" },
  ];

  return (
    <div className="bwl-stat-panel mt-4 max-w-md">
      {segs.map((s, i) => {
        const inner = (
          <>
            <span className={`bwl-stat-ico ${s.tone}`}>{s.icon}</span>
            <span className="min-w-0">
              <span className="block text-lg font-black leading-none truncate">{s.value}</span>
              <span className={`block text-[11px] font-bold leading-tight mt-0.5 truncate ${s.tone}`}>{s.label}</span>
              <span className="block text-[10px] text-muted-foreground leading-tight truncate">{s.sub}</span>
            </span>
          </>
        );
        return s.href ? (
          <Link key={i} href={s.href} className="bwl-stat-seg hover:bg-white/[0.03] transition-colors">
            {inner}
          </Link>
        ) : (
          <div key={i} className="bwl-stat-seg">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
