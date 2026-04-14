"use server";

import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const K_NEW = 40;
const K_ESTABLISHED = 32;
const K_THRESHOLD = 10;
const RATING_FLOOR = 10;

function expectedScore(rA: number, rB: number) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function newRating(cur: number, exp: number, actual: number, k: number) {
  return Math.max(RATING_FLOOR, Math.round(cur + k * (actual - exp)));
}

/**
 * Reorder matches by setting completedAt timestamps in the given order,
 * then recalculate all ELO from scratch.
 */
export async function reorderAndRecalculateElo(
  orderedMatchIds: string[],
): Promise<{ success: boolean; error?: string; processed?: number }> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
  const userRole = getUserRole(session);
  if ((ROLE_LEVELS[userRole] ?? 0) < 2) return { success: false, error: "Admin required" };

  // Step 1: Set completedAt in order (1 second apart)
  const baseTime = new Date("2026-01-01T00:00:00Z");
  for (let i = 0; i < orderedMatchIds.length; i++) {
    const completedAt = new Date(baseTime.getTime() + i * 1000);
    await prisma.match.update({
      where: { id: orderedMatchIds[i] },
      data: { completedAt },
    });
  }

  // Step 2: Reset all players to 100 ELO
  await prisma.player.updateMany({ data: { eloRating: 100 } });
  await prisma.eloHistory.deleteMany({});

  // Step 3: Recalculate ELO in the new order
  const matches = await prisma.match.findMany({
    where: { id: { in: orderedMatchIds } },
    orderBy: { completedAt: "asc" },
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

  for (const m of matches) {
    const hId = m.homePlayerId!;
    const aId = m.awayPlayerId!;

    const legs: { h: number; a: number }[] = [
      { h: m.homeScore ?? 0, a: m.awayScore ?? 0 },
    ];
    if (m.leg2HomeScore != null) legs.push({ h: m.leg2HomeScore ?? 0, a: m.leg2AwayScore ?? 0 });
    if (m.leg3HomeScore != null) legs.push({ h: m.leg3HomeScore ?? 0, a: m.leg3AwayScore ?? 0 });

    for (const leg of legs) {
      const hPl = await prisma.player.findUnique({ where: { id: hId }, select: { eloRating: true } });
      const aPl = await prisma.player.findUnique({ where: { id: aId }, select: { eloRating: true } });
      if (!hPl || !aPl) continue;

      const hR = hPl.eloRating, aR = aPl.eloRating;
      const hC = matchCounts.get(hId) ?? 0, aC = matchCounts.get(aId) ?? 0;
      const hK = hC < K_THRESHOLD ? K_NEW : K_ESTABLISHED;
      const aK = aC < K_THRESHOLD ? K_NEW : K_ESTABLISHED;

      let hA: number, aA: number, rH: string, rA: string;
      if (leg.h !== leg.a) {
        hA = leg.h > leg.a ? 1 : 0; aA = 1 - hA;
        rH = leg.h > leg.a ? "WIN" : "LOSS"; rA = leg.h > leg.a ? "LOSS" : "WIN";
      } else {
        hA = 0.5; aA = 0.5; rH = "DRAW"; rA = "DRAW";
      }

      const hE = expectedScore(hR, aR), aE = expectedScore(aR, hR);
      const hN = newRating(hR, hE, hA, hK), aN = newRating(aR, aE, aA, aK);

      await prisma.$transaction([
        prisma.eloHistory.create({
          data: { playerId: hId, matchId: m.id, ratingBefore: hR, ratingAfter: hN, change: hN - hR, opponentId: aId, opponentRatingBefore: aR, result: rH, kFactor: hK },
        }),
        prisma.eloHistory.create({
          data: { playerId: aId, matchId: m.id, ratingBefore: aR, ratingAfter: aN, change: aN - aR, opponentId: hId, opponentRatingBefore: hR, result: rA, kFactor: aK },
        }),
        prisma.player.update({ where: { id: hId }, data: { eloRating: hN } }),
        prisma.player.update({ where: { id: aId }, data: { eloRating: aN } }),
      ]);
    }

    matchCounts.set(hId, (matchCounts.get(hId) ?? 0) + 1);
    matchCounts.set(aId, (matchCounts.get(aId) ?? 0) + 1);
  }

  return { success: true, processed: matches.length };
}
