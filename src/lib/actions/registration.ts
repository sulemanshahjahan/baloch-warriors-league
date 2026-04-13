"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, getUserRole } from "@/lib/auth";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  nickname: z.string().optional(),
  phone: z.string().min(8, "Phone number is required"),
  position: z.string().optional(),
  nationality: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ─── PUBLIC: Submit Registration ─────────────────────────────

export async function submitRegistration(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registrationSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;
  const slug = slugify(data.name);
  const existing = await prisma.player.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  // Check for duplicate phone
  const existingPhone = await prisma.player.findFirst({
    where: { phone: data.phone },
  });
  if (existingPhone) {
    return { success: false, error: "A player with this phone number already exists" };
  }

  await prisma.player.create({
    data: {
      name: data.name,
      slug: finalSlug,
      nickname: data.nickname || null,
      phone: data.phone || null,
      position: data.position || null,
      nationality: data.nationality || null,
      registrationStatus: "PENDING",
      isActive: false, // Not active until approved
    },
  });

  // Notify admins
  import("@/lib/push").then(({ sendPushToAll }) =>
    sendPushToAll({
      title: "New Player Registration",
      body: `${data.name} has requested to join BWL`,
      url: "/admin/registrations",
      tag: `registration-${finalSlug}`,
    })
  ).catch(() => {});

  return { success: true };
}

// ─── ADMIN: Get Pending Registrations ────────────────────────

export async function getPendingRegistrations() {
  return prisma.player.findMany({
    where: { registrationStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      phone: true,
      position: true,
      nationality: true,
      createdAt: true,
    },
  });
}

// ─── ADMIN: Approve Registration ─────────────────────────────

export async function approveRegistration(playerId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
  const userRole = getUserRole(session);
  if ((ROLE_LEVELS[userRole] ?? 0) < 2) {
    return { success: false, error: "Forbidden: Admin role required" };
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: { registrationStatus: "APPROVED", isActive: true },
  });

  // Notify player via WhatsApp
  if (player.phone) {
    const { sendWhatsAppText } = await import("@/lib/whatsapp");
    await sendWhatsAppText(
      player.phone,
      `Welcome to BWL, ${player.name}! Your registration has been approved. Check your profile: https://bwlleague.com/players/${player.slug}`,
    );
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/players");
  return { success: true };
}

// ─── ADMIN: Reject Registration ──────────────────────────────

export async function rejectRegistration(playerId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
  const userRole = getUserRole(session);
  if ((ROLE_LEVELS[userRole] ?? 0) < 2) {
    return { success: false, error: "Forbidden: Admin role required" };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { registrationStatus: "REJECTED" },
  });

  revalidatePath("/admin/registrations");
  return { success: true };
}
