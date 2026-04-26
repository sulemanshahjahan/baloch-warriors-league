"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/push";
import { buildStatsSnapshot, computeCardRank } from "@/lib/card-rank";

interface RecomputeResult {
  success: boolean;
  changed: number;
  totalProcessed: number;
  draftNewsId?: string;
  error?: string;
}

/**
 * Recompute card ranks for every active player.
 * - Writes a RankChange row for each player whose rank changed
 * - Updates Player.cardRank
 * - Sends ONE summary push notification if any ranks changed
 * - Creates a draft NewsPost summarising the changes (admin must publish)
 */
export async function recomputeCardRanks(): Promise<RecomputeResult> {
  await requireRole("ADMIN");

  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, cardRank: true },
    orderBy: { name: "asc" },
  });

  type Change = {
    playerId: string;
    name: string;
    slug: string;
    oldRank: number;
    newRank: number;
    delta: number;
    reason: string;
  };

  const changes: Change[] = [];

  for (const p of players) {
    const stats = await buildStatsSnapshot(p.id);
    const breakdown = computeCardRank(stats);

    if (breakdown.finalRank === p.cardRank) continue;

    await prisma.$transaction([
      prisma.rankChange.create({
        data: {
          playerId: p.id,
          oldRank: p.cardRank,
          newRank: breakdown.finalRank,
          reason: breakdown.reason,
          reasonStats: {
            ...stats,
            base: breakdown.base,
            eloDelta: breakdown.eloDelta,
            winRateDelta: breakdown.winRateDelta,
            cleanSheetDelta: breakdown.cleanSheetDelta,
            goalDiffDelta: breakdown.goalDiffDelta,
            rawTotal: breakdown.rawTotal,
            provisional: breakdown.provisional,
          },
        },
      }),
      prisma.player.update({
        where: { id: p.id },
        data: { cardRank: breakdown.finalRank },
      }),
    ]);

    changes.push({
      playerId: p.id,
      name: p.name,
      slug: p.slug,
      oldRank: p.cardRank,
      newRank: breakdown.finalRank,
      delta: breakdown.finalRank - p.cardRank,
      reason: breakdown.reason,
    });
  }

  let draftNewsId: string | undefined;

  if (changes.length > 0) {
    const upgrades = changes.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta);
    const downgrades = changes.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta);

    // Summary push (broadcast — one notification, not one per player)
    const topGainer = upgrades[0];
    const headline =
      changes.length === 1
        ? `${changes[0].name}'s BWL Card ${changes[0].delta > 0 ? "upgraded" : "downgraded"} ${changes[0].oldRank} → ${changes[0].newRank}`
        : `BWL Card Ranks updated — ${upgrades.length} up, ${downgrades.length} down`;
    const body = topGainer
      ? `Biggest gain: ${topGainer.name} ${topGainer.oldRank} → ${topGainer.newRank} (+${topGainer.delta}). Tap to see all changes.`
      : `Tap to see how each player's rank changed.`;

    await notify({
      title: headline,
      body,
      url: "/news",
      tag: `card-ranks-${Date.now()}`,
    });

    // Draft news post
    const formatLine = (c: Change) =>
      `- **${c.name}** ${c.oldRank} → **${c.newRank}** (${c.delta > 0 ? "+" : ""}${c.delta}) — ${c.reason.split("\n")[0]}`;

    const sections: string[] = [];

    if (upgrades.length > 0) {
      sections.push(`## Upgrades (${upgrades.length})\n\n${upgrades.map(formatLine).join("\n")}`);
    }
    if (downgrades.length > 0) {
      sections.push(`## Downgrades (${downgrades.length})\n\n${downgrades.map(formatLine).join("\n")}`);
    }

    const content =
      `Card Ranks have been recalculated based on each player's overall performance — ELO rating, win rate, clean sheets, and goal differential.\n\n` +
      sections.join("\n\n") +
      `\n\n_How is the Card Rank calculated?_\n` +
      `Base 70, then adjusted by ELO (÷10), win rate (×16), clean sheets (÷3, capped at +5), and goal difference (÷10, capped at ±5). Final rank is capped between 50 and 99. Players with fewer than 5 matches stay provisional at the default of 70.`;

    const draftSlug = `card-ranks-update-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;

    const draft = await prisma.newsPost.create({
      data: {
        title: headline,
        slug: draftSlug,
        content,
        excerpt:
          changes.length === 1
            ? `${changes[0].name}'s card moved from ${changes[0].oldRank} to ${changes[0].newRank}.`
            : `${upgrades.length} player${upgrades.length === 1 ? "" : "s"} upgraded, ${downgrades.length} downgraded.`,
        isPublished: false,
        publishedAt: null,
      },
    });
    draftNewsId = draft.id;
  }

  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath("/admin/news");
  for (const c of changes) {
    revalidatePath(`/players/${c.slug}`);
  }

  return {
    success: true,
    changed: changes.length,
    totalProcessed: players.length,
    draftNewsId,
  };
}
