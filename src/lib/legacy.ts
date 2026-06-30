// BWL Legacy progression — pure helpers (no DB, easily testable).
// Legacy XP is a permanent, status-only progression. It must NEVER affect ELO,
// cardRank, matchmaking, or tournament results.

export const MAX_LEGACY_LEVEL = 60;

// XP needed to go FROM `level` to `level + 1`.
function xpForLevelStep(level: number): number {
  return Math.floor(400 * Math.pow(level, 1.35));
}

// Cumulative XP required to REACH each level. CUMULATIVE[1] = 0.
const CUMULATIVE: number[] = (() => {
  const arr = [0, 0]; // index 0 unused; level 1 = 0
  for (let level = 2; level <= MAX_LEGACY_LEVEL + 1; level++) {
    arr[level] = arr[level - 1] + xpForLevelStep(level - 1);
  }
  return arr;
})();

/** Cumulative XP required to reach a given level (level 1 = 0). */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEGACY_LEVEL) return CUMULATIVE[MAX_LEGACY_LEVEL];
  return CUMULATIVE[level];
}

/** The level a player is at for a given lifetime XP total. */
export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (level < MAX_LEGACY_LEVEL && totalXp >= CUMULATIVE[level + 1]) level++;
  return level;
}

export const LEGACY_TIERS = [
  { tier: "Rookie", min: 1, max: 9 },
  { tier: "Regular", min: 10, max: 19 },
  { tier: "Contender", min: 20, max: 34 },
  { tier: "Star", min: 35, max: 49 },
  { tier: "Elite", min: 50, max: 69 },
  { tier: "Legend", min: 70, max: 89 },
  { tier: "Hall of Fame", min: 90, max: 100 },
] as const;

export function tierForLevel(level: number): string {
  return LEGACY_TIERS.find((t) => level >= t.min && level <= t.max)?.tier ?? "Rookie";
}

export interface LegacyProgress {
  level: number;
  tier: string;
  totalXp: number;
  xpIntoLevel: number; // XP earned within the current level
  xpForNextLevel: number; // XP span of the current level
  nextLevel: number | null; // null if max
  progressPercent: number; // 0..100 within current level
  isMaxLevel: boolean;
}

/** Full progress snapshot for display from a lifetime XP total. */
export function legacyProgress(totalXp: number): LegacyProgress {
  const level = levelFromXp(totalXp);
  const tier = tierForLevel(level);
  const isMaxLevel = level >= MAX_LEGACY_LEVEL;

  const base = cumulativeXpForLevel(level);
  const next = isMaxLevel ? base : cumulativeXpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const xpIntoLevel = Math.max(0, totalXp - base);
  const progressPercent = isMaxLevel ? 100 : Math.min(100, Math.round((xpIntoLevel / span) * 100));

  return {
    level,
    tier,
    totalXp,
    xpIntoLevel,
    xpForNextLevel: span,
    nextLevel: isMaxLevel ? null : level + 1,
    progressPercent,
    isMaxLevel,
  };
}
