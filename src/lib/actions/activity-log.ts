"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type ActivityLogAction = 
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "PUBLISH"
  | "UNPUBLISH"
  | "ENROLL"
  | "UNENROLL"
  | "SCHEDULE"
  | "RESCHEDULE"
  | "COMPLETE"
  | "START"
  | "CANCEL"
  | "POSTPONE"
  | "ASSIGN_AWARD"
  | "REMOVE_AWARD"
  | "ADD_EVENT"
  | "REMOVE_EVENT"
  | "ACTIVATE"
  | "DEACTIVATE";

export type EntityType =
  | "TOURNAMENT"
  | "MATCH"
  | "TEAM"
  | "PLAYER"
  | "NEWS"
  | "VENUE"
  | "SEASON"
  | "ADMIN_USER"
  | "AWARD"
  | "STANDING"
  | "GROUP";

interface LogActivityParams {
  action: ActivityLogAction;
  entityType?: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  action,
  entityType,
  entityId,
  details,
}: LogActivityParams) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.activityLog.create({
    data: {
      adminId: session.user.id,
      action,
      entityType,
      entityId,
      details: details ?? {},
    },
  });
}

export async function getActivityLogs(options?: {
  limit?: number;
  offset?: number;
  entityType?: EntityType;
  entityId?: string;
  adminId?: string;
}) {
  const { limit = 50, offset = 0, entityType, entityId, adminId } = options ?? {};

  const where = {
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(adminId && { adminId }),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        admin: {
          select: { name: true, email: true, role: true },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getRecentActivity(limit = 10) {
  return prisma.activityLog.findMany({
    where: {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      admin: {
        select: { name: true, role: true },
      },
    },
  });
}

export async function getEntityActivityHistory(
  entityType: EntityType,
  entityId: string
) {
  return prisma.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: {
      admin: {
        select: { name: true, role: true },
      },
    },
  });
}

export async function clearOldActivityLogs(daysToKeep = 90) {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;
  
  if (userRole !== "SUPER_ADMIN") {
    return { success: false, error: "Only Super Admins can clear old logs" };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { count } = await prisma.activityLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  await logActivity({
    action: "DELETE",
    entityType: "ADMIN_USER",
    details: { clearedLogs: count, daysToKeep },
  });

  revalidatePath("/admin/activity");
  return { success: true, count };
}




