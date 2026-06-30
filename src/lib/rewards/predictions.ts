import { prisma } from "@/lib/db";

// Settle match predictions when a match completes and reward correct ones.
// (Self-serve prediction entry requires player login — model + settlement are
// ready so it lights up the moment player accounts exist.)

export async function settlePredictionsForMatch(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      homeScore: true, awayScore: true,
      leg2HomeScore: true, leg2AwayScore: true,
      leg3HomeScore: true, leg3AwayScore: true,
    },
  });
  if (!match || match.status !== "COMPLETED") return;

  const home = (match.homeScore ?? 0) + (match.leg2HomeScore ?? 0) + (match.leg3HomeScore ?? 0);
  const away = (match.awayScore ?? 0) + (match.leg2AwayScore ?? 0) + (match.leg3AwayScore ?? 0);
  const result = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";

  const predictions = await prisma.matchPrediction.findMany({ where: { matchId, settled: false } });
  if (predictions.length === 0) return;

  const { awardReward } = await import("./reward-engine");
  for (const p of predictions) {
    const correct = p.pick === result;
    await prisma.matchPrediction.update({
      where: { id: p.id },
      data: { settled: true, correct, settledAt: new Date() },
    });
    if (correct) {
      await awardReward({
        playerId: p.playerId,
        xp: 20,
        coins: 25,
        source: "PREDICTION",
        sourceId: p.id,
        reason: "Correct prediction",
      });
    }
  }
}
