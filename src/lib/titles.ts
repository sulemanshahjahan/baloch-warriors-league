/**
 * Player titles — exclusive, awarded to top players in a category.
 * Unlike badges (which anyone can earn), titles are competitive.
 * Computed server-side from current stats.
 */

export interface PlayerTitle {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  playerId: string;
}

export interface TitleCandidate {
  playerId: string;
  playerName: string;
  goals: number;
  wins: number;
  cleanSheets: number;
  matches: number;
  eloRating: number;
  eloGainedLast30Days: number;
  giantKillings: number;
  winRate: number;
  longestWinStreak: number;
}

export const TITLE_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  pick: (candidates: TitleCandidate[]) => TitleCandidate | null;
}> = [
  {
    id: "top_scorer",
    name: "Top Scorer",
    description: "Most career goals",
    icon: "⚽",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    pick: (c) => pickMax(c, (p) => p.goals, 1),
  },
  {
    id: "the_wall",
    name: "The Wall",
    description: "Most clean sheets",
    icon: "🛡️",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    pick: (c) => pickMax(c, (p) => p.cleanSheets, 3),
  },
  {
    id: "champion",
    name: "Champion",
    description: "Highest ELO rating",
    icon: "👑",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    pick: (c) => pickMax(c.filter((p) => p.matches >= 5), (p) => p.eloRating, 1),
  },
  {
    id: "rising_star",
    name: "Rising Star",
    description: "Biggest ELO gain (last 30 days)",
    icon: "🌟",
    color: "text-pink-400 bg-pink-500/10 border-pink-500/30",
    pick: (c) => pickMax(c, (p) => p.eloGainedLast30Days, 30),
  },
  {
    id: "giant_slayer",
    name: "Giant Slayer",
    description: "Most upset wins vs higher-rated players",
    icon: "⚔️",
    color: "text-red-400 bg-red-500/10 border-red-500/30",
    pick: (c) => pickMax(c, (p) => p.giantKillings, 2),
  },
  {
    id: "consistent",
    name: "Mr. Consistent",
    description: "Best win rate (min 10 matches)",
    icon: "💯",
    color: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    pick: (c) => pickMax(c.filter((p) => p.matches >= 10), (p) => p.winRate, 0.5),
  },
  {
    id: "streaker",
    name: "The Streaker",
    description: "Longest win streak",
    icon: "⚡",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    pick: (c) => pickMax(c, (p) => p.longestWinStreak, 3),
  },
];

function pickMax<T>(arr: T[], getter: (item: T) => number, minValue: number): T | null {
  if (arr.length === 0) return null;
  let best = arr[0];
  let bestVal = getter(best);
  for (const item of arr.slice(1)) {
    const v = getter(item);
    if (v > bestVal) {
      best = item;
      bestVal = v;
    }
  }
  return bestVal >= minValue ? best : null;
}

export function computeTitles(candidates: TitleCandidate[]): Map<string, PlayerTitle[]> {
  const byPlayer = new Map<string, PlayerTitle[]>();
  for (const def of TITLE_DEFINITIONS) {
    const winner = def.pick(candidates);
    if (!winner) continue;
    const existing = byPlayer.get(winner.playerId) ?? [];
    existing.push({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      color: def.color,
      playerId: winner.playerId,
    });
    byPlayer.set(winner.playerId, existing);
  }
  return byPlayer;
}
