"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const playerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  nickname: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  position: z.string().optional(),
  nationality: z.string().optional(),
  bio: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export async function createPlayer(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

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
      bio: data.bio || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    },
  });

  revalidatePath("/admin/players");
  return { success: true, data: { id: player.id } };
}

export async function updatePlayer(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

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
      bio: data.bio || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    },
  });

  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${id}`);
  return { success: true, data: undefined };
}

export async function deletePlayer(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  await prisma.player.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/admin/players");
  return { success: true, data: undefined };
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

  // Count appearances from match events
  const eventAppearances = await prisma.matchEvent.findMany({
    where: { playerId, match: { status: "COMPLETED" } },
    select: { matchId: true },
    distinct: ["matchId"],
  });

  // Count appearances from individual player matches (eFootball 1v1)
  const individualMatches = await prisma.match.count({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
      ],
    },
  });

  // Combine and deduplicate match IDs
  const appearanceMatchIds = new Set(eventAppearances.map((e) => e.matchId));
  
  return {
    goals: statsMap["GOAL"] ?? 0,
    assists: statsMap["ASSIST"] ?? 0,
    yellowCards: statsMap["YELLOW_CARD"] ?? 0,
    redCards: statsMap["RED_CARD"] ?? 0,
    ownGoals: statsMap["OWN_GOAL"] ?? 0,
    motm: statsMap["MOTM"] ?? 0,
    kills: statsMap["KILL"] ?? 0,
    appearances: appearanceMatchIds.size + individualMatches,
  };
}
