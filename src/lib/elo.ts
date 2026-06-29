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
 * completed ELO-rated match in chronological order.
 *
 * Includes:
 *  - 1v1 individual (eFootball etc.) — player vs player.
 *  - 2v2 duos — each member is rated against the opponent duo's AVERAGE rating,
 *    gaining/losing on the duo's result. Both members are updated.
 */
export async function recomputeAllElo(): Promise<{ matchesProcessed: number }> {
  // Reset all players to 100 ELO and wipe history
  await prisma.player.updateMany({ data: { eloRating: 100 } });
  await prisma.eloHistory.deleteMany({});

  const [singles, duos] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        homePlayerId: { not: null },
        awayPlayerId: { not: null },
        tournament: { gameCategory: { not: "PUBG" }, participantType: "INDIVIDUAL" },
      },
      select: {
        id: true, completedAt: true, createdAt: true,
        homePlayerId: true, awayPlayerId: true,
        homeScore: true, awayScore: true,
        leg2HomeScore: true, leg2AwayScore: true,
        leg3HomeScore: true, leg3AwayScore: true,
      },
    }),
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        homeTeam: { isDuo: true },
        awayTeam: { isDuo: true },
        tournament: { gameCategory: { not: "PUBG" } },
      },
      select: {
        id: true, completedAt: true, createdAt: true,
        homeScore: true, awayScore: true,
        leg2HomeScore: true, leg2AwayScore: true,
        leg3HomeScore: true, leg3AwayScore: true,
        homeTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
        awayTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
      },
    }),
  ]);

  // Merge into one chronological timeline so 1v1 and 2v2 results interleave.
  type TimelineMatch =
    | ({ kind: "1v1" } & (typeof singles)[number])
    | ({ kind: "2v2" } & (typeof duos)[number]);
  const timeline: TimelineMatch[] = [
    ...singles.map((m) => ({ kind: "1v1" as const, ...m })),
    ...duos.map((m) => ({ kind: "2v2" as const, ...m })),
  ].sort((a, b) => {
    const at = a.completedAt?.getTime() ?? 0;
    const bt = b.completedAt?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });

  const matchCounts = new Map<string, number>();
  const ratings = new Map<string, number>(); // in-memory to avoid per-leg roundtrips
  const avg = (ids: string[]) => ids.reduce((s, id) => s + (ratings.get(id) ?? 100), 0) / ids.length;
  const legsOf = (m: { homeScore: number | null; awayScore: number | null; leg2HomeScore: number | null; leg2AwayScore: number | null; leg3HomeScore: number | null; leg3AwayScore: number | null }) => {
    const legs: { h: number; a: number }[] = [{ h: m.homeScore ?? 0, a: m.awayScore ?? 0 }];
    if (m.leg2HomeScore != null) legs.push({ h: m.leg2HomeScore ?? 0, a: m.leg2AwayScore ?? 0 });
    if (m.leg3HomeScore != null) legs.push({ h: m.leg3HomeScore ?? 0, a: m.leg3AwayScore ?? 0 });
    return legs;
  };

  for (const m of timeline) {
    if (m.kind === "1v1") {
      const homeId = m.homePlayerId!;
      const awayId = m.awayPlayerId!;
      if (homeId === awayId) continue;

      for (const leg of legsOf(m)) {
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
          hActual = 0.5; aActual = 0.5; hRes = "DRAW"; aRes = "DRAW";
        }

        const hNew = newRating(hR, expectedScore(hR, aR), hActual, hK);
        const aNew = newRating(aR, expectedScore(aR, hR), aActual, aK);

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
    } else {
      // 2v2 duo — each member vs the opponent duo's average.
      const homeIds = m.homeTeam?.players.map((p) => p.playerId) ?? [];
      const awayIds = m.awayTeam?.players.map((p) => p.playerId) ?? [];
      if (homeIds.length === 0 || awayIds.length === 0) continue;

      for (const leg of legsOf(m)) {
        const homeAvg = avg(homeIds);
        const awayAvg = avg(awayIds);

        let hActual: number, aActual: number, hRes: string, aRes: string;
        if (leg.h !== leg.a) {
          hActual = leg.h > leg.a ? 1 : 0;
          aActual = 1 - hActual;
          hRes = leg.h > leg.a ? "WIN" : "LOSS";
          aRes = leg.h > leg.a ? "LOSS" : "WIN";
        } else {
          hActual = 0.5; aActual = 0.5; hRes = "DRAW"; aRes = "DRAW";
        }

        const rows: { playerId: string; matchId: string; ratingBefore: number; ratingAfter: number; change: number; opponentId: string; opponentRatingBefore: number; result: string; kFactor: number }[] = [];

        for (const id of homeIds) {
          const r = ratings.get(id) ?? 100;
          const k = getKFactor(matchCounts.get(id) ?? 0);
          const nr = newRating(r, expectedScore(r, awayAvg), hActual, k);
          rows.push({ playerId: id, matchId: m.id, ratingBefore: r, ratingAfter: nr, change: nr - r, opponentId: awayIds[0], opponentRatingBefore: Math.round(awayAvg), result: hRes, kFactor: k });
        }
        for (const id of awayIds) {
          const r = ratings.get(id) ?? 100;
          const k = getKFactor(matchCounts.get(id) ?? 0);
          const nr = newRating(r, expectedScore(r, homeAvg), aActual, k);
          rows.push({ playerId: id, matchId: m.id, ratingBefore: r, ratingAfter: nr, change: nr - r, opponentId: homeIds[0], opponentRatingBefore: Math.round(homeAvg), result: aRes, kFactor: k });
        }

        await prisma.eloHistory.createMany({ data: rows });
        for (const row of rows) {
          ratings.set(row.playerId, row.ratingAfter);
          matchCounts.set(row.playerId, (matchCounts.get(row.playerId) ?? 0) + 1);
        }
      }
    }
  }

  // Persist final ratings to player rows
  for (const [playerId, rating] of ratings.entries()) {
    await prisma.player.update({ where: { id: playerId }, data: { eloRating: rating } });
  }

  return { matchesProcessed: timeline.length };
}
