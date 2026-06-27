"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendWithLog } from "@/lib/whatsapp-log";
import { resolveSideRecipients, teamMembersSelect } from "@/lib/match-recipients";

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
  skipped?: number;
  errors: string[];
}> {
  const session = await auth();
  if (!session) return { success: false, sent: 0, errors: ["Unauthorized"] };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, slug: true },
  });
  if (!tournament) return { success: false, sent: 0, errors: ["Tournament not found"] };

  // Fetch all playable (not yet completed/cancelled) matches with player + duo details
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { in: ["SCHEDULED", "POSTPONED"] } },
    orderBy: [{ scheduledAt: "asc" }, { roundNumber: "asc" }, { matchNumber: "asc" }],
    include: {
      homePlayer: { select: { id: true, name: true, phone: true } },
      awayPlayer: { select: { id: true, name: true, phone: true } },
      homeTeam: { select: { name: true, ...teamMembersSelect } },
      awayTeam: { select: { name: true, ...teamMembersSelect } },
    },
  });

  // Group fixtures by recipient (each duo member gets their own summary).
  const recipients = new Map<string, {
    name: string;
    phone: string;
    opponents: { name: string; contact: string; deadline: string }[];
  }>();

  const cleanPhones = (rs: { phone: string }[]) =>
    rs.map((r) => r.phone.replace(/[+\s\-()]/g, "")).join("/") || "N/A";

  for (const match of matches) {
    const homeLabel = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
    const awayLabel = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
    const homeRec = resolveSideRecipients({ player: match.homePlayer, team: match.homeTeam });
    const awayRec = resolveSideRecipients({ player: match.awayPlayer, team: match.awayTeam });
    const homeContact = cleanPhones(homeRec);
    const awayContact = cleanPhones(awayRec);

    const deadlineStr = match.deadline
      ? match.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" })
      : match.scheduledAt
        ? match.scheduledAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" })
        : "TBC";

    for (const r of homeRec) {
      if (!recipients.has(r.playerId)) recipients.set(r.playerId, { name: r.name, phone: r.phone, opponents: [] });
      recipients.get(r.playerId)!.opponents.push({ name: awayLabel, contact: awayContact, deadline: deadlineStr });
    }
    for (const r of awayRec) {
      if (!recipients.has(r.playerId)) recipients.set(r.playerId, { name: r.name, phone: r.phone, opponents: [] });
      recipients.get(r.playerId)!.opponents.push({ name: homeLabel, contact: homeContact, deadline: deadlineStr });
    }
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const fixturesUrl = `https://bwlleague.com/tournaments/${tournament.slug}`;

  // Send one message per recipient
  for (const [playerId, r] of recipients) {
    // Build match list string with pipe separator (WhatsApp doesn't render \n in params)
    const matchList = r.opponents
      .map((o) => `vs ${o.name} +${o.contact} [${o.deadline}]`)
      .join(" | ");

    const result = await sendWithLog({
      to: r.phone,
      templateName: "fixture_summary",
      languageCode: "en",
      parameters: [r.name, `${r.opponents.length}`, matchList, fixturesUrl],
      dedupKey: `fixture:${tournamentId}:${playerId}`,
      category: "FIXTURE",
      tournamentId,
      playerId,
    });

    if (result.skipped) skipped++;
    else if (result.ok) sent++;
    else errors.push(`${r.name}: ${result.error || "Failed"}`);
  }

  return { success: true, sent, skipped, errors };
}
