import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/push";
import { sendMatchLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const TIERS = [
  { key: "24h", threshold: 24 * 60 * 60 * 1000, label: "24 hours" },
  { key: "2h", threshold: 2 * 60 * 60 * 1000, label: "2 hours" },
  { key: "30m", threshold: 30 * 60 * 1000, label: "30 minutes" },
] as const;

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Fetch matches with deadlines approaching (within 24h) or already past
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "POSTPONED"] },
      deadline: { not: null, lte: in24h },
    },
    include: {
      tournament: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      homePlayer: { select: { name: true, phone: true } },
      awayPlayer: { select: { name: true, phone: true } },
    },
  });

  let remindersSentCount = 0;
  let overdueCount = 0;
  let whatsappSentCount = 0;

  for (const match of matches) {
    const deadline = match.deadline!;
    const msUntilDeadline = deadline.getTime() - now.getTime();
    const sent: string[] = Array.isArray(match.remindersSent)
      ? (match.remindersSent as string[])
      : [];

    const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
    const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
    const matchLabel = `${homeName} vs ${awayName}`;

    const newReminders: string[] = [];

    for (const tier of TIERS) {
      if (msUntilDeadline <= tier.threshold && !sent.includes(tier.key)) {
        const isUrgent = tier.key === "30m";
        await notify({
          title: isUrgent
            ? `URGENT: Match Deadline in ${tier.label}!`
            : `Match Deadline: ${tier.label} remaining`,
          body: `${matchLabel} — ${match.tournament.name}`,
          url: `/matches/${match.id}`,
          tag: `deadline-${tier.key}-${match.id}`,
        });
        newReminders.push(tier.key);
        remindersSentCount++;
      }
    }

    // Auto-send magic links via WhatsApp (once, when 24h reminder fires)
    if (newReminders.includes("24h") && !sent.includes("wa")) {
      const deadlineStr = match.deadline!.toLocaleDateString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
      const baseUrl = "https://bwlleague.com";

      // Send to home player
      if (match.homePlayer?.phone && match.homeToken) {
        const result = await sendMatchLink(
          match.homePlayer.phone,
          homeName,
          awayName,
          deadlineStr,
          `${baseUrl}/report/${match.homeToken}`,
        );
        if (result.ok) whatsappSentCount++;
      }

      // Send to away player
      if (match.awayPlayer?.phone && match.awayToken) {
        const result = await sendMatchLink(
          match.awayPlayer.phone,
          awayName,
          homeName,
          deadlineStr,
          `${baseUrl}/report/${match.awayToken}`,
        );
        if (result.ok) whatsappSentCount++;
      }

      newReminders.push("wa");
    }

    // Check if match is now overdue
    const isNowOverdue = msUntilDeadline <= 0 && !match.isOverdue;
    if (isNowOverdue) {
      await notify({
        title: "Match OVERDUE",
        body: `${matchLabel} (${match.tournament.name}) has passed its deadline!`,
        url: `/matches/${match.id}`,
        tag: `overdue-${match.id}`,
      });
      overdueCount++;
    }

    // Update match if anything changed
    if (newReminders.length > 0 || isNowOverdue) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          remindersSent: [...sent, ...newReminders],
          ...(isNowOverdue ? { isOverdue: true } : {}),
        },
      });
    }
  }

  // ── Phase 2: Auto-forfeit overdue matches ──
  let forfeitCount = 0;

  const overdueMatches = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "POSTPONED"] },
      isOverdue: true,
    },
    include: {
      tournament: { select: { name: true, participantType: true } },
      homePlayer: { select: { id: true, name: true, phone: true } },
      awayPlayer: { select: { id: true, name: true, phone: true } },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      availabilities: true,
    },
  });

  for (const overdueMatch of overdueMatches) {
    const homeAvail = overdueMatch.availabilities.find((a) => a.side === "home");
    const awayAvail = overdueMatch.availabilities.find((a) => a.side === "away");

    const homeName = overdueMatch.homePlayer?.name ?? overdueMatch.homeTeam?.name ?? "Home";
    const awayName = overdueMatch.awayPlayer?.name ?? overdueMatch.awayTeam?.name ?? "Away";

    const homeReady = !!homeAvail?.isAvailable;
    const awayReady = !!awayAvail?.isAvailable;

    // One ready, one not → auto-forfeit (walkover 3-0)
    if (homeReady && !awayReady) {
      // Home wins, away forfeits
      const { executeMatchCompletion } = await import("@/lib/actions/match");
      await executeMatchCompletion(overdueMatch.id, 3, 0);

      await notify({
        title: "Match Forfeited",
        body: `${awayName} did not respond. ${homeName} wins 3-0 walkover (${overdueMatch.tournament.name})`,
        url: `/matches/${overdueMatch.id}`,
        tag: `forfeit-${overdueMatch.id}`,
      });
      forfeitCount++;
    } else if (!homeReady && awayReady) {
      // Away wins, home forfeits
      const { executeMatchCompletion } = await import("@/lib/actions/match");
      await executeMatchCompletion(overdueMatch.id, 0, 3);

      await notify({
        title: "Match Forfeited",
        body: `${homeName} did not respond. ${awayName} wins 3-0 walkover (${overdueMatch.tournament.name})`,
        url: `/matches/${overdueMatch.id}`,
        tag: `forfeit-${overdueMatch.id}`,
      });
      forfeitCount++;
    } else if (!homeReady && !awayReady) {
      // Neither responded — notify admin only (don't auto-forfeit both)
      await notify({
        title: "Both Players Unresponsive",
        body: `${homeName} vs ${awayName} — neither player responded. Admin action needed. (${overdueMatch.tournament.name})`,
        url: `/admin/matches/${overdueMatch.id}`,
        tag: `both-unresponsive-${overdueMatch.id}`,
      });
    }
    // Both ready but overdue → match stays open, admin enters score manually
  }

  return NextResponse.json({
    ok: true,
    processed: matches.length,
    remindersSent: remindersSentCount,
    whatsappSent: whatsappSentCount,
    overdue: overdueCount,
    forfeited: forfeitCount,
    timestamp: now.toISOString(),
  });
}
