import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { teamMembersSelect, resolveSideRecipients } from "@/lib/match-recipients";
import {
  notifyConfirmationReminder,
  notifySchedulingAdminAlert,
  whatsappConfirmationRequest,
} from "@/lib/scheduling/notify";

export const dynamic = "force-dynamic";

const CONFIRM_TIERS = [
  { key: "12h", ms: 12 * 60 * 60 * 1000 },
  { key: "3h", ms: 3 * 60 * 60 * 1000 },
] as const;

const ACTIVE_CONFIRM = ["PROPOSED", "AWAITING_SELECTION", "AWAITING_CONFIRMATION", "PARTIALLY_CONFIRMED"];

function pktMonthYear(d: Date): { month: number; year: number } {
  const p = new Date(d.getTime() + 5 * 3_600_000);
  return { month: p.getUTCMonth() + 1, year: p.getUTCFullYear() };
}

function pktTimeStr(d: Date | null): string {
  if (!d) return "a proposed time";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) + " PKT";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let availabilityLocked = 0;
  let remindersSent = 0;
  let whatsappSent = 0;
  let escalated = 0;

  // ── 1) Lock availability past its (per-tournament) deadline ──
  // A deadline in month N locks the *next* month's availability (e.g. a July 28
  // deadline locks August), matching the monthly-planning model.
  const dueSettings = await prisma.tournamentSchedulingSettings.findMany({
    where: { enabled: true, availabilityDeadline: { not: null, lte: now } },
    select: { tournamentId: true, availabilityDeadline: true },
  });

  for (const s of dueSettings) {
    const dl = pktMonthYear(s.availabilityDeadline!);
    const target = dl.month === 12 ? { month: 1, year: dl.year + 1 } : { month: dl.month + 1, year: dl.year };

    const [indiv, teams] = await Promise.all([
      prisma.tournamentPlayer.findMany({ where: { tournamentId: s.tournamentId }, select: { playerId: true } }),
      prisma.tournamentTeam.findMany({
        where: { tournamentId: s.tournamentId },
        select: { team: { select: { players: { where: { isActive: true }, select: { playerId: true } } } } },
      }),
    ]);
    const playerIds = [
      ...new Set([...indiv.map((i) => i.playerId), ...teams.flatMap((t) => t.team.players.map((p) => p.playerId))]),
    ];
    if (playerIds.length === 0) continue;

    const res = await prisma.playerAvailabilityPeriod.updateMany({
      where: {
        playerId: { in: playerIds },
        month: target.month,
        year: target.year,
        status: { in: ["DRAFT", "SUBMITTED", "REOPENED"] },
      },
      data: { status: "LOCKED", lockedAt: now },
    });
    availabilityLocked += res.count;
  }

  // ── 2) Confirmation reminders + deadline / window escalation ──
  const schedules = await prisma.matchSchedule.findMany({
    where: {
      schedulingStatus: { notIn: ["SCHEDULED", "COMPLETED", "CANCELLED"] },
      OR: [{ confirmationDeadline: { not: null } }, { windowEnd: { not: null } }],
    },
    include: {
      match: {
        select: {
          id: true,
          tournamentId: true,
          homePlayer: { select: { id: true, name: true, phone: true } },
          awayPlayer: { select: { id: true, name: true, phone: true } },
          homeTeam: { select: { name: true, ...teamMembersSelect } },
          awayTeam: { select: { name: true, ...teamMembersSelect } },
        },
      },
      confirmations: { select: { playerId: true, status: true } },
    },
    take: 500,
  });

  for (const sched of schedules) {
    const m = sched.match;
    const homeName = m.homePlayer?.name ?? m.homeTeam?.name ?? "Home";
    const awayName = m.awayPlayer?.name ?? m.awayTeam?.name ?? "Away";
    const active = ACTIVE_CONFIRM.includes(sched.schedulingStatus);

    // Confirmation reminders (tiered, deduped by tag).
    if (active && sched.confirmationDeadline) {
      const msUntil = sched.confirmationDeadline.getTime() - now.getTime();
      for (const tier of CONFIRM_TIERS) {
        if (msUntil > 0 && msUntil <= tier.ms) {
          const didSend = await notifyConfirmationReminder({ matchId: m.id, homeName, awayName, tier: tier.key });
          if (didSend) remindersSent++;

          // Optional targeted WhatsApp to still-pending participants.
          const pendingIds = new Set(sched.confirmations.filter((c) => c.status === "PENDING").map((c) => c.playerId));
          const homeR = resolveSideRecipients({ player: m.homePlayer, team: m.homeTeam }).filter((r) => pendingIds.has(r.playerId));
          const awayR = resolveSideRecipients({ player: m.awayPlayer, team: m.awayTeam }).filter((r) => pendingIds.has(r.playerId));
          whatsappSent += await whatsappConfirmationRequest({ matchId: m.id, tournamentId: m.tournamentId, tier: tier.key, recipients: homeR, opponentName: awayName, timeStr: pktTimeStr(sched.primaryStart) });
          whatsappSent += await whatsappConfirmationRequest({ matchId: m.id, tournamentId: m.tournamentId, tier: tier.key, recipients: awayR, opponentName: homeName, timeStr: pktTimeStr(sched.primaryStart) });
          break; // one tier per run
        }
      }
    }

    // Confirmation deadline passed without full agreement → escalate.
    if (active && sched.confirmationDeadline && sched.confirmationDeadline.getTime() <= now.getTime()) {
      await prisma.matchSchedule.update({ where: { id: sched.id }, data: { schedulingStatus: "ADMIN_DECISION" } });
      await notifySchedulingAdminAlert({ matchId: m.id, tournamentId: m.tournamentId, homeName, awayName, reason: "Confirmation deadline passed without agreement" });
      escalated++;
      continue;
    }

    // Match window closed without a scheduled time → escalate.
    if (sched.windowEnd && sched.windowEnd.getTime() <= now.getTime()) {
      await prisma.matchSchedule.update({ where: { id: sched.id }, data: { schedulingStatus: "ADMIN_DECISION" } });
      await notifySchedulingAdminAlert({ matchId: m.id, tournamentId: m.tournamentId, homeName, awayName, reason: "Match window closed without a scheduled time" });
      escalated++;
    }
  }

  return NextResponse.json({
    ok: true,
    availabilityLocked,
    remindersSent,
    whatsappSent,
    escalated,
    timestamp: now.toISOString(),
  });
}
