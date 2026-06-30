"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { awardReward } from "@/lib/rewards/reward-engine";
import { awardRespect } from "@/lib/rewards/respect";
import { getStoreItem } from "@/lib/cosmetics";

const LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

async function admin(): Promise<{ id: string } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  if ((LEVELS[getUserRole(session)] ?? 0) < 2) return { error: "Forbidden: Admin role required" };
  return { id: (session.user as { id?: string })?.id ?? "unknown" };
}

async function audit(adminId: string, targetPlayerId: string, action: string, reason: string, before?: unknown, after?: unknown) {
  await prisma.adminRewardAuditLog.create({
    data: {
      adminId, targetPlayerId, action, reason,
      beforeJson: (before as object) ?? undefined,
      afterJson: (after as object) ?? undefined,
    },
  });
}

/** Manually adjust a player's XP / coins / respect (always applies; audited). */
export async function adjustPlayerLegacy(
  playerId: string,
  opts: { xp?: number; coins?: number; respect?: number; reason: string },
): Promise<ActionResult> {
  const a = await admin();
  if ("error" in a) return { success: false, error: a.error };
  if (!opts.reason?.trim()) return { success: false, error: "A reason is required" };

  const before = await prisma.player.findUnique({ where: { id: playerId }, select: { legacyXp: true, coins: true } });
  if (!before) return { success: false, error: "Player not found" };

  const key = randomUUID(); // unique → always applies (not idempotent on purpose)
  if (opts.xp || opts.coins) {
    await awardReward({ playerId, xp: opts.xp ?? 0, coins: opts.coins ?? 0, source: "ADMIN_ADJUST", sourceId: key, reason: `Admin: ${opts.reason}` });
  }
  if (opts.respect) {
    await awardRespect({ playerId, amount: opts.respect, source: "ADMIN_ADJUST", sourceId: key, reason: `Admin: ${opts.reason}` });
  }

  const after = await prisma.player.findUnique({ where: { id: playerId }, select: { legacyXp: true, coins: true } });
  await audit(a.id, playerId, "ADJUST_LEGACY", opts.reason, before, after);
  revalidatePath("/admin/legacy");
  return { success: true, data: undefined };
}

/** Grant a cosmetic to a player (adds to inventory). */
export async function grantCosmetic(playerId: string, itemKey: string): Promise<ActionResult> {
  const a = await admin();
  if ("error" in a) return { success: false, error: a.error };
  const item = getStoreItem(itemKey);
  if (!item) return { success: false, error: "Unknown item" };

  await prisma.playerInventoryItem.upsert({
    where: { playerId_itemType_itemKey: { playerId, itemType: item.type, itemKey } },
    create: { playerId, itemType: item.type, itemKey, source: "ADMIN" },
    update: {},
  });
  await audit(a.id, playerId, "GRANT_COSMETIC", itemKey);
  revalidatePath("/admin/legacy");
  return { success: true, data: undefined };
}

/** Equip a cosmetic the player owns (or grant-and-equip for admins). */
export async function equipCosmetic(playerId: string, itemKey: string | null): Promise<ActionResult> {
  const a = await admin();
  if ("error" in a) return { success: false, error: a.error };

  let field: "profileFrame" | "nameColor" | "profileBanner" | "cardBg" = "profileFrame";
  if (itemKey) {
    const item = getStoreItem(itemKey);
    if (!item) return { success: false, error: "Unknown item" };
    field = item.type === "NAME_COLOR" ? "nameColor" : item.type === "PROFILE_BANNER" ? "profileBanner" : item.type === "CARD_BG" ? "cardBg" : "profileFrame";
    // ensure owned
    await prisma.playerInventoryItem.upsert({
      where: { playerId_itemType_itemKey: { playerId, itemType: item.type, itemKey } },
      create: { playerId, itemType: item.type, itemKey, source: "ADMIN" },
      update: {},
    });
  }

  await prisma.playerEquippedCosmetics.upsert({
    where: { playerId },
    create: { playerId, [field]: itemKey },
    update: { [field]: itemKey },
  });

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { slug: true } });
  await audit(a.id, playerId, "EQUIP_COSMETIC", itemKey ?? "(none)");
  revalidatePath("/admin/legacy");
  if (player?.slug) revalidatePath(`/players/${player.slug}`);
  return { success: true, data: undefined };
}

// ── Season management ─────────────────────────────────────────

export async function createSeason(name: string, startDate?: string, endDate?: string): Promise<ActionResult> {
  const a = await admin();
  if ("error" in a) return { success: false, error: a.error };
  if (!name.trim()) return { success: false, error: "Name required" };
  await prisma.season.create({
    data: {
      name: name.trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: false,
    },
  });
  revalidatePath("/admin/legacy");
  return { success: true, data: undefined };
}

/** Activate one season (deactivates the rest) or deactivate all. */
export async function setActiveSeason(seasonId: string | null): Promise<ActionResult> {
  const a = await admin();
  if ("error" in a) return { success: false, error: a.error };
  await prisma.season.updateMany({ data: { isActive: false } });
  if (seasonId) await prisma.season.update({ where: { id: seasonId }, data: { isActive: true } });
  revalidatePath("/admin/legacy");
  revalidatePath("/legacy");
  return { success: true, data: undefined };
}
