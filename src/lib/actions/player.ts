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

const playerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  nickname: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  position: z.string().optional(),
  nationality: z.string().optional(),
  skillLevel: z.coerce.number().min(0).max(99).optional().or(z.literal("")),
  bio: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export async function createPlayer(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = playerSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;
  const slug = slugify(data.name);
  const existing = await prisma.player.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const player = await prisma.player.create({
    data: {
      name: data.name,
      slug: finalSlug,
      nickname: data.nickname || null,
      photoUrl: data.photoUrl || null,
      position: data.position || null,
      nationality: data.nationality || null,
      skillLevel: data.skillLevel ? Number(data.skillLevel) : 50,
      bio: data.bio || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "PLAYER",
    entityId: player.id,
    details: { name: data.name, position: data.position },
  });

  revalidatePath("/admin/players");
  return { success: true, data: { id: player.id } };
}

export async function updatePlayer(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = playerSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;

  await prisma.player.update({
    where: { id },
    data: {
      name: data.name,
      nickname: data.nickname || null,
      photoUrl: data.photoUrl || null,
      position: data.position || null,
      nationality: data.nationality || null,
      skillLevel: data.skillLevel ? Number(data.skillLevel) : 50,
      bio: data.bio || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "PLAYER",
    entityId: id,
    details: { name: data.name },
  });

  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${id}`);
  return { success: true, data: undefined };
}

export async function deletePlayer(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  await prisma.player.update({
    where: { id },
    data: { isActive: false },
  });

  await logActivity({
    action: "DELETE",
    entityType: "PLAYER",
    entityId: id,
    details: { softDelete: true },
  });

  revalidatePath("/admin/players");
  return { success: true, data: undefined };
}

export async function bulkDeletePlayers(ids: string[]) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  await prisma.player.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  });

  revalidatePath("/admin/players");
  return { success: true, count: ids.length };
}

const bulkPlayerSchema = z.array(
  z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    nickname: z.string().optional(),
    position: z.string().optional(),
    nationality: z.string().optional(),
    skillLevel: z.number().min(0).max(99).optional(),
  })
);

export async function bulkCreatePlayers(players: { name: string; nickname?: string; position?: string; nationality?: string; skillLevel?: number }[]) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const parsed = bulkPlayerSchema.safeParse(players);
  if (!parsed.success) {
    return { success: false, error: "Invalid player data" };
  }

  const created = [];
  for (const data of players) {
    const slug = slugify(data.name);
    const existing = await prisma.player.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

    const player = await prisma.player.create({
      data: {
        name: data.name,
        slug: finalSlug,
        nickname: data.nickname || null,
        position: data.position || null,
        nationality: data.nationality || null,
        skillLevel: data.skillLevel ?? 50,
        isActive: true,
      },
    });
    created.push(player);
  }

  revalidatePath("/admin/players");
  return { success: true, count: created.length };
}

export async function getPlayers() {
  return prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      teams: {
        where: { isActive: true },
        include: { team: { select: { name: true } } },
        take: 1,
      },
      _count: {
        select: { matchEvents: true, awards: true },
      },
    },
  });
}

export async function getPlayersPaginated(options?: {
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

  const [players, total] = await Promise.all([
    prisma.player.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        teams: {
          where: { isActive: true },
          include: { team: { select: { name: true } } },
          take: 1,
        },
        _count: {
          select: { matchEvents: true, awards: true },
        },
      },
    }),
    prisma.player.count({ where }),
  ]);

  return { players, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      teams: {
        include: { team: { select: { id: true, name: true, logoUrl: true } } },
        orderBy: { joinedAt: "desc" },
      },
      matchEvents: {
        include: {
          match: {
            include: {
              tournament: { select: { name: true, gameCategory: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      awards: {
        include: {
          tournament: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function getPlayerStats(playerId: string) {
  const events = await prisma.matchEvent.groupBy({
    by: ["type"],
    where: { playerId },
    _count: { type: true },
  });

  const statsMap: Record<string, number> = {};
  for (const e of events) {
    statsMap[e.type] = e._count.type;
  }

  // Get all match IDs where player has events
  const eventAppearances = await prisma.matchEvent.findMany({
    where: { playerId, match: { status: "COMPLETED" } },
    select: { matchId: true },
    distinct: ["matchId"],
  });

  // Get all match IDs where player participated as home/away player (eFootball 1v1)
  const individualMatches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
    },
    select: { id: true },
  });

  // Combine and deduplicate using Set
  const allMatchIds = new Set([
    ...eventAppearances.map((e) => e.matchId),
    ...individualMatches.map((m) => m.id),
  ]);

  return {
    goals: statsMap["GOAL"] ?? 0,
    assists: statsMap["ASSIST"] ?? 0,
    yellowCards: statsMap["YELLOW_CARD"] ?? 0,
    redCards: statsMap["RED_CARD"] ?? 0,
    ownGoals: statsMap["OWN_GOAL"] ?? 0,
    motm: statsMap["MOTM"] ?? 0,
    kills: statsMap["KILL"] ?? 0,
    appearances: allMatchIds.size,
  };
}
