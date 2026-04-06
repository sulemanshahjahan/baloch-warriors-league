"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";

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

  revalidatePath("/admin/teams");
  return { success: true, data: { id: team.id } };
}

export async function updateTeam(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

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

  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
  return { success: true, data: undefined };
}

export async function deleteTeam(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  await prisma.team.delete({ where: { id } });
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

  await prisma.teamPlayer.create({
    data: { teamId, playerId, jerseyNumber: jerseyNumber ?? null },
  });

  revalidatePath(`/admin/teams/${teamId}`);
  return { success: true, data: undefined };
}

export async function removePlayerFromTeam(teamPlayerId: string, teamId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  await prisma.teamPlayer.update({
    where: { id: teamPlayerId },
    data: { leftAt: new Date(), isActive: false },
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

export async function getTeamById(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      players: {
        where: { isActive: true },
        include: {
          player: { select: { id: true, name: true, position: true, photoUrl: true } },
        },
      },
      captain: { select: { id: true, name: true } },
      tournaments: {
        include: { tournament: { select: { id: true, name: true, status: true, gameCategory: true } } },
      },
    },
  });
}
