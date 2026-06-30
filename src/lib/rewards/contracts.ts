import { prisma } from "@/lib/db";

// Match Contracts — daily/weekly challenges completed through normal play.
// Auto-granted on completion (no manual claim for MVP).

export interface ContractTemplate {
  key: string;
  type: "DAILY" | "WEEKLY";
  title: string;
  condition: "PLAY_MATCHES" | "WIN_MATCHES" | "CLEAN_SHEETS";
  target: number;
  xp: number;
  coins: number;
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  { key: "DAILY_PLAY_1", type: "DAILY", title: "Play 1 match today", condition: "PLAY_MATCHES", target: 1, xp: 100, coins: 50 },
  { key: "WEEKLY_PLAY_5", type: "WEEKLY", title: "Play 5 matches this week", condition: "PLAY_MATCHES", target: 5, xp: 500, coins: 250 },
  { key: "WEEKLY_WIN_3", type: "WEEKLY", title: "Win 3 matches this week", condition: "WIN_MATCHES", target: 3, xp: 600, coins: 300 },
  { key: "WEEKLY_CLEAN_2", type: "WEEKLY", title: "Keep 2 clean sheets this week", condition: "CLEAN_SHEETS", target: 2, xp: 400, coins: 200 },
];

const pad = (n: number) => String(n).padStart(2, "0");

// All period keys use Karachi time (UTC+5).
function karachiParts() {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

export function dailyPeriodKey(): string {
  const { y, m, day } = karachiParts();
  return `${y}-${pad(m + 1)}-${pad(day)}`;
}

export function weeklyPeriodKey(): string {
  const { y, m, day } = karachiParts();
  const date = new Date(Date.UTC(y, m, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Make sure the player has this period's daily + weekly contracts. */
export async function ensurePlayerContracts(playerId: string): Promise<void> {
  const today = dailyPeriodKey();
  const week = weeklyPeriodKey();
  await prisma.playerContract.createMany({
    data: CONTRACT_TEMPLATES.map((t) => ({
      playerId,
      templateKey: t.key,
      period: t.type === "DAILY" ? today : week,
      type: t.type,
      title: t.title,
      condition: t.condition,
      target: t.target,
      rewardXp: t.xp,
      rewardCoins: t.coins,
    })),
    skipDuplicates: true,
  });
}

/**
 * Advance a player's active contracts for a condition, completing + auto-rewarding
 * any that hit their target. Only current-period contracts progress.
 */
export async function bumpContracts(
  playerId: string,
  condition: ContractTemplate["condition"],
  amount = 1,
): Promise<void> {
  if (amount <= 0) return;
  await ensurePlayerContracts(playerId);
  const periods = [dailyPeriodKey(), weeklyPeriodKey()];

  const contracts = await prisma.playerContract.findMany({
    where: { playerId, condition, status: "ACTIVE", period: { in: periods } },
  });

  for (const c of contracts) {
    const progress = Math.min(c.target, c.progress + amount);
    const completed = progress >= c.target;
    await prisma.playerContract.update({
      where: { id: c.id },
      data: { progress, ...(completed ? { status: "COMPLETED", completedAt: new Date() } : {}) },
    });
    if (completed) {
      const { awardReward } = await import("./reward-engine");
      await awardReward({
        playerId,
        xp: c.rewardXp,
        coins: c.rewardCoins,
        source: "CONTRACT",
        sourceId: c.id,
        reason: `Contract: ${c.title}`,
      });
    }
  }
}
