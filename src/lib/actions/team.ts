"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { logActivity } from "./activity-log";

// Role hierarchy levels
const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  const userRole = getUserRole(session);
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

const teamSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  shortName: z.string().max(10).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().optional(),
  captainId: z.string().optional(),
});

export async function createTeam(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = teamSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;
  const slug = slugify(data.name);
  const existing = await prisma.team.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const team = await prisma.team.create({
    data: {
      name: data.name,
      slug: finalSlug,
      shortName: data.shortName || null,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor || null,
      captainId: data.captainId || null,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "TEAM",
    entityId: team.id,
    details: { name: data.name },
  });

  revalidatePath("/admin/teams");
  return { success: true, data: { id: team.id } };
}

export async function updateTeam(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = teamSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;

  await prisma.team.update({
    where: { id },
    data: {
      name: data.name,
      shortName: data.shortName || null,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor || null,
      captainId: data.captainId || null,
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "TEAM",
    entityId: id,
    details: { name: data.name },
  });

  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
  return { success: true, data: undefined };
}

export async function deleteTeam(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  await prisma.team.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "TEAM",
    entityId: id,
  });

  revalidatePath("/admin/teams");
  return { success: true, data: undefined };
}

export async function addPlayerToTeam(
  teamId: string,
  playerId: string,
  jerseyNumber?: number
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const teamPlayer = await prisma.teamPlayer.create({
    data: { teamId, playerId, jerseyNumber: jerseyNumber ?? null },
  });

  await logActivity({
    action: "ENROLL",
    entityType: "TEAM",
    entityId: teamId,
    details: { playerId, jerseyNumber, teamPlayerId: teamPlayer.id },
  });

  revalidatePath(`/admin/teams/${teamId}`);
  return { success: true, data: undefined };
}

export async function removePlayerFromTeam(teamPlayerId: string, teamId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  await prisma.teamPlayer.update({
    where: { id: teamPlayerId },
    data: { leftAt: new Date(), isActive: false },
  });

  await logActivity({
    action: "UNENROLL",
    entityType: "TEAM",
    entityId: teamId,
    details: { teamPlayerId },
  });

  revalidatePath(`/admin/teams/${teamId}`);
  return { success: true, data: undefined };
}

export async function reactivatePlayerOnTeam(teamPlayerId: string, teamId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

  await prisma.teamPlayer.update({
    where: { id: teamPlayerId },
    data: { leftAt: null, isActive: true },
  });

  await logActivity({
    action: "ENROLL",
    entityType: "TEAM",
    entityId: teamId,
    details: { teamPlayerId, action: "REACTIVATE" },
  });

  revalidatePath(`/admin/teams/${teamId}`);
  return { success: true, data: undefined };
}

export async function getTeams() {
  return prisma.team.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { players: true, tournaments: true } },
      captain: { select: { name: true } },
    },
  });
}

export async function getTeamsPaginated(options?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25));
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(options?.search && {
      name: { contains: options.search, mode: "insensitive" as const },
    }),
  };

  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        _count: { select: { players: true, tournaments: true } },
        captain: { select: { name: true } },
      },
    }),
    prisma.team.count({ where }),
  ]);

  return { teams, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTeamById(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          player: { select: { id: true, name: true, position: true, photoUrl: true } },
        },
        orderBy: [{ isActive: "desc" }, { joinedAt: "desc" }],
      },
      captain: { select: { id: true, name: true } },
      tournaments: {
        include: { tournament: { select: { id: true, name: true, status: true, gameCategory: true } } },
      },
    },
  });
}
