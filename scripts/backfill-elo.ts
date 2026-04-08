/**
 * Backfill ELO ratings from all historical 1v1 match data.
 * Processes matches in chronological order.
 *
 * Run: npx tsx scripts/backfill-elo.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const K_NEW = 40;
const K_ESTABLISHED = 32;
const K_THRESHOLD = 10;
const RATING_FLOOR = 100;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function newRating(current: number, expected: number, actual: number, k: number): number {
  return Math.max(RATING_FLOOR, Math.round(current + k * (actual - expected)));
}

async function main() {
  console.log("Resetting all ELO data...");

  // Reset all players to 1500
  await prisma.player.updateMany({ data: { eloRating: 1500 } });

  // Delete all ELO history
  await prisma.eloHistory.deleteMany({});

  // Get all completed 1v1 matches (non-PUBG) in chronological order
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
    orderBy: { completedAt: "asc" },
    select: {
      id: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeScore: true,
      awayScore: true,
      homeScorePens: true,
      awayScorePens: true,
    },
  });

  console.log(`Found ${matches.length} 1v1 matches to process`);

  // Track ratings and match counts in memory
  const ratings = new Map<string, number>();
  const matchCounts = new Map<string, number>();

  let processed = 0;

  for (const match of matches) {
    const homeId = match.homePlayerId!;
    const awayId = match.awayPlayerId!;
    if (homeId === awayId) continue;

    const homeRating = ratings.get(homeId) ?? 1500;
    const awayRating = ratings.get(awayId) ?? 1500;
    const homeCount = matchCounts.get(homeId) ?? 0;
    const awayCount = matchCounts.get(awayId) ?? 0;

    // Determine result
    const hs = match.homeScore ?? 0;
    const as = match.awayScore ?? 0;
    let homeActual: number;
    let resultHome: string;
    let resultAway: string;

    if (hs !== as) {
      homeActual = hs > as ? 1.0 : 0.0;
      resultHome = hs > as ? "WIN" : "LOSS";
      resultAway = hs > as ? "LOSS" : "WIN";
    } else if (match.homeScorePens != null && match.awayScorePens != null) {
      homeActual = match.homeScorePens > match.awayScorePens ? 1.0 : 0.0;
      resultHome = match.homeScorePens > match.awayScorePens ? "WIN" : "LOSS";
      resultAway = match.homeScorePens > match.awayScorePens ? "LOSS" : "WIN";
    } else {
      homeActual = 0.5;
      resultHome = "DRAW";
      resultAway = "DRAW";
    }
    const awayActual = 1.0 - homeActual;

    const homeK = homeCount < K_THRESHOLD ? K_NEW : K_ESTABLISHED;
    const awayK = awayCount < K_THRESHOLD ? K_NEW : K_ESTABLISHED;

    const homeExp = expectedScore(homeRating, awayRating);
    const awayExp = expectedScore(awayRating, homeRating);

    const homeNew = newRating(homeRating, homeExp, homeActual, homeK);
    const awayNew = newRating(awayRating, awayExp, awayActual, awayK);

    // Create history records
    await prisma.eloHistory.createMany({
      data: [
        {
          playerId: homeId,
          matchId: match.id,
          ratingBefore: homeRating,
          ratingAfter: homeNew,
          change: homeNew - homeRating,
          opponentId: awayId,
          opponentRatingBefore: awayRating,
          result: resultHome,
          kFactor: homeK,
        },
        {
          playerId: awayId,
          matchId: match.id,
          ratingBefore: awayRating,
          ratingAfter: awayNew,
          change: awayNew - awayRating,
          opponentId: homeId,
          opponentRatingBefore: homeRating,
          result: resultAway,
          kFactor: awayK,
        },
      ],
    });

    // Update in-memory state
    ratings.set(homeId, homeNew);
    ratings.set(awayId, awayNew);
    matchCounts.set(homeId, homeCount + 1);
    matchCounts.set(awayId, awayCount + 1);

    processed++;
    if (processed % 10 === 0) {
      process.stdout.write(`\r  Processed ${processed}/${matches.length}`);
    }
  }

  console.log(`\n  Processed ${processed} matches`);

  // Write final ratings to DB
  console.log("Writing final ratings to players...");
  for (const [playerId, rating] of ratings) {
    await prisma.player.update({
      where: { id: playerId },
      data: { eloRating: rating },
    });
  }

  // Print top 10
  const top10 = [...ratings.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const playerNames = await prisma.player.findMany({
    where: { id: { in: top10.map(([id]) => id) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(playerNames.map((p) => [p.id, p.name]));

  console.log("\nTop 10 ELO Rankings:");
  top10.forEach(([id, rating], i) => {
    const count = matchCounts.get(id) ?? 0;
    console.log(`  ${i + 1}. ${nameMap.get(id) ?? id} — ${rating} (${count} matches)`);
  });

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
