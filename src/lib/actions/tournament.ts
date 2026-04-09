"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { tournamentSchema } from "@/lib/validations/tournament";
import type { ActionResult } from "@/lib/utils";
import type { TournamentStatus, GameCategory } from "@prisma/client";
import { logActivity } from "./activity-log";

const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  const userRole = getUserRole(session);
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

async function checkAdmin(): Promise<ActionResult | null> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };
  return null;
}

export async function createTournament(
  formData: FormData
): Promise<ActionResult<{ id: string; slug: string }>> {
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ id: string; slug: string }>;

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
  const denied = await checkAdmin();
  if (denied) return denied;

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

  // Get old slug before update for cache invalidation
  const oldTournament = await prisma.tournament.findUnique({
    where: { id },
    select: { slug: true, status: true },
  });

  const updated = await prisma.tournament.update({
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
  revalidatePath(`/tournaments/${updated.slug}`);
  // Invalidate old slug cache if slug changed
  if (oldTournament && oldTournament.slug !== updated.slug) {
    revalidatePath(`/tournaments/${oldTournament.slug}`);
  }
  revalidatePath("/tournaments");

  // Push notification when tournament goes ACTIVE
  if (data.status === "ACTIVE" && oldTournament?.status !== "ACTIVE") {
    import("@/lib/push").then(({ sendPushToAll }) =>
      sendPushToAll({
        title: "Tournament Started!",
        body: `${data.name} is now live`,
        url: `/tournaments/${updated.slug}`,
        tag: `tournament-active-${id}`,
      })
    ).catch(() => {});
  }

  return { success: true, data: undefined };
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  const denied = await checkAdmin();
  if (denied) return denied;

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

export async function bulkDeleteTournaments(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ count: number }>;

  // Delete in order: matches (with events/participants) → standings → awards → groups → enrollments → tournament
  for (const id of ids) {
    const matches = await prisma.match.findMany({ where: { tournamentId: id }, select: { id: true } });
    const matchIds = matches.map((m) => m.id);
    if (matchIds.length > 0) {
      await prisma.eloHistory.deleteMany({ where: { matchId: { in: matchIds } } });
      await prisma.matchEvent.deleteMany({ where: { matchId: { in: matchIds } } });
      await prisma.matchParticipant.deleteMany({ where: { matchId: { in: matchIds } } });
    }
    await prisma.match.deleteMany({ where: { tournamentId: id } });
    await prisma.standing.deleteMany({ where: { tournamentId: id } });
    await prisma.award.deleteMany({ where: { tournamentId: id } });
    await prisma.tournamentPlayer.deleteMany({ where: { tournamentId: id } });
    await prisma.tournamentTeam.deleteMany({ where: { tournamentId: id } });
    await prisma.tournamentGroup.deleteMany({ where: { tournamentId: id } });
    await prisma.tournament.delete({ where: { id } });
  }

  await logActivity({
    action: "BULK_DELETE",
    entityType: "TOURNAMENT",
    entityId: ids.join(","),
    details: { count: ids.length },
  });

  revalidatePath("/admin/tournaments");
  revalidatePath("/");
  return { success: true, data: { count: ids.length } };
}

export async function getTournaments(params?: {
  status?: string;
  gameCategory?: string;
}) {
  return prisma.tournament.findMany({
    where: {
      ...(params?.status && { status: params.status as TournamentStatus }),
      ...(params?.gameCategory && { gameCategory: params.gameCategory as GameCategory }),
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
        orderBy: [
          // Knockout matches first (higher round numbers or specific round names)
          { roundNumber: "desc" },
          { matchNumber: "asc" }
        ],
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
          homePlayer: { select: { id: true, name: true } },
          awayPlayer: { select: { id: true, name: true } },
        },
      },
      standings: {
        where: { groupId: null },
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

// ─── PAGINATED MATCHES ─────────────────────────────────────

export async function getTournamentMatchesPaginated(
  tournamentId: string,
  options?: {
    page?: number;
    limit?: number;
    status?: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
    round?: string;
  }
) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(50, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: {
    tournamentId: string;
    status?: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
    round?: string;
  } = {
    tournamentId,
    ...(options?.status && { status: options.status }),
    ...(options?.round && { round: options.round }),
  };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: [
        { roundNumber: "desc" },
        { matchNumber: "asc" },
        { scheduledAt: "asc" },
      ],
      skip,
      take: limit,
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        homePlayer: { select: { id: true, name: true, photoUrl: true } },
        awayPlayer: { select: { id: true, name: true, photoUrl: true } },
        events: {
          include: {
            player: { select: { id: true, name: true } },
          },
          orderBy: { minute: "asc" },
        },
      },
    }),
    prisma.match.count({ where }),
  ]);

  return {
    matches,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── TEAM ENROLLMENT ────────────────────────────────────────

export async function enrollTeamInTournament(
  tournamentId: string,
  teamId: string
): Promise<ActionResult> {
  const denied = await checkAdmin();
  if (denied) return denied;

  // Check maxParticipants
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { maxParticipants: true, _count: { select: { teams: true } } },
  });
  if (tournament?.maxParticipants && tournament._count.teams >= tournament.maxParticipants) {
    return { success: false, error: `Tournament is full (max ${tournament.maxParticipants} teams)` };
  }

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
  const denied = await checkAdmin();
  if (denied) return denied;

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
  const denied = await checkAdmin();
  if (denied) return denied;

  // Check maxParticipants
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { maxParticipants: true, _count: { select: { players: true } } },
  });
  if (tournament?.maxParticipants && tournament._count.players >= tournament.maxParticipants) {
    return { success: false, error: `Tournament is full (max ${tournament.maxParticipants} players)` };
  }

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
  const denied = await checkAdmin();
  if (denied) return denied;

  await prisma.tournamentPlayer.delete({ where: { id: tournamentPlayerId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: undefined };
}

export async function bulkEnrollPlayersInTournament(
  tournamentId: string,
  playerIds: string[]
): Promise<ActionResult<{ count: number }>> {
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ count: number }>;

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
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ count: number }>;

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

export async function cloneTournament(tournamentId: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const source = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      description: true,
      gameCategory: true,
      format: true,
      participantType: true,
      maxParticipants: true,
      rules: true,
      prizeInfo: true,
      seasonId: true,
    },
  });

  if (!source) return { success: false, error: "Tournament not found" };

  const newName = `${source.name} (Copy)`;
  const newSlug = slugify(newName) + "-" + Date.now().toString(36);

  const cloned = await prisma.tournament.create({
    data: {
      name: newName,
      slug: newSlug,
      description: source.description,
      gameCategory: source.gameCategory,
      format: source.format,
      participantType: source.participantType,
      maxParticipants: source.maxParticipants,
      rules: source.rules,
      prizeInfo: source.prizeInfo,
      seasonId: source.seasonId,
      status: "DRAFT",
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "TOURNAMENT",
    entityId: cloned.id,
    details: { clonedFrom: tournamentId, name: newName },
  });

  revalidatePath("/admin/tournaments");
  return { success: true, data: { id: cloned.id } };
}
