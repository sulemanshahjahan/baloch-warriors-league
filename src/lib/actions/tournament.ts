"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { tournamentSchema } from "@/lib/validations/tournament";
import type { ActionResult } from "@/lib/utils";
import { logActivity } from "./activity-log";

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role ?? "EDITOR";
  if (role === "EDITOR") return null;
  return { session };
}

export async function createTournament(
  formData: FormData
): Promise<ActionResult<{ id: string; slug: string }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Unauthorized: Admin role required" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = tournamentSchema.safeParse({
    ...raw,
    isFeatured: raw.isFeatured === "on" || raw.isFeatured === "true",
    maxParticipants: raw.maxParticipants || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid data",
    };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  // Check slug uniqueness
  const existing = await prisma.tournament.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const tournament = await prisma.tournament.create({
    data: {
      name: data.name,
      slug: finalSlug,
      description: data.description || null,
      gameCategory: data.gameCategory,
      format: data.format,
      participantType: data.participantType,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
      prizeInfo: data.prizeInfo || null,
      rules: data.rules || null,
      bannerUrl: data.bannerUrl || null,
      logoUrl: data.logoUrl || null,
      isFeatured: data.isFeatured ?? false,
      ...(data.seasonId ? { season: { connect: { id: data.seasonId } } } : {}),
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "TOURNAMENT",
    entityId: tournament.id,
    details: { name: data.name, gameCategory: data.gameCategory },
  });

  revalidatePath("/admin/tournaments");
  revalidatePath("/");

  return { success: true, data: { id: tournament.id, slug: tournament.slug } };
}

export async function updateTournament(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = tournamentSchema.safeParse({
    ...raw,
    isFeatured: raw.isFeatured === "on" || raw.isFeatured === "true",
    maxParticipants: raw.maxParticipants || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid data",
    };
  }

  const data = parsed.data;

  await prisma.tournament.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      gameCategory: data.gameCategory,
      format: data.format,
      participantType: data.participantType,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
      prizeInfo: data.prizeInfo || null,
      rules: data.rules || null,
      bannerUrl: data.bannerUrl || null,
      logoUrl: data.logoUrl || null,
      isFeatured: data.isFeatured ?? false,
      seasonId: data.seasonId || null,
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "TOURNAMENT",
    entityId: id,
    details: { name: data.name, status: data.status },
  });

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath("/");

  return { success: true, data: undefined };
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  await requireAdmin();

  await prisma.tournament.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "TOURNAMENT",
    entityId: id,
  });

  revalidatePath("/admin/tournaments");
  revalidatePath("/");

  return { success: true, data: undefined };
}

export async function getTournaments(params?: {
  status?: string;
  gameCategory?: string;
}) {
  return prisma.tournament.findMany({
    where: {
      ...(params?.status && { status: params.status as never }),
      ...(params?.gameCategory && { gameCategory: params.gameCategory as never }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          matches: true,
          teams: true,
          players: true,
        },
      },
    },
  });
}

export async function getTournamentById(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: {
        include: {
          team: { select: { id: true, name: true, logoUrl: true, shortName: true } },
        },
      },
      players: {
        include: {
          player: { select: { id: true, name: true, photoUrl: true, skillLevel: true } },
        },
      },
      matches: {
        orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
          homePlayer: { select: { id: true, name: true } },
          awayPlayer: { select: { id: true, name: true } },
        },
      },
      standings: {
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
        include: {
          team: { select: { id: true, name: true, logoUrl: true } },
          player: { select: { id: true, name: true, photoUrl: true } },
        },
      },
      awards: {
        include: {
          player: { select: { id: true, name: true, photoUrl: true } },
          team: { select: { id: true, name: true, logoUrl: true } },
        },
      },
      groups: {
        orderBy: { orderIndex: "asc" },
        include: {
          teams: {
            include: {
              team: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          players: {
            include: {
              player: { select: { id: true, name: true, photoUrl: true, skillLevel: true } },
            },
          },
        },
      },
    },
  });
}

// ─── TEAM ENROLLMENT ────────────────────────────────────────

export async function enrollTeamInTournament(
  tournamentId: string,
  teamId: string
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const enrollment = await prisma.tournamentTeam.create({
      data: {
        tournamentId,
        teamId,
      },
    });

    await logActivity({
      action: "ENROLL",
      entityType: "TOURNAMENT",
      entityId: tournamentId,
      details: { teamId, enrollmentId: enrollment.id },
    });

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: "Team is already enrolled in this tournament" };
  }
}

export async function removeTeamFromTournament(
  tournamentId: string,
  tournamentTeamId: string
): Promise<ActionResult> {
  await requireAdmin();

  await prisma.tournamentTeam.delete({
    where: { id: tournamentTeamId },
  });

  await logActivity({
    action: "UNENROLL",
    entityType: "TOURNAMENT",
    entityId: tournamentId,
    details: { teamEnrollmentId: tournamentTeamId },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: undefined };
}

// ─── PLAYER ENROLLMENT ──────────────────────────────────────

export async function enrollPlayerInTournament(
  tournamentId: string,
  playerId: string
): Promise<ActionResult> {
  await requireAdmin();

  try {
    await prisma.tournamentPlayer.create({
      data: { tournamentId, playerId },
    });
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Player is already enrolled in this tournament" };
  }
}

export async function removePlayerFromTournament(
  tournamentId: string,
  tournamentPlayerId: string
): Promise<ActionResult> {
  await requireAdmin();

  await prisma.tournamentPlayer.delete({ where: { id: tournamentPlayerId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: undefined };
}

export async function bulkEnrollPlayersInTournament(
  tournamentId: string,
  playerIds: string[]
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const result = await prisma.tournamentPlayer.createMany({
    data: playerIds.map((playerId) => ({ tournamentId, playerId })),
    skipDuplicates: true,
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: { count: result.count } };
}

export async function bulkRemovePlayersFromTournament(
  tournamentId: string,
  tournamentPlayerIds: string[]
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  await prisma.tournamentPlayer.deleteMany({
    where: {
      id: { in: tournamentPlayerIds },
      tournamentId,
    },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: { count: tournamentPlayerIds.length } };
}

export async function getAvailablePlayers(tournamentId: string) {
  const enrolled = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const enrolledIds = enrolled.map((e) => e.playerId);

  return prisma.player.findMany({
    where: {
      isActive: true,
      ...(enrolledIds.length > 0 && { id: { notIn: enrolledIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, photoUrl: true },
  });
}

export async function getAvailableTeams(tournamentId: string) {
  const enrolledTeamIds = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: { teamId: true },
  });

  const enrolledIds = enrolledTeamIds.map((t) => t.teamId);

  return prisma.team.findMany({
    where: {
      isActive: true,
      ...(enrolledIds.length > 0 && { id: { notIn: enrolledIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, logoUrl: true },
  });
}
