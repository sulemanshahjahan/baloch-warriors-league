"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

/**
 * After schedule generation, send ONE WhatsApp message per player
 * with a summary of all their matches (opponent names + phones).
 *
 * Uses template: fixture_summary
 * Params: playerName, matchCount, matchList, fixturesUrl
 *
 * This batches ~120 messages down to ~24 (one per player).
 */
export async function sendScheduleNotifications(tournamentId: string): Promise<{
  success: boolean;
  sent: number;
  errors: string[];
}> {
  const session = await auth();
  if (!session) return { success: false, sent: 0, errors: ["Unauthorized"] };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, slug: true },
  });
  if (!tournament) return { success: false, sent: 0, errors: ["Tournament not found"] };

  // Fetch all scheduled matches with player details
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

  // Group matches by player
  const playerMatches = new Map<string, {
    name: string;
    phone: string | null;
    opponents: { name: string; phone: string; deadline: string }[];
  }>();

  for (const match of matches) {
    const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
    const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
    const homeId = match.homePlayer?.id ?? match.homeTeam?.id ?? "";
    const awayId = match.awayPlayer?.id ?? match.awayTeam?.id ?? "";
    const homePhone = match.homePlayer?.phone;
    const awayPhone = match.awayPlayer?.phone;

    const deadlineStr = match.deadline
      ? match.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : match.scheduledAt
        ? match.scheduledAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "TBC";

    // Add to home player's list
    if (homeId) {
      if (!playerMatches.has(homeId)) {
        playerMatches.set(homeId, { name: homeName, phone: homePhone ?? null, opponents: [] });
      }
      playerMatches.get(homeId)!.opponents.push({
        name: awayName,
        phone: awayPhone ? awayPhone.replace(/[+\s\-()]/g, "") : "N/A",
        deadline: deadlineStr,
      });
    }

    // Add to away player's list
    if (awayId) {
      if (!playerMatches.has(awayId)) {
        playerMatches.set(awayId, { name: awayName, phone: awayPhone ?? null, opponents: [] });
      }
      playerMatches.get(awayId)!.opponents.push({
        name: homeName,
        phone: homePhone ? homePhone.replace(/[+\s\-()]/g, "") : "N/A",
        deadline: deadlineStr,
      });
    }
  }

  let sent = 0;
  const errors: string[] = [];

  // Send one message per player
  for (const [, player] of playerMatches) {
    if (!player.phone) {
      errors.push(`${player.name}: No WhatsApp number`);
      continue;
    }

    // Build match list string: "vs Ali (923xx) - 15 Apr\nvs Ahmed (923xx) - 16 Apr"
    const matchList = player.opponents
      .map((o) => `vs ${o.name} (${o.phone}) - ${o.deadline}`)
      .join("\n");

    const fixturesUrl = `https://bwlleague.com/tournaments/${tournament.slug}`;

    const result = await sendWhatsAppTemplate({
      to: player.phone,
      templateName: "fixture_summary",
      parameters: [
        player.name,
        `${player.opponents.length}`,
        matchList,
        fixturesUrl,
      ],
    });

    if (result.ok && !result.error) sent++;
    else errors.push(`${player.name}: ${result.error || "Failed"}`);
  }

  return { success: true, sent, errors };
}
