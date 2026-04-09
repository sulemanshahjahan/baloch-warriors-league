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

  // Determine result — check penalty shootout if regular time is drawn
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  let homeActual: number; // 1.0 = win, 0.5 = draw, 0.0 = loss
  let awayActual: number;
  let resultHome: string;
  let resultAway: string;

  if (homeScore !== awayScore) {
    // Clear winner in regular time
    homeActual = homeScore > awayScore ? 1.0 : 0.0;
    awayActual = 1.0 - homeActual;
    resultHome = homeScore > awayScore ? "WIN" : "LOSS";
    resultAway = homeScore > awayScore ? "LOSS" : "WIN";
  } else if (match.homeScorePens != null && match.awayScorePens != null) {
    // Penalty shootout decides
    homeActual = match.homeScorePens > match.awayScorePens ? 1.0 : 0.0;
    awayActual = 1.0 - homeActual;
    resultHome = match.homeScorePens > match.awayScorePens ? "WIN" : "LOSS";
    resultAway = match.homeScorePens > match.awayScorePens ? "LOSS" : "WIN";
  } else {
    // True draw
    homeActual = 0.5;
    awayActual = 0.5;
    resultHome = "DRAW";
    resultAway = "DRAW";
  }

  // Delete existing ELO records for this match (idempotency)
  await prisma.eloHistory.deleteMany({ where: { matchId } });

  // Get current ratings
  const [homePlayer, awayPlayer] = await Promise.all([
    prisma.player.findUnique({ where: { id: homeId }, select: { eloRating: true } }),
    prisma.player.findUnique({ where: { id: awayId }, select: { eloRating: true } }),
  ]);

  if (!homePlayer || !awayPlayer) return;

  const homeRating = homePlayer.eloRating;
  const awayRating = awayPlayer.eloRating;

  // Get match counts for K-factor
  const [homeCount, awayCount] = await Promise.all([
    countPlayerMatches(homeId, matchId),
    countPlayerMatches(awayId, matchId),
  ]);

  const homeK = getKFactor(homeCount);
  const awayK = getKFactor(awayCount);

  // Calculate new ratings
  const homeExpected = expectedScore(homeRating, awayRating);
  const awayExpected = expectedScore(awayRating, homeRating);

  const homeNewRating = newRating(homeRating, homeExpected, homeActual, homeK);
  const awayNewRating = newRating(awayRating, awayExpected, awayActual, awayK);

  const homeChange = homeNewRating - homeRating;
  const awayChange = awayNewRating - awayRating;

  // Save in a transaction
  await prisma.$transaction([
    // ELO history for home player
    prisma.eloHistory.create({
      data: {
        playerId: homeId,
        matchId,
        ratingBefore: homeRating,
        ratingAfter: homeNewRating,
        change: homeChange,
        opponentId: awayId,
        opponentRatingBefore: awayRating,
        result: resultHome,
        kFactor: homeK,
      },
    }),
    // ELO history for away player
    prisma.eloHistory.create({
      data: {
        playerId: awayId,
        matchId,
        ratingBefore: awayRating,
        ratingAfter: awayNewRating,
        change: awayChange,
        opponentId: homeId,
        opponentRatingBefore: homeRating,
        result: resultAway,
        kFactor: awayK,
      },
    }),
    // Update player ratings
    prisma.player.update({
      where: { id: homeId },
      data: { eloRating: homeNewRating },
    }),
    prisma.player.update({
      where: { id: awayId },
      data: { eloRating: awayNewRating },
    }),
  ]);
}
