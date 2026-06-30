import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Respect Score — fair-play reputation (0–100). Rewards completing matches/
// tournaments on time and penalises no-shows/disputes. Status only.

export function respectLabel(score: number): string {
  if (score >= 90) return "Trusted Player";
  if (score >= 75) return "Respected";
  if (score >= 60) return "Good Standing";
  if (score >= 40) return "Warning Zone";
  return "Risky Player";
}

/** Adjust respect once per (player, source, event). Clamped to 0–100. */
export async function awardRespect(opts: {
  playerId: string;
  amount: number;
  source: string;
  sourceId?: string | null;
  reason: string;
}): Promise<void> {
  const { playerId, amount, source, sourceId = null, reason } = opts;
  try {
    await prisma.respectTransaction.create({ data: { playerId, amount, source, sourceId, reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }

  const current = await prisma.playerRespect.upsert({
    where: { playerId },
    create: { playerId, score: Math.max(0, Math.min(100, 80 + amount)), label: respectLabel(80 + amount) },
    update: { score: { increment: amount } },
    select: { score: true },
  });
  const clamped = Math.max(0, Math.min(100, current.score));
  await prisma.playerRespect.update({
    where: { playerId },
    data: { score: clamped, label: respectLabel(clamped) },
  });
}
