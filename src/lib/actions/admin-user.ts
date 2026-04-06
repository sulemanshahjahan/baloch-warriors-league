"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { logActivity } from "./activity-log";

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]),
});

const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]),
});

async function requireSuperAdmin() {
  const session = await auth();
  if (!session) return null;
  const user = await prisma.adminUser.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function createAdminUser(formData: FormData) {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Unauthorized: Super Admin only" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { success: false, error: "An account with this email already exists" };

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.create({
    data: { name, email, password: hashedPassword, role },
  });

  await logActivity({
    action: "CREATE",
    entityType: "ADMIN_USER",
    entityId: user.id,
    details: { name, role },
  });

  revalidatePath("/admin/users");
  return { success: true, data: { id: user.id } };
}

export async function updateAdminUser(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Unauthorized: Super Admin only" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateUserSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  await prisma.adminUser.update({
    where: { id },
    data: { name: parsed.data.name, role: parsed.data.role },
  });

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}

export async function toggleAdminUserActive(id: string) {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Unauthorized: Super Admin only" };

  const currentSession = await auth();
  if ((currentSession?.user as { id: string })?.id === id) {
    return { success: false, error: "You cannot deactivate your own account" };
  }

  const user = await prisma.adminUser.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) return { success: false, error: "User not found" };

  await prisma.adminUser.update({
    where: { id },
    data: { isActive: !user.isActive },
  });

  await logActivity({
    action: user.isActive ? "DEACTIVATE" : "ACTIVATE",
    entityType: "ADMIN_USER",
    entityId: id,
  });

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}

export async function resetAdminUserPassword(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Unauthorized: Super Admin only" };

  const password = formData.get("password") as string;
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.adminUser.update({ where: { id }, data: { password: hashedPassword } });

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}

export async function getAdminUsers() {
  const session = await auth();
  if (!session) return [];
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}
