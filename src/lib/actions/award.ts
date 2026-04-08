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
