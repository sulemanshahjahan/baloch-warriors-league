import { prisma } from "@/lib/db";
import type { AppSettings } from "@prisma/client";

const SETTINGS_ID = "global";

/**
 * Get global app settings. Creates the default row if it doesn't exist.
 */
export async function getSettings(): Promise<AppSettings> {
  let settings = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: SETTINGS_ID },
    });
  }

  return settings;
}

/**
 * Update specific settings fields.
 */
export async function updateSettings(
  data: Partial<Omit<AppSettings, "id" | "updatedAt">>,
): Promise<AppSettings> {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}

/**
 * Check if a specific notification type is enabled.
 * Returns false if testMode is on OR the specific toggle is off.
 */
export async function isNotificationEnabled(
  channel: "push" | "wa",
  type: "matchReminders" | "scoreSubmissions" | "matchResults" | "tournamentUpdates" | "roomId" | "adminAlerts",
): Promise<boolean> {
  const settings = await getSettings();

  if (settings.testMode) return false;

  const key = channel === "push"
    ? `push${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof AppSettings
    : `wa${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof AppSettings;

  return settings[key] as boolean;
}
