import { prisma } from "@/lib/db";
import { sendWhatsAppTemplate, type WhatsAppResult } from "@/lib/whatsapp";

export type WhatsAppCategory = "REMINDER" | "SCHEDULE" | "FIXTURE" | "OPPONENT_READY" | "OTHER";

export interface SendOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters: string[];

  // Logging + dedup metadata
  dedupKey: string; // e.g. "reminder:<matchId>:24h" — must be stable + unique per "intent"
  category: WhatsAppCategory;
  matchId?: string | null;
  playerId?: string | null;
  tournamentId?: string | null;
  force?: boolean; // if true, bypass dedup (admin-triggered resend)
}

export interface SendWithLogResult extends WhatsAppResult {
  skipped?: boolean;
  reason?: string;
}

/**
 * Central helper: check dedup → send via template → record log.
 * If a SENT log with the same dedupKey already exists, the send is skipped.
 */
export async function sendWithLog(opts: SendOptions): Promise<SendWithLogResult> {
  const cleanPhone = opts.to.replace(/[+\s\-()]/g, "");

  // Dedup: if a SENT log already exists for this key, skip (unless forced)
  if (!opts.force) {
    const existing = await prisma.whatsAppLog.findUnique({
      where: { dedupKey: opts.dedupKey },
      select: { status: true, id: true },
    });
    if (existing && existing.status === "SENT") {
      return { ok: true, skipped: true, reason: "Already sent (dedup)" };
    }
    // If a prior FAILED/SKIPPED log exists, we'll overwrite it below.
  }

  // Send
  const result = await sendWhatsAppTemplate({
    to: cleanPhone,
    templateName: opts.templateName,
    languageCode: opts.languageCode,
    parameters: opts.parameters,
  });

  const status: "SENT" | "FAILED" | "SKIPPED" = result.ok
    ? result.error
      ? "SKIPPED" // settings-level skip (test mode, toggle off)
      : "SENT"
    : "FAILED";

  // Upsert log row keyed on dedupKey
  try {
    await prisma.whatsAppLog.upsert({
      where: { dedupKey: opts.dedupKey },
      create: {
        dedupKey: opts.dedupKey,
        phone: cleanPhone,
        templateName: opts.templateName,
        category: opts.category,
        parameters: opts.parameters,
        status,
        error: result.error ?? null,
        matchId: opts.matchId ?? null,
        playerId: opts.playerId ?? null,
        tournamentId: opts.tournamentId ?? null,
      },
      update: {
        phone: cleanPhone,
        templateName: opts.templateName,
        category: opts.category,
        parameters: opts.parameters,
        status,
        error: result.error ?? null,
        matchId: opts.matchId ?? null,
        playerId: opts.playerId ?? null,
        tournamentId: opts.tournamentId ?? null,
        createdAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[whatsapp-log] Failed to write log", err);
  }

  return { ok: result.ok, error: result.error };
}

/** Reset a dedup entry so a forced resend can be recorded again. */
export async function clearDedup(dedupKey: string): Promise<void> {
  await prisma.whatsAppLog.deleteMany({ where: { dedupKey } });
}
