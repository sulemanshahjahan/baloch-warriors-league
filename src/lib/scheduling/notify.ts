import "server-only";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/push";
import { sendWithLog } from "@/lib/whatsapp-log";
import type { WaRecipient } from "@/lib/match-recipients";

// Scheduling notifications.
//
// `notify()` is a BROADCAST (all push subscribers + a global in-app feed), so we
// use it for match-level and admin-facing events, deduped by Notification.tag so
// the cron never repeats itself. Targeted per-player nudges go over WhatsApp, but
// only when an approved template is configured via WHATSAPP_SCHEDULE_TEMPLATE —
// otherwise we skip WhatsApp entirely rather than send a mismatched template.

function pktTime(d: Date | null | undefined): string {
  if (!d) return "a set time";
  return (
    d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) + " PKT"
  );
}

function tagSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

/** Broadcast at most once per tag (idempotent across cron runs). Returns true if sent. */
export async function broadcastOnce(opts: { title: string; body: string; url?: string; tag: string }): Promise<boolean> {
  const existing = await prisma.notification.findFirst({ where: { tag: opts.tag }, select: { id: true } });
  if (existing) return false;
  await notify(opts);
  return true;
}

export async function notifyMatchScheduled(match: {
  id: string;
  homeName: string;
  awayName: string;
  kickoff: Date | null;
}): Promise<void> {
  try {
    await broadcastOnce({
      title: "Match scheduled ✅",
      body: `${match.homeName} vs ${match.awayName} — ${pktTime(match.kickoff)}`,
      url: `/matches/${match.id}`,
      tag: `sched-scheduled-${match.id}`,
    });
  } catch {
    /* notifications never block the primary action */
  }
}

export async function notifySchedulingAdminAlert(opts: {
  matchId: string;
  tournamentId: string;
  homeName: string;
  awayName: string;
  reason: string;
}): Promise<void> {
  try {
    await broadcastOnce({
      title: "Scheduling needs attention",
      body: `${opts.homeName} vs ${opts.awayName}: ${opts.reason}`,
      url: `/admin/scheduling/${opts.tournamentId}`,
      tag: `sched-admin-${opts.matchId}-${tagSlug(opts.reason)}`,
    });
  } catch {
    /* ignore */
  }
}

export async function notifyConfirmationReminder(opts: {
  matchId: string;
  homeName: string;
  awayName: string;
  tier: string;
}): Promise<boolean> {
  try {
    return await broadcastOnce({
      title: "Confirm your match time",
      body: `${opts.homeName} vs ${opts.awayName} — please confirm or pick a proposed time.`,
      url: `/player/schedule`,
      tag: `sched-confirm-${opts.tier}-${opts.matchId}`,
    });
  } catch {
    return false;
  }
}

/**
 * Targeted WhatsApp nudge to specific pending participants. No-ops unless an
 * approved template is configured. Deduped per (match, tier, player).
 */
export async function whatsappConfirmationRequest(opts: {
  matchId: string;
  tournamentId: string;
  tier: string;
  recipients: WaRecipient[];
  opponentName: string;
  timeStr: string;
}): Promise<number> {
  const template = process.env.WHATSAPP_SCHEDULE_TEMPLATE;
  if (!template || opts.recipients.length === 0) return 0;
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://bwlleague.com"}/player/matches/${opts.matchId}`;
  let sent = 0;
  for (const r of opts.recipients) {
    const res = await sendWithLog({
      to: r.phone,
      templateName: template,
      parameters: [r.name, opts.opponentName, opts.timeStr, url],
      dedupKey: `sched-confirm:${opts.matchId}:${opts.tier}:${r.playerId}`,
      category: "SCHEDULE",
      matchId: opts.matchId,
      playerId: r.playerId,
      tournamentId: opts.tournamentId,
    });
    if (res.ok && !res.skipped) sent++;
  }
  return sent;
}
