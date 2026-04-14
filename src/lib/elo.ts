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

/**
 * Count completed 1v1 matches for a player (excluding a specific match).
 */
async function countPlayerMatches(playerId: string, excludeMatchId?: string): Promise<number> {
  return prisma.match.count({
    where: {
      status: "COMPLETED",
      id: excludeMatchId ? { not: excludeMatchId } : undefined,
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
      homePlayerId: { not: null },
      awayPlayerId: { not: null },
      tournament: {
        gameCategory: { not: "PUBG" },
        participantType: "INDIVIDUAL",
      },
    },
  });
}

// ═══════════════════════════════════════════════════════
// MAIN ELO UPDATE FUNCTION — called after match completion
// ═══════════════════════════════════════════════════════

/**
 * Update ELO ratings for both players after a completed 1v1 match.
 * Idempotent — deletes existing EloHistory for this match first.
 */
export async function updateEloAfterMatch(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { gameCategory: true, participantType: true } },
    },
  });

  if (!match) return;

  // Guard: only 1v1 individual matches, not PUBG
  if (match.tournament.gameCategory === "PUBG") return;
  if (match.tournament.participantType !== "INDIVIDUAL") return;
  if (!match.homePlayerId || !match.awayPlayerId) return;
  if (match.homePlayerId === match.awayPlayerId) return;
  if (match.status !== "COMPLETED") return;

  const homeId = match.homePlayerId;
  const awayId = match.awayPlayerId;

  // Build list of legs to process (each leg = separate ELO calculation)
  const legs: { hScore: number; aScore: number; label: string }[] = [];

  // Leg 1
  legs.push({ hScore: match.homeScore ?? 0, aScore: match.awayScore ?? 0, label: "Leg 1" });

  // Leg 2 (if 2-legged knockout)
  if (match.leg2HomeScore != null) {
    legs.push({ hScore: match.leg2HomeScore ?? 0, aScore: match.leg2AwayScore ?? 0, label: "Leg 2" });
  }

  // Leg 3 / Decider (if aggregate was tied)
  if (match.leg3HomeScore != null) {
    const l3h = match.leg3HomeScore ?? 0;
    const l3a = match.leg3AwayScore ?? 0;
    // If decider was decided by pens, it's a draw in regular time + pen winner
    if (l3h === l3a && match.leg3HomePens != null) {
      // Decider drawn + pens = treat as draw for ELO (pens are luck)
      legs.push({ hScore: l3h, aScore: l3a, label: "Decider" });
    } else {
      legs.push({ hScore: l3h, aScore: l3a, label: "Decider" });
    }
  }

  // Check for existing ELO records for this match (re-edit scenario)
  // If they exist, revert to the FIRST entry's ratingBefore to avoid double-inflation
  const existingElo = await prisma.eloHistory.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
  });
  if (existingElo.length > 0) {
    // Find the earliest ratingBefore for each player
    const firstHome = existingElo.find((e) => e.playerId === homeId);
    const firstAway = existingElo.find((e) => e.playerId === awayId);
    const revertOps = [];
    if (firstHome) revertOps.push(prisma.player.update({ where: { id: homeId }, data: { eloRating: firstHome.ratingBefore } }));
    if (firstAway) revertOps.push(prisma.player.update({ where: { id: awayId }, data: { eloRating: firstAway.ratingBefore } }));
    if (revertOps.length > 0) await prisma.$transaction(revertOps);
  }

  // Delete all existing ELO records for this match
  await prisma.eloHistory.deleteMany({ where: { matchId } });

  // Get current ratings (correctly reverted)
  const [homePlayer, awayPlayer] = await Promise.all([
    prisma.player.findUnique({ where: { id: homeId }, select: { eloRating: true } }),
    prisma.player.findUnique({ where: { id: awayId }, select: { eloRating: true } }),
  ]);

  if (!homePlayer || !awayPlayer) return;

  let currentHomeRating = homePlayer.eloRating;
  let currentAwayRating = awayPlayer.eloRating;

  // Process each leg as a separate ELO calculation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOps: any[] = [];

  for (const leg of legs) {
    const homeCount = await countPlayerMatches(homeId, matchId);
    const awayCount = await countPlayerMatches(awayId, matchId);
    const homeK = getKFactor(homeCount + legs.indexOf(leg)); // account for legs already processed
    const awayK = getKFactor(awayCount + legs.indexOf(leg));

    let homeActual: number, awayActual: number, resultHome: string, resultAway: string;

    if (leg.hScore !== leg.aScore) {
      homeActual = leg.hScore > leg.aScore ? 1.0 : 0.0;
      awayActual = 1.0 - homeActual;
      resultHome = leg.hScore > leg.aScore ? "WIN" : "LOSS";
      resultAway = leg.hScore > leg.aScore ? "LOSS" : "WIN";
    } else {
      homeActual = 0.5;
      awayActual = 0.5;
      resultHome = "DRAW";
      resultAway = "DRAW";
    }

    const homeExp = expectedScore(currentHomeRating, currentAwayRating);
    const awayExp = expectedScore(currentAwayRating, currentHomeRating);
    const homeNew = newRating(currentHomeRating, homeExp, homeActual, homeK);
    const awayNew = newRating(currentAwayRating, awayExp, awayActual, awayK);

    allOps.push(
      prisma.eloHistory.create({
        data: {
          playerId: homeId, matchId,
          ratingBefore: currentHomeRating, ratingAfter: homeNew,
          change: homeNew - currentHomeRating,
          opponentId: awayId, opponentRatingBefore: currentAwayRating,
          result: resultHome, kFactor: homeK,
        },
      }),
      prisma.eloHistory.create({
        data: {
          playerId: awayId, matchId,
          ratingBefore: currentAwayRating, ratingAfter: awayNew,
          change: awayNew - currentAwayRating,
          opponentId: homeId, opponentRatingBefore: currentHomeRating,
          result: resultAway, kFactor: awayK,
        },
      }),
    );

    currentHomeRating = homeNew;
    currentAwayRating = awayNew;
  }

  // Final player rating updates + all history entries
  allOps.push(
    prisma.player.update({
      where: { id: homeId },
      data: { eloRating: currentHomeRating },
    }),
    prisma.player.update({
      where: { id: awayId },
      data: { eloRating: currentAwayRating },
    }),
  );

  await prisma.$transaction(allOps);
}
