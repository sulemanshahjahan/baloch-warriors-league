"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWithLog } from "@/lib/whatsapp-log";

function requireAdmin(session: { user?: { role?: string } } | null) {
  const role = getUserRole(session);
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Force-resend a previously logged message by clearing its dedup row and
 * re-firing with the same parameters. Useful when a delivery appeared to
 * fail on the recipient side even though WhatsApp marked it delivered.
 */
export async function forceResendMessage(logId: string) {
  const session = await auth();
  if (!requireAdmin(session)) return { success: false, error: "Unauthorized" };

  const log = await prisma.whatsAppLog.findUnique({ where: { id: logId } });
  if (!log) return { success: false, error: "Log not found" };

  const params = Array.isArray(log.parameters) ? (log.parameters as string[]) : [];

  const result = await sendWithLog({
    to: log.phone,
    templateName: log.templateName,
    parameters: params,
    dedupKey: log.dedupKey,
    category: log.category as "REMINDER" | "SCHEDULE" | "FIXTURE" | "OPPONENT_READY" | "OTHER",
    matchId: log.matchId,
    playerId: log.playerId,
    tournamentId: log.tournamentId,
    force: true,
  });

  revalidatePath("/admin/messages");

  return { success: result.ok, error: result.error };
}

/** Delete a log entry (allows the auto sender to re-fire naturally). */
export async function deleteMessageLog(logId: string) {
  const session = await auth();
  if (!requireAdmin(session)) return { success: false, error: "Unauthorized" };
  await prisma.whatsAppLog.delete({ where: { id: logId } });
  revalidatePath("/admin/messages");
  return { success: true };
}
