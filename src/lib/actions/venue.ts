"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

const venueSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
});

export async function createVenue(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = venueSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const venue = await prisma.venue.create({
    data: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "VENUE",
    entityId: venue.id,
    details: { name: parsed.data.name },
  });

  revalidatePath("/admin/venues");
  return { success: true, data: { id: venue.id } };
}

export async function updateVenue(id: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = venueSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  await prisma.venue.update({
    where: { id },
    data: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "VENUE",
    entityId: id,
    details: { name: parsed.data.name },
  });

  revalidatePath("/admin/venues");
  return { success: true, data: undefined };
}

export async function deleteVenue(id: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  // Check if venue is used by matches
  const matchCount = await prisma.match.count({ where: { venueId: id } });
  if (matchCount > 0) {
    return {
      success: false,
      error: `Cannot delete: this venue is used by ${matchCount} match${matchCount !== 1 ? "es" : ""}. Remove it from matches first.`,
    };
  }

  await prisma.venue.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "VENUE",
    entityId: id,
  });

  revalidatePath("/admin/venues");
  return { success: true, data: undefined };
}

export async function getVenues() {
  return prisma.venue.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { matches: true } },
    },
  });
}

export async function getVenueById(id: string) {
  return prisma.venue.findUnique({
    where: { id },
    include: {
      _count: { select: { matches: true } },
    },
  });
}
