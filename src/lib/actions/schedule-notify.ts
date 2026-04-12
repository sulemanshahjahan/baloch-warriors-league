"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendScheduleMessage } from "@/lib/whatsapp";

/**
 * After schedule generation, send each player a WhatsApp message
 * for every match they have, including opponent name + phone number.
 */
export async function sendScheduleNotifications(tournamentId: string): Promise<{
  success: boolean;
  sent: number;
  errors: string[];
}> {
  const session = await auth();
  if (!session) return { success: false, sent: 0, errors: ["Unauthorized"] };

  // Fetch all scheduled matches with player/team details
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: "SCHEDULED" },
    orderBy: [{ scheduledAt: "asc" }, { roundNumber: "asc" }, { matchNumber: "asc" }],
    include: {
      homePlayer: { select: { id: true, name: true, phone: true } },
      awayPlayer: { select: { id: true, name: true, phone: true } },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const match of matches) {
    const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
    const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
    const homePhone = match.homePlayer?.phone;
    const awayPhone = match.awayPlayer?.phone;

    const deadlineStr = match.deadline
      ? match.deadline.toLocaleDateString("en-GB", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        })
      : match.scheduledAt
        ? match.scheduledAt.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })
        : "To be confirmed";

    // Send to home player
    if (homePhone) {
      const result = await sendScheduleMessage(
        homePhone,
        homeName,
        awayName,
        awayPhone ?? "N/A",
        deadlineStr,
      );
      if (result.ok && !result.error) sent++;
      else errors.push(`${homeName}: ${result.error || "Failed"}`);
    }

    // Send to away player
    if (awayPhone) {
      const result = await sendScheduleMessage(
        awayPhone,
        awayName,
        homeName,
        homePhone ?? "N/A",
        deadlineStr,
      );
      if (result.ok && !result.error) sent++;
      else errors.push(`${awayName}: ${result.error || "Failed"}`);
    }
  }

  return { success: true, sent, errors };
}
