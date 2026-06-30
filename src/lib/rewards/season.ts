import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Season progression — resets each season. Uses the existing Season model
// (isActive flag) and a simple, easy-to-fill curve (seasons are short).

export const MAX_SEASON_LEVEL = 30;

// XP to go from `level` to `level + 1`.
function seasonStep(level: number): number {
  return 400 + (level - 1) * 120;
}

const SEASON_CUMULATIVE: number[] = (() => {
  const arr = [0, 0];
  for (let level = 2; level <= MAX_SEASON_LEVEL + 1; level++) {
    arr[level] = arr[level - 1] + seasonStep(level - 1);
  }
  return arr;
})();

export function seasonLevelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_SEASON_LEVEL && xp >= SEASON_CUMULATIVE[level + 1]) level++;
  return level;
}

export interface SeasonProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  nextLevel: number | null;
  progressPercent: number;
  isMaxLevel: boolean;
}

export function seasonProgress(xp: number): SeasonProgress {
  const level = seasonLevelFromXp(xp);
  const isMaxLevel = level >= MAX_SEASON_LEVEL;
  const base = SEASON_CUMULATIVE[level] ?? 0;
  const next = isMaxLevel ? base : SEASON_CUMULATIVE[level + 1];
  const span = Math.max(1, next - base);
  const xpIntoLevel = Math.max(0, xp - base);
  return {
    level,
    xpIntoLevel,
    xpForNextLevel: span,
    nextLevel: isMaxLevel ? null : level + 1,
    progressPercent: isMaxLevel ? 100 : Math.min(100, Math.round((xpIntoLevel / span) * 100)),
    isMaxLevel,
  };
}

export interface ActiveSeason {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
}

/** The currently active season, or null if none is running. */
export async function getActiveSeason(): Promise<ActiveSeason | null> {
  const s = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  return s ?? null;
}

/** Award season XP once (idempotent per player+season+source+event). */
export async function awardSeasonXp(opts: {
  playerId: string;
  seasonId: string;
  xp: number;
  source: string;
  sourceId?: string | null;
  reason: string;
}): Promise<void> {
  const { playerId, seasonId, xp, source, sourceId = null, reason } = opts;
  try {
    await prisma.seasonXpTransaction.create({ data: { playerId, seasonId, xp, source, sourceId, reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
  const progress = await prisma.playerSeasonProgress.upsert({
    where: { playerId_seasonId: { playerId, seasonId } },
    create: { playerId, seasonId, seasonXp: xp, level: 1 },
    update: { seasonXp: { increment: xp } },
    select: { seasonXp: true },
  });
  await prisma.playerSeasonProgress.update({
    where: { playerId_seasonId: { playerId, seasonId } },
    data: { level: seasonLevelFromXp(progress.seasonXp) },
  });
}
