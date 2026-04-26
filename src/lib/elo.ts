import { prisma } from "./db";

// ═══════════════════════════════════════════════════════
// ELO ALGORITHM — Standard with K-factor adjustment
// ═══════════════════════════════════════════════════════

const K_NEW = 40;         // K-factor for players with < 10 matches
const K_ESTABLISHED = 32; // K-factor for players with 10+ matches
const K_THRESHOLD = 10;   // Matches needed to be "established"
const RATING_FLOOR = 10; // minimum rating // Minimum rating

/**
 * Expected score (probability of winning) for player A against player B.
 * Returns value between 0 and 1.
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new rating after a match.
 * actual: 1.0 = win, 0.5 = draw, 0.0 = loss
 */
function newRating(currentRating: number, expected: number, actual: number, kFactor: number): number {
  return Math.max(RATING_FLOOR, Math.round(currentRating + kFactor * (actual - expected)));
}

/**
 * Get K-factor based on number of completed 1v1 matches.
 */
function getKFactor(matchCount: number): number {
  return matchCount < K_THRESHOLD ? K_NEW : K_ESTABLISHED;
}

// ═══════════════════════════════════════════════════════
// MAIN ELO UPDATE FUNCTION — called after match completion
// ═══════════════════════════════════════════════════════

/**
 * Update ELO ratings after a match changes (created, edited, or deleted).
 *
 * Why a full recompute? Surgical per-match updates can't preserve correctness
 * when an old match is edited: the edit's effect must propagate forward through
 * every subsequent match, recalculating each player's expected scores from
 * their corrected (post-edit) rating. Doing this incrementally is fragile —
 * it goes out of sync silently. A full chronological replay is O(N) on a
 * dataset of a few hundred matches, which is fast enough and bulletproof.
 *
 * The matchId argument is kept for API compatibility but is not used.
 */
export async function updateEloAfterMatch(_matchId?: string): Promise<void> {
  await recomputeAllElo();
}

/**
 * Recompute ELO ratings for ALL players from scratch by replaying every
 * completed 1v1 individual match in chronological order.
 */
export async function recomputeAllElo(): Promise<{ matchesProcessed: number }> {
  // Reset all players to 100 ELO and wipe history
  await prisma.player.updateMany({ data: { eloRating: 100 } });
  await prisma.eloHistory.deleteMany({});

  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      homePlayerId: { not: null },
      awayPlayerId: { not: null },
      tournament: {
        gameCategory: { not: "PUBG" },
        participantType: "INDIVIDUAL",
      },
    },
    orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
    },
  });

  const matchCounts = new Map<string, number>();
  // In-memory ratings to avoid one DB roundtrip per leg
  const ratings = new Map<string, number>();

  for (const m of matches) {
    const homeId = m.homePlayerId!;
    const awayId = m.awayPlayerId!;
    if (homeId === awayId) continue;

    const legs: { h: number; a: number }[] = [
      { h: m.homeScore ?? 0, a: m.awayScore ?? 0 },
    ];
    if (m.leg2HomeScore != null) legs.push({ h: m.leg2HomeScore ?? 0, a: m.leg2AwayScore ?? 0 });
    if (m.leg3HomeScore != null) legs.push({ h: m.leg3HomeScore ?? 0, a: m.leg3AwayScore ?? 0 });

    for (const leg of legs) {
      const hR = ratings.get(homeId) ?? 100;
      const aR = ratings.get(awayId) ?? 100;
      const hCount = matchCounts.get(homeId) ?? 0;
      const aCount = matchCounts.get(awayId) ?? 0;
      const hK = getKFactor(hCount);
      const aK = getKFactor(aCount);

      let hActual: number, aActual: number, hRes: string, aRes: string;
      if (leg.h !== leg.a) {
        hActual = leg.h > leg.a ? 1 : 0;
        aActual = 1 - hActual;
        hRes = leg.h > leg.a ? "WIN" : "LOSS";
        aRes = leg.h > leg.a ? "LOSS" : "WIN";
      } else {
        hActual = 0.5;
        aActual = 0.5;
        hRes = "DRAW";
        aRes = "DRAW";
      }

      const hExp = expectedScore(hR, aR);
      const aExp = expectedScore(aR, hR);
      const hNew = newRating(hR, hExp, hActual, hK);
      const aNew = newRating(aR, aExp, aActual, aK);

      await prisma.eloHistory.createMany({
        data: [
          { playerId: homeId, matchId: m.id, ratingBefore: hR, ratingAfter: hNew, change: hNew - hR, opponentId: awayId, opponentRatingBefore: aR, result: hRes, kFactor: hK },
          { playerId: awayId, matchId: m.id, ratingBefore: aR, ratingAfter: aNew, change: aNew - aR, opponentId: homeId, opponentRatingBefore: hR, result: aRes, kFactor: aK },
        ],
      });

      ratings.set(homeId, hNew);
      ratings.set(awayId, aNew);
      matchCounts.set(homeId, hCount + 1);
      matchCounts.set(awayId, aCount + 1);
    }
  }

  // Persist final ratings to player rows
  for (const [playerId, rating] of ratings.entries()) {
    await prisma.player.update({ where: { id: playerId }, data: { eloRating: rating } });
  }

  return { matchesProcessed: matches.length };
}
