"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { getPlayerSession } from "@/lib/player-session";
import { getStoreItem } from "@/lib/cosmetics";

async function me(): Promise<{ id: string } | { error: string }> {
  const s = await getPlayerSession();
  if (!s) return { error: "Please sign in to do that." };
  return { id: s.playerId };
}

async function revalidatePlayer(playerId: string) {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { slug: true } });
  if (p?.slug) revalidatePath(`/players/${p.slug}`);
}

/** Buy a cosmetic with coins (checks requirements + ownership). */
export async function buyStoreItem(itemKey: string): Promise<ActionResult> {
  const m = await me();
  if ("error" in m) return { success: false, error: m.error };
  const item = getStoreItem(itemKey);
  if (!item) return { success: false, error: "Unknown item" };

  const [player, respect, owned] = await Promise.all([
    prisma.player.findUnique({ where: { id: m.id }, select: { coins: true, legacyLevel: true } }),
    prisma.playerRespect.findUnique({ where: { playerId: m.id }, select: { score: true } }),
    prisma.playerInventoryItem.findUnique({ where: { playerId_itemType_itemKey: { playerId: m.id, itemType: item.type, itemKey } } }),
  ]);
  if (!player) return { success: false, error: "Player not found" };
  if (owned) return { success: false, error: "You already own this item." };
  if (item.minLevel && player.legacyLevel < item.minLevel) return { success: false, error: `Requires Legacy Level ${item.minLevel}.` };
  if (item.minRespect && (respect?.score ?? 80) < item.minRespect) return { success: false, error: `Requires Respect ${item.minRespect}.` };

  // Atomic coin check + deduct
  const dec = await prisma.player.updateMany({ where: { id: m.id, coins: { gte: item.cost } }, data: { coins: { decrement: item.cost } } });
  if (dec.count === 0) return { success: false, error: "Not enough coins." };

  await prisma.playerInventoryItem.create({ data: { playerId: m.id, itemType: item.type, itemKey, source: "STORE" } });
  await prisma.legacyXpTransaction.create({ data: { playerId: m.id, xp: 0, coins: -item.cost, source: "STORE_PURCHASE", sourceId: `${itemKey}:${randomUUID().slice(0, 8)}`, reason: `Bought ${item.name}` } }).catch(() => {});

  await revalidatePlayer(m.id);
  revalidatePath("/store");
  return { success: true, data: undefined, message: `Bought ${item.name}!` };
}

/** Equip (or clear) an owned cosmetic. */
export async function equipMyCosmetic(itemKey: string | null): Promise<ActionResult> {
  const m = await me();
  if ("error" in m) return { success: false, error: m.error };

  let field: "profileFrame" | "nameColor" | "profileBanner" | "cardBg" = "profileFrame";
  if (itemKey) {
    const item = getStoreItem(itemKey);
    if (!item) return { success: false, error: "Unknown item" };
    const owned = await prisma.playerInventoryItem.findUnique({ where: { playerId_itemType_itemKey: { playerId: m.id, itemType: item.type, itemKey } } });
    if (!owned) return { success: false, error: "You don't own this item." };
    field = item.type === "NAME_COLOR" ? "nameColor" : item.type === "PROFILE_BANNER" ? "profileBanner" : item.type === "CARD_BG" ? "cardBg" : "profileFrame";
  }

  await prisma.playerEquippedCosmetics.upsert({
    where: { playerId: m.id },
    create: { playerId: m.id, [field]: itemKey },
    update: { [field]: itemKey },
  });
  await revalidatePlayer(m.id);
  return { success: true, data: undefined, message: itemKey ? "Equipped!" : "Cleared" };
}

/** Predict a match outcome (before it's completed). */
export async function submitPrediction(matchId: string, pick: "HOME" | "AWAY" | "DRAW"): Promise<ActionResult> {
  const m = await me();
  if ("error" in m) return { success: false, error: m.error };
  if (!["HOME", "AWAY", "DRAW"].includes(pick)) return { success: false, error: "Invalid pick" };

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } });
  if (!match) return { success: false, error: "Match not found" };
  if (match.status === "COMPLETED" || match.status === "CANCELLED") return { success: false, error: "Predictions are closed for this match." };

  await prisma.matchPrediction.upsert({
    where: { playerId_matchId: { playerId: m.id, matchId } },
    create: { playerId: m.id, matchId, pick },
    update: { pick, settled: false, correct: null },
  });
  revalidatePath(`/matches/${matchId}`);
  return { success: true, data: undefined, message: "Prediction saved!" };
}

/** Pin / unpin a career moment (max 3 pinned). */
export async function pinMyMoment(momentId: string, pinned: boolean): Promise<ActionResult> {
  const m = await me();
  if ("error" in m) return { success: false, error: m.error };
  const moment = await prisma.playerMoment.findUnique({ where: { id: momentId }, select: { playerId: true } });
  if (!moment || moment.playerId !== m.id) return { success: false, error: "Not your moment." };

  if (pinned) {
    const count = await prisma.playerMoment.count({ where: { playerId: m.id, isPinned: true } });
    if (count >= 3) return { success: false, error: "You can pin up to 3 moments." };
  }
  await prisma.playerMoment.update({ where: { id: momentId }, data: { isPinned: pinned } });
  await revalidatePlayer(m.id);
  return { success: true, data: undefined };
}

/** Buy raffle tickets with coins. */
export async function buyRaffleTickets(raffleId: string, count: number): Promise<ActionResult> {
  const m = await me();
  if ("error" in m) return { success: false, error: m.error };
  const n = Math.max(1, Math.floor(count));
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { isActive: true, costPerTicket: true } });
  if (!raffle || !raffle.isActive) return { success: false, error: "Raffle not available." };

  const cost = raffle.costPerTicket * n;
  const dec = await prisma.player.updateMany({ where: { id: m.id, coins: { gte: cost } }, data: { coins: { decrement: cost } } });
  if (dec.count === 0) return { success: false, error: "Not enough coins." };

  await prisma.raffleEntry.upsert({
    where: { raffleId_playerId: { raffleId, playerId: m.id } },
    create: { raffleId, playerId: m.id, tickets: n },
    update: { tickets: { increment: n } },
  });
  revalidatePath("/raffles");
  await revalidatePlayer(m.id);
  return { success: true, data: undefined, message: `Bought ${n} ticket(s)!` };
}
