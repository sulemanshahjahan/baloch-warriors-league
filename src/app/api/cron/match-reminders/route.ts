import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/push";

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
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
    },
  });

  let remindersSentCount = 0;
  let overdueCount = 0;

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

  // ── Phase 2: Auto-confirm stale score reports ──
  let autoConfirmedCount = 0;

  const staleReports = await prisma.scoreReport.findMany({
    where: {
      status: "PENDING",
      autoConfirmAt: { lte: now },
    },
    include: {
      match: {
        include: {
          tournament: { select: { name: true } },
          homePlayer: { select: { name: true } },
          awayPlayer: { select: { name: true } },
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  });

  for (const report of staleReports) {
    // Update report status
    await prisma.scoreReport.update({
      where: { id: report.id },
      data: { status: "AUTO_CONFIRMED", respondedAt: now },
    });

    // Trigger the full match completion cascade
    const { executeMatchCompletion } = await import("@/lib/actions/match");
    await executeMatchCompletion(report.matchId, report.homeScore, report.awayScore);

    const homeName = report.match.homePlayer?.name ?? report.match.homeTeam?.name ?? "Home";
    const awayName = report.match.awayPlayer?.name ?? report.match.awayTeam?.name ?? "Away";

    await notify({
      title: "Score Auto-Confirmed",
      body: `${homeName} ${report.homeScore} - ${report.awayScore} ${awayName} (${report.match.tournament.name})`,
      url: `/matches/${report.matchId}`,
      tag: `auto-confirm-${report.matchId}`,
    });

    autoConfirmedCount++;
  }

  return NextResponse.json({
    ok: true,
    processed: matches.length,
    remindersSent: remindersSentCount,
    overdue: overdueCount,
    autoConfirmed: autoConfirmedCount,
    timestamp: now.toISOString(),
  });
}
