"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getPlayerSession } from "@/lib/player-session";
import { fromKarachiInputValue, type ActionResult } from "@/lib/utils";
import {
  blockInputSchema,
  bulkApplySchema,
  templateInputSchema,
  applyTemplateSchema,
  submitPeriodSchema,
} from "@/lib/validations/availability";
import { validateMinRequirements, type BlockLike } from "@/lib/scheduling/blocks";
import { pktAllDay } from "@/lib/scheduling/time";
import { getPlayerMonthRequirements } from "@/lib/scheduling/requirements";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

// ── helpers ──────────────────────────────────────────────────

async function requirePlayerId(): Promise<string | null> {
  const s = await getPlayerSession();
  return s?.playerId ?? null;
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDayStr(s: string): string {
  const d = new Date(`${s}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateToStr(d);
}

function dateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const WHOLE_DAY_STATUSES = ["UNAVAILABLE", "SHIFT_UNCONFIRMED", "NO_RESPONSE"];

/** Resolve start/end absolute instants (or null for whole-day). */
function computeTimes(input: {
  date: string;
  status: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  isOvernight?: boolean;
}): { startDateTime: Date | null; endDateTime: Date | null; isAllDay: boolean; isOvernight: boolean } {
  const wholeDay = input.isAllDay || !input.startTime || !input.endTime;
  if (wholeDay || WHOLE_DAY_STATUSES.includes(input.status)) {
    return { startDateTime: null, endDateTime: null, isAllDay: true, isOvernight: false };
  }
  const start = fromKarachiInputValue(`${input.date}T${input.startTime}`);
  const endDay = input.isOvernight ? addDayStr(input.date) : input.date;
  const end = fromKarachiInputValue(`${endDay}T${input.endTime}`);
  return { startDateTime: start, endDateTime: end, isAllDay: false, isOvernight: !!input.isOvernight };
}

function rowRange(b: { date: Date; startDateTime: Date | null; endDateTime: Date | null; isAllDay: boolean }): {
  start: number;
  end: number;
} {
  if (b.isAllDay || !b.startDateTime || !b.endDateTime) {
    const day = pktAllDay(dateToStr(b.date));
    return day;
  }
  return { start: b.startDateTime.getTime(), end: b.endDateTime.getTime() };
}

async function getOrCreatePeriod(playerId: string, month: number, year: number, tx: Tx = prisma) {
  const existing = await tx.playerAvailabilityPeriod.findUnique({
    where: { playerId_month_year: { playerId, month, year } },
  });
  if (existing) return existing;
  return tx.playerAvailabilityPeriod.create({
    data: { playerId, month, year, timezone: "Asia/Karachi", status: "DRAFT" },
  });
}

function editableError(status: string): string | null {
  if (status === "LOCKED") return "Availability for this month is locked. Ask an admin to reopen it.";
  return null;
}

async function logEvent(
  playerId: string,
  eventType: string,
  data: { previousData?: unknown; newData?: unknown; reason?: string; metadata?: unknown } = {}
) {
  try {
    await prisma.schedulingAuditEvent.create({
      data: {
        playerId,
        actorType: "PLAYER",
        actorId: playerId,
        eventType,
        previousData: (data.previousData ?? undefined) as Prisma.InputJsonValue | undefined,
        newData: (data.newData ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: data.reason,
        metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Audit must never block the primary action.
  }
}

function revalidateAvailability() {
  revalidatePath("/player/availability");
  revalidatePath("/player/schedule");
}

// ── create / update a single block ───────────────────────────

export async function upsertAvailabilityBlock(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };

  const parsed = blockInputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const input = parsed.data;

  const month = Number(input.date.slice(5, 7));
  const year = Number(input.date.slice(0, 4));
  const times = computeTimes(input);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const period = await getOrCreatePeriod(playerId, month, year, tx);
      const lockErr = editableError(period.status);
      if (lockErr) throw new Error(lockErr);

      // If editing an existing block, make sure it belongs to this player.
      if (input.id) {
        const owned = await tx.availabilityBlock.findFirst({ where: { id: input.id, playerId } });
        if (!owned) throw new Error("Block not found.");
      }

      // Overlap handling on the same date.
      const sameDay = await tx.availabilityBlock.findMany({
        where: { periodId: period.id, date: dateOnly(input.date), NOT: input.id ? { id: input.id } : undefined },
      });

      if (times.isAllDay) {
        // A whole-day marker replaces every other block that day.
        await tx.availabilityBlock.deleteMany({
          where: { periodId: period.id, date: dateOnly(input.date), NOT: input.id ? { id: input.id } : undefined },
        });
      } else {
        // A specific time block supersedes a coarse "all day" marker on the same
        // day — remove any all-day blocks rather than treating them as a clash.
        const allDayIds = sameDay
          .filter((o) => o.isAllDay || !o.startDateTime || !o.endDateTime)
          .map((o) => o.id);
        if (allDayIds.length > 0) {
          await tx.availabilityBlock.deleteMany({ where: { id: { in: allDayIds } } });
        }
        // Only genuine timed blocks can actually clash.
        const nr = { start: times.startDateTime!.getTime(), end: times.endDateTime!.getTime() };
        const clash = sameDay.some((o) => {
          if (o.isAllDay || !o.startDateTime || !o.endDateTime) return false;
          const r = rowRange(o);
          return nr.start < r.end && nr.end > r.start;
        });
        if (clash) throw new Error("That window overlaps another time block on the same day. Edit or remove it first.");
      }

      const data = {
        periodId: period.id,
        playerId,
        date: dateOnly(input.date),
        status: input.status,
        dutyType: input.dutyType ?? null,
        confidence: input.confidence ?? null,
        isAllDay: times.isAllDay,
        isOvernight: times.isOvernight,
        startDateTime: times.startDateTime,
        endDateTime: times.endDateTime,
        note: input.note || null,
        privacy: input.privacy,
        source: "MANUAL" as const,
      };

      if (input.id) {
        const updated = await tx.availabilityBlock.update({ where: { id: input.id }, data });
        return updated.id;
      }
      const created = await tx.availabilityBlock.create({ data });
      // Touch the period so "updatedAt" reflects edits.
      await tx.playerAvailabilityPeriod.update({ where: { id: period.id }, data: { updatedAt: new Date() } });
      return created.id;
    });

    await logEvent(playerId, input.id ? "AVAILABILITY_BLOCK_UPDATED" : "AVAILABILITY_BLOCK_CREATED", {
      newData: { date: input.date, status: input.status },
    });
    revalidateAvailability();
    return { success: true, data: { id: result } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not save availability." };
  }
}

export async function deleteAvailabilityBlock(blockId: string): Promise<ActionResult> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };

  const block = await prisma.availabilityBlock.findFirst({
    where: { id: blockId, playerId },
    include: { period: { select: { status: true } } },
  });
  if (!block) return { success: false, error: "Block not found." };
  const lockErr = editableError(block.period.status);
  if (lockErr) return { success: false, error: lockErr };

  await prisma.availabilityBlock.delete({ where: { id: blockId } });
  await logEvent(playerId, "AVAILABILITY_BLOCK_DELETED", { previousData: { date: dateToStr(block.date) } });
  revalidateAvailability();
  return { success: true, data: undefined };
}

// ── quick whole-day set / clear ──────────────────────────────

export async function quickSetDay(raw: {
  date: string;
  status: "CONFIRMED" | "LIKELY" | "UNAVAILABLE" | "SHIFT_UNCONFIRMED" | "IF_NEEDED" | "CLEAR";
}): Promise<ActionResult> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return { success: false, error: "Invalid date." };

  const month = Number(raw.date.slice(5, 7));
  const year = Number(raw.date.slice(0, 4));

  try {
    await prisma.$transaction(async (tx) => {
      const period = await getOrCreatePeriod(playerId, month, year, tx);
      const lockErr = editableError(period.status);
      if (lockErr) throw new Error(lockErr);
      await tx.availabilityBlock.deleteMany({ where: { periodId: period.id, date: dateOnly(raw.date) } });
      if (raw.status !== "CLEAR") {
        await tx.availabilityBlock.create({
          data: {
            periodId: period.id,
            playerId,
            date: dateOnly(raw.date),
            status: raw.status,
            isAllDay: true,
            isOvernight: false,
            privacy: "PRIVATE",
            source: "MANUAL",
          },
        });
      }
    });
    await logEvent(playerId, "AVAILABILITY_DAY_SET", { newData: { date: raw.date, status: raw.status } });
    revalidateAvailability();
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not update the day." };
  }
}

// ── bulk apply (copy / repeat tools) ─────────────────────────

export async function bulkApplyAvailability(raw: unknown): Promise<ActionResult<{ count: number }>> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };

  const parsed = bulkApplySchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const b = parsed.data;

  const daysInMonth = new Date(b.year, b.month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const allDates = Array.from({ length: daysInMonth }, (_, i) => `${b.year}-${pad(b.month)}-${pad(i + 1)}`);

  // Which dates does this operation target?
  let targets: string[] = [];
  if (b.mode === "WEEKDAYS") {
    targets = allDates.filter((d) => b.weekdays!.includes(new Date(pktAllDay(d).start + 12 * 3.6e6).getUTCDay()));
  } else if (b.mode === "RANGE" || b.mode === "MARK_RANGE_UNAVAILABLE" || b.mode === "CLEAR") {
    const from = b.fromDate ?? allDates[0];
    const to = b.toDate ?? allDates[allDates.length - 1];
    targets = allDates.filter((d) => d >= from && d <= to);
  }

  try {
    const count = await prisma.$transaction(async (tx) => {
      const period = await getOrCreatePeriod(playerId, b.month, b.year, tx);
      const lockErr = editableError(period.status);
      if (lockErr) throw new Error(lockErr);

      if (b.mode === "COPY_PREVIOUS_MONTH") {
        const prevMonth = b.month === 1 ? 12 : b.month - 1;
        const prevYear = b.month === 1 ? b.year - 1 : b.year;
        const prev = await tx.playerAvailabilityPeriod.findUnique({
          where: { playerId_month_year: { playerId, month: prevMonth, year: prevYear } },
          include: { blocks: true },
        });
        if (!prev || prev.blocks.length === 0) throw new Error("No availability found for the previous month to copy.");
        // Clear this month, then recreate by same day-of-month.
        await tx.availabilityBlock.deleteMany({ where: { periodId: period.id } });
        let made = 0;
        for (const src of prev.blocks) {
          const dom = src.date.getUTCDate();
          if (dom > daysInMonth) continue; // e.g. copying a 31st into a 30-day month
          const newDateStr = `${b.year}-${pad(b.month)}-${pad(dom)}`;
          const times = computeTimes({
            date: newDateStr,
            status: src.status,
            isAllDay: src.isAllDay,
            startTime: src.startDateTime
              ? new Date(src.startDateTime.getTime() + 5 * 3.6e6).toISOString().slice(11, 16)
              : undefined,
            endTime: src.endDateTime
              ? new Date(src.endDateTime.getTime() + 5 * 3.6e6).toISOString().slice(11, 16)
              : undefined,
            isOvernight: src.isOvernight,
          });
          await tx.availabilityBlock.create({
            data: {
              periodId: period.id,
              playerId,
              date: dateOnly(newDateStr),
              status: src.status,
              dutyType: src.dutyType,
              isAllDay: times.isAllDay,
              isOvernight: times.isOvernight,
              startDateTime: times.startDateTime,
              endDateTime: times.endDateTime,
              note: src.note,
              privacy: src.privacy,
              source: "COPIED",
            },
          });
          made++;
        }
        return made;
      }

      // Clear the targeted days first (replace semantics).
      await tx.availabilityBlock.deleteMany({
        where: { periodId: period.id, date: { in: targets.map(dateOnly) } },
      });

      if (b.mode === "CLEAR") return targets.length;

      const status = b.mode === "MARK_RANGE_UNAVAILABLE" ? "UNAVAILABLE" : b.status ?? "CONFIRMED";
      const wantsTimes = !b.isAllDay && b.mode !== "MARK_RANGE_UNAVAILABLE" && b.startTime && b.endTime;

      let made = 0;
      for (const d of targets) {
        const times = computeTimes({
          date: d,
          status,
          isAllDay: b.isAllDay || !wantsTimes,
          startTime: b.startTime || undefined,
          endTime: b.endTime || undefined,
          isOvernight: b.isOvernight,
        });
        await tx.availabilityBlock.create({
          data: {
            periodId: period.id,
            playerId,
            date: dateOnly(d),
            status,
            dutyType: b.dutyType ?? null,
            isAllDay: times.isAllDay,
            isOvernight: times.isOvernight,
            startDateTime: times.startDateTime,
            endDateTime: times.endDateTime,
            note: b.note || null,
            privacy: "PRIVATE",
            source: "TEMPLATE",
          },
        });
        made++;
      }
      return made;
    });

    await logEvent(playerId, "AVAILABILITY_BULK_APPLY", { metadata: { mode: b.mode, count } });
    revalidateAvailability();
    return { success: true, data: { count } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not apply changes." };
  }
}

// ── templates ────────────────────────────────────────────────

export async function saveAvailabilityTemplate(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };
  const parsed = templateInputSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const t = parsed.data;

  if (t.isDefault) {
    await prisma.availabilityTemplate.updateMany({ where: { playerId, isDefault: true }, data: { isDefault: false } });
  }

  const saved = t.id
    ? await prisma.availabilityTemplate.update({
        where: { id: t.id },
        data: { name: t.name, description: t.description, rules: t.rules as Prisma.InputJsonValue, isDefault: !!t.isDefault },
      })
    : await prisma.availabilityTemplate.create({
        data: {
          playerId,
          name: t.name,
          description: t.description,
          rules: t.rules as Prisma.InputJsonValue,
          isDefault: !!t.isDefault,
        },
      });

  revalidateAvailability();
  return { success: true, data: { id: saved.id } };
}

export async function deleteAvailabilityTemplate(id: string): Promise<ActionResult> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };
  const owned = await prisma.availabilityTemplate.findFirst({ where: { id, playerId } });
  if (!owned) return { success: false, error: "Template not found." };
  await prisma.availabilityTemplate.delete({ where: { id } });
  revalidateAvailability();
  return { success: true, data: undefined };
}

export async function applyAvailabilityTemplate(raw: unknown): Promise<ActionResult<{ count: number }>> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };
  const parsed = applyTemplateSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const a = parsed.data;

  const template = await prisma.availabilityTemplate.findFirst({ where: { id: a.templateId, playerId } });
  if (!template) return { success: false, error: "Template not found." };
  const rules = (template.rules ?? {}) as Record<
    string,
    { status: string; isAllDay?: boolean; startTime?: string; endTime?: string; isOvernight?: boolean; dutyType?: string | null; note?: string }[]
  >;

  const daysInMonth = new Date(a.year, a.month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const allDates = Array.from({ length: daysInMonth }, (_, i) => `${a.year}-${pad(a.month)}-${pad(i + 1)}`);
  let targets = allDates;
  if (a.scope === "WEEKDAYS" && a.weekdays)
    targets = allDates.filter((d) => a.weekdays!.includes(new Date(pktAllDay(d).start + 12 * 3.6e6).getUTCDay()));
  if (a.scope === "RANGE" && a.fromDate && a.toDate) targets = allDates.filter((d) => d >= a.fromDate! && d <= a.toDate!);

  try {
    const count = await prisma.$transaction(async (tx) => {
      const period = await getOrCreatePeriod(playerId, a.month, a.year, tx);
      const lockErr = editableError(period.status);
      if (lockErr) throw new Error(lockErr);

      let made = 0;
      for (const d of targets) {
        const weekday = new Date(pktAllDay(d).start + 12 * 3.6e6).getUTCDay();
        const dayRules = rules[String(weekday)];
        if (!dayRules || dayRules.length === 0) continue;
        await tx.availabilityBlock.deleteMany({ where: { periodId: period.id, date: dateOnly(d) } });
        for (const rb of dayRules) {
          const times = computeTimes({
            date: d,
            status: rb.status,
            isAllDay: rb.isAllDay,
            startTime: rb.startTime,
            endTime: rb.endTime,
            isOvernight: rb.isOvernight,
          });
          await tx.availabilityBlock.create({
            data: {
              periodId: period.id,
              playerId,
              date: dateOnly(d),
              status: rb.status as never,
              dutyType: (rb.dutyType ?? null) as never,
              isAllDay: times.isAllDay,
              isOvernight: times.isOvernight,
              startDateTime: times.startDateTime,
              endDateTime: times.endDateTime,
              note: rb.note || null,
              privacy: "PRIVATE",
              source: "TEMPLATE",
            },
          });
          made++;
        }
      }
      return made;
    });

    await logEvent(playerId, "AVAILABILITY_TEMPLATE_APPLIED", { metadata: { templateId: a.templateId, count } });
    revalidateAvailability();
    return { success: true, data: { count } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not apply the template." };
  }
}

// ── submit the month ─────────────────────────────────────────

export async function submitAvailabilityPeriod(
  raw: unknown
): Promise<ActionResult<{ warnings: string[] }>> {
  const playerId = await requirePlayerId();
  if (!playerId) return { success: false, error: "Please sign in." };
  const parsed = submitPeriodSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { month, year } = parsed.data;

  const period = await prisma.playerAvailabilityPeriod.findUnique({
    where: { playerId_month_year: { playerId, month, year } },
    include: { blocks: true },
  });
  if (!period) return { success: false, error: "Add some availability before submitting." };
  const lockErr = editableError(period.status);
  if (lockErr) return { success: false, error: lockErr };

  const { requirements } = await getPlayerMonthRequirements(playerId);
  const blockLikes: BlockLike[] = period.blocks.map((b) => ({
    date: dateToStr(b.date),
    startDateTime: b.startDateTime,
    endDateTime: b.endDateTime,
    status: b.status as BlockLike["status"],
    isAllDay: b.isAllDay,
    isOvernight: b.isOvernight,
  }));
  const check = validateMinRequirements(blockLikes, requirements);
  if (!check.ok) {
    return { success: false, error: `Cannot submit yet: ${check.hardFailures.join(" ")}` };
  }

  await prisma.playerAvailabilityPeriod.update({
    where: { id: period.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  await logEvent(playerId, "AVAILABILITY_PERIOD_SUBMITTED", { metadata: { month, year, blocks: period.blocks.length } });
  revalidateAvailability();
  return { success: true, data: { warnings: check.softWarnings } };
}
