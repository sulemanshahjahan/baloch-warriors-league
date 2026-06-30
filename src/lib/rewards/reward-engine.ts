import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { levelFromXp, tierForLevel } from "@/lib/legacy";

// Central BWL reward engine. Awards Legacy XP + coins through an idempotent
// ledger (one row per player+source+event), so match completion can be retried
// safely without ever double-paying. Status only — never touches ELO/cardRank.

export interface AwardInput {
  playerId: string;
  xp?: number;
  coins?: number;
  source: string;
  sourceId?: string | null;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}

/** Award XP/coins once. Returns false if this exact reward was already granted. */
export async function awardReward(input: AwardInput): Promise<{ awarded: boolean }> {
  const { playerId, xp = 0, coins = 0, source, sourceId = null, reason, metadata } = input;

  try {
    await prisma.legacyXpTransaction.create({
      data: { playerId, xp, coins, source, sourceId, reason, ...(metadata !== undefined ? { metadata } : {}) },
    });
  } catch (e) {
    // P2002 = unique constraint → already awarded for this (player, source, event).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { awarded: false };
    }
    throw e;
  }

  if (xp !== 0 || coins !== 0) {
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: { legacyXp: { increment: xp }, coins: { increment: coins } },
      select: { legacyXp: true },
    });
    const level = levelFromXp(updated.legacyXp);
    await prisma.player.update({
      where: { id: playerId },
      data: { legacyLevel: level, legacyTier: tierForLevel(level) },
    });
  }

  return { awarded: true };
}

// ── XP / coin values for match events ──────────────────────────
const R = {
  PLAYED: { xp: 50, coins: 20 },
  WIN: { xp: 40, coins: 30 },
  DRAW: { xp: 20, coins: 10 },
  LOSS: { xp: 15, coins: 5 },
  CLEAN_SHEET: { xp: 25, coins: 15 },
  THREE_GOALS: { xp: 20, coins: 10 },
  MOTM: { xp: 30, coins: 20 },
} as const;

function aggregate(home: boolean, m: {
  homeScore: number | null; awayScore: number | null;
  leg2HomeScore: number | null; leg2AwayScore: number | null;
  leg3HomeScore: number | null; leg3AwayScore: number | null;
}) {
  const h = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
  const a = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
  return home ? { mine: h, opp: a } : { mine: a, opp: h };
}

/**
 * Grant Legacy XP + coins to every participant of a completed match.
 * Handles 1v1 (players) and 2v2/team (duo/team members). Idempotent.
 */
export async function processMatchLegacyRewards(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true, status: true, motmPlayerId: true,
      homePlayerId: true, awayPlayerId: true,
      homeScore: true, awayScore: true,
      leg2HomeScore: true, leg2AwayScore: true,
      leg3HomeScore: true, leg3AwayScore: true,
      tournament: { select: { gameCategory: true } },
      homeTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
      awayTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
    },
  });
  if (!match || match.status !== "COMPLETED") return;

  const homePlayers = match.homePlayerId ? [match.homePlayerId] : (match.homeTeam?.players.map((p) => p.playerId) ?? []);
  const awayPlayers = match.awayPlayerId ? [match.awayPlayerId] : (match.awayTeam?.players.map((p) => p.playerId) ?? []);
  if (homePlayers.length === 0 && awayPlayers.length === 0) return; // e.g. PUBG — handled elsewhere

  const game = match.tournament.gameCategory;
  const supportsCleanSheet = game === "EFOOTBALL" || game === "FOOTBALL";

  const sides: { players: string[]; home: boolean }[] = [
    { players: homePlayers, home: true },
    { players: awayPlayers, home: false },
  ];

  for (const side of sides) {
    const { mine, opp } = aggregate(side.home, match);
    const result = mine > opp ? "WIN" : mine < opp ? "LOSS" : "DRAW";
    const cleanSheet = supportsCleanSheet && opp === 0;
    const threeGoals = supportsCleanSheet && mine >= 3;

    for (const playerId of side.players) {
      await awardReward({ playerId, ...R.PLAYED, source: "MATCH_PLAYED", sourceId: matchId, reason: "Played a match" });
      if (result === "WIN") await awardReward({ playerId, ...R.WIN, source: "MATCH_WIN", sourceId: matchId, reason: "Won a match" });
      else if (result === "DRAW") await awardReward({ playerId, ...R.DRAW, source: "MATCH_DRAW", sourceId: matchId, reason: "Drew a match" });
      else await awardReward({ playerId, ...R.LOSS, source: "MATCH_LOSS", sourceId: matchId, reason: "Completed a match" });
      if (cleanSheet) await awardReward({ playerId, ...R.CLEAN_SHEET, source: "CLEAN_SHEET", sourceId: matchId, reason: "Kept a clean sheet" });
      if (threeGoals) await awardReward({ playerId, ...R.THREE_GOALS, source: "THREE_GOALS", sourceId: matchId, reason: "Scored 3+ goals" });
    }
  }

  if (match.motmPlayerId) {
    await awardReward({ playerId: match.motmPlayerId, ...R.MOTM, source: "MOTM", sourceId: matchId, reason: "Man of the Match" });
  }
}
