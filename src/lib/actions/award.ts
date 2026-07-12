"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { logActivity } from "./activity-log";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  return (ROLE_LEVELS[getUserRole(session)] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

const awardSchema = z.object({
  tournamentId: z.string().min(1, "Tournament is required"),
  type: z.enum([
    "GOLDEN_BOOT",
    "TOP_ASSISTS",
    "BEST_PLAYER",
    "BEST_GOALKEEPER",
    "FAIR_PLAY",
    "TOURNAMENT_MVP",
    "TOURNAMENT_WINNER",
    "CUSTOM",
  ]),
  customName: z.string().optional(),
  playerId: z.string().optional(),
  teamId: z.string().optional(),
  description: z.string().optional(),
});

export async function createAward(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = awardSchema.safeParse({
    ...raw,
    playerId: raw.playerId || undefined,
    teamId: raw.teamId || undefined,
    customName: raw.customName || undefined,
    description: raw.description || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid data",
    };
  }

  const data = parsed.data;

  const award = await prisma.award.create({
    data: {
      tournamentId: data.tournamentId,
      type: data.type,
      customName: data.customName || null,
      playerId: data.playerId || null,
      teamId: data.teamId || null,
      description: data.description || null,
    },
  });

  // A team winning a tournament → each member is a champion too, so the winner
  // badge shows on their profile/card. Idempotent (skip members already awarded).
  if (data.type === "TOURNAMENT_WINNER" && data.teamId && !data.playerId) {
    await propagateTeamWinnerToMembers(data.tournamentId, data.teamId, data.description || null);
  }

  await logActivity({
    action: "ASSIGN_AWARD",
    entityType: "AWARD",
    entityId: award.id,
    details: {
      tournamentId: data.tournamentId,
      type: data.type,
      playerId: data.playerId,
      teamId: data.teamId,
    },
  });

  revalidatePath(`/admin/tournaments/${data.tournamentId}`);
  revalidatePath("/admin/awards");

  return { success: true, data: undefined };
}

/** Grant each active member of a winning team a personal TOURNAMENT_WINNER award. */
export async function propagateTeamWinnerToMembers(
  tournamentId: string,
  teamId: string,
  description: string | null,
): Promise<number> {
  const [team, existing] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, players: { where: { isActive: true }, select: { playerId: true } } },
    }),
    prisma.award.findMany({
      where: { tournamentId, type: "TOURNAMENT_WINNER", playerId: { not: null } },
      select: { playerId: true },
    }),
  ]);
  if (!team) return 0;
  const already = new Set(existing.map((a) => a.playerId));
  const toAdd = team.players.map((p) => p.playerId).filter((pid) => !already.has(pid));
  if (toAdd.length === 0) return 0;

  await prisma.award.createMany({
    data: toAdd.map((playerId) => ({
      tournamentId,
      type: "TOURNAMENT_WINNER" as const,
      playerId,
      teamId,
      description: description ?? `Champion — ${team.name}`,
    })),
  });

  const players = await prisma.player.findMany({ where: { id: { in: toAdd } }, select: { slug: true } });
  for (const p of players) revalidatePath(`/players/${p.slug}`);
  revalidatePath("/players");
  return toAdd.length;
}

/**
 * Auto-create the individual tournament honours from match stats:
 *   Golden Boot   = most GOAL events
 *   Top Assists   = most ASSIST events
 *   Player of the Tournament (TOURNAMENT_MVP) = most Man-of-the-Match awards
 * Idempotent: skips any honour type that already has an award for the tournament,
 * so manually-assigned awards are never overwritten. Works for 1v1 and 2v2
 * (events are attributed to individual players).
 */
export async function generateTournamentHonours(
  tournamentId: string
): Promise<ActionResult<{ created: { type: string; name: string }[]; skipped: string[] }>> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const existing = await prisma.award.findMany({ where: { tournamentId }, select: { type: true } });
  const existingTypes = new Set(existing.map((a) => a.type));

  const topEvent = async (type: "GOAL" | "ASSIST") => {
    const rows = await prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type, match: { tournamentId }, playerId: { not: null } },
      _count: { _all: true },
    });
    if (rows.length === 0) return null;
    const best = rows.reduce((a, b) => (b._count._all > a._count._all ? b : a));
    return best.playerId ? { playerId: best.playerId, value: best._count._all } : null;
  };

  const motmRows = await prisma.match.groupBy({
    by: ["motmPlayerId"],
    where: { tournamentId, motmPlayerId: { not: null } },
    _count: { _all: true },
  });
  const mvp = motmRows.length
    ? (() => {
        const best = motmRows.reduce((a, b) => (b._count._all > a._count._all ? b : a));
        return best.motmPlayerId ? { playerId: best.motmPlayerId, value: best._count._all } : null;
      })()
    : null;

  const plan = [
    { type: "GOLDEN_BOOT" as const, pick: await topEvent("GOAL"), desc: (n: number) => `Top scorer — ${n} goal${n === 1 ? "" : "s"}` },
    { type: "TOP_ASSISTS" as const, pick: await topEvent("ASSIST"), desc: (n: number) => `Most assists — ${n}` },
    { type: "TOURNAMENT_MVP" as const, pick: mvp, desc: (n: number) => `Player of the Tournament — ${n} MOTM award${n === 1 ? "" : "s"}` },
  ];

  const created: { type: string; name: string }[] = [];
  const skipped: string[] = [];
  for (const item of plan) {
    if (existingTypes.has(item.type)) { skipped.push(`${item.type} (already assigned)`); continue; }
    if (!item.pick) { skipped.push(`${item.type} (no stats)`); continue; }
    const player = await prisma.player.findUnique({ where: { id: item.pick.playerId }, select: { name: true, slug: true } });
    if (!player) { skipped.push(`${item.type} (player missing)`); continue; }
    await prisma.award.create({ data: { tournamentId, type: item.type, playerId: item.pick.playerId, description: item.desc(item.pick.value) } });
    created.push({ type: item.type, name: player.name });
    revalidatePath(`/players/${player.slug}`);
  }

  if (created.length > 0) {
    await logActivity({ action: "ASSIGN_AWARD", entityType: "TOURNAMENT", entityId: tournamentId, details: { generated: created } });
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    revalidatePath("/");
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    if (t?.slug) {
      revalidatePath(`/tournaments/${t.slug}`);
      revalidatePath(`/tournaments/${t.slug}/stats`);
      revalidatePath(`/tournaments/${t.slug}/recap`);
    }
  }

  return { success: true, data: { created, skipped } };
}

export async function deleteAward(id: string, tournamentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  await prisma.award.delete({ where: { id } });

  await logActivity({
    action: "REMOVE_AWARD",
    entityType: "AWARD",
    entityId: id,
    details: { tournamentId },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/awards");

  return { success: true, data: undefined };
}

export async function getAwards(params?: { tournamentId?: string }) {
  return prisma.award.findMany({
    where: {
      ...(params?.tournamentId && { tournamentId: params.tournamentId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      tournament: { select: { id: true, name: true } },
      player: { select: { id: true, name: true, photoUrl: true } },
      team: { select: { id: true, name: true, logoUrl: true } },
    },
  });
}

export async function getAwardStats() {
  const [totalAwards, awardsByType, recentAwards] = await Promise.all([
    prisma.award.count(),
    prisma.award.groupBy({
      by: ["type"],
      _count: { type: true },
    }),
    prisma.award.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        tournament: { select: { name: true } },
        player: { select: { name: true } },
        team: { select: { name: true } },
      },
    }),
  ]);

  return {
    totalAwards,
    awardsByType,
    recentAwards,
  };
}
