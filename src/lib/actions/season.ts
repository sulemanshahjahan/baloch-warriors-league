"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { logActivity } from "./activity-log";

const seasonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.string().optional(),
});

export async function createSeason(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = seasonSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;

  const season = await prisma.season.create({
    data: {
      name: d.name,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      isActive: d.isActive === "true",
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "SEASON",
    entityId: season.id,
    details: { name: d.name, isActive: d.isActive === "true" },
  });

  revalidatePath("/admin/seasons");
  return { success: true, data: { id: season.id } };
}

export async function updateSeason(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = seasonSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;

  await prisma.season.update({
    where: { id },
    data: {
      name: d.name,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      isActive: d.isActive === "true",
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "SEASON",
    entityId: id,
    details: { name: d.name, isActive: d.isActive === "true" },
  });

  revalidatePath("/admin/seasons");
  return { success: true, data: undefined };
}

export async function deleteSeason(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const tournamentCount = await prisma.tournament.count({ where: { seasonId: id } });
  if (tournamentCount > 0) {
    return {
      success: false,
      error: `Cannot delete: ${tournamentCount} tournament${tournamentCount !== 1 ? "s" : ""} belong to this season. Re-assign them first.`,
    };
  }

  await prisma.season.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "SEASON",
    entityId: id,
  });

  revalidatePath("/admin/seasons");
  return { success: true, data: undefined };
}

export async function getSeasons() {
  return prisma.season.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tournaments: true } },
    },
  });
}

export async function getSeasonById(id: string) {
  return prisma.season.findUnique({
    where: { id },
    include: {
      _count: { select: { tournaments: true } },
    },
  });
}
