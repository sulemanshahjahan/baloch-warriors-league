"use server";

import { auth, getUserRole } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity-log";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

export async function getAppSettings() {
  const session = await auth();
  if (!session) return null;
  return getSettings();
}

export async function toggleSetting(key: string, value: boolean) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const userRole = getUserRole(session);
  if ((ROLE_LEVELS[userRole] ?? 0) < 2) {
    return { success: false, error: "Forbidden: Admin role required" };
  }

  const allowedKeys = [
    "testMode",
    "pushMatchReminders", "pushScoreSubmissions", "pushMatchResults",
    "pushTournamentUpdates", "pushRoomId", "pushAdminAlerts",
    "waMatchReminders", "waScoreSubmissions", "waMatchResults",
    "waTournamentUpdates", "waRoomId", "waAdminAlerts",
  ];

  if (!allowedKeys.includes(key)) {
    return { success: false, error: "Invalid setting key" };
  }

  await updateSettings({ [key]: value });

  await logActivity({
    action: "UPDATE",
    entityType: "SETTINGS" as never,
    entityId: "global",
    details: { key, value },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
