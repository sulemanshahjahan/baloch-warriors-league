/**
 * Availability block helpers — the bridge between stored `AvailabilityBlock`
 * rows and the pure engine's `AvailabilityInterval[]`, plus month-level stats
 * and minimum-requirement validation. Kept free of Prisma/Next imports so it
 * can be unit-tested and reused on the client for live previews.
 */
import type { AvailabilityInterval, AvailabilityStatus } from "./types";
import { pktAllDay } from "./time";

/** The subset of AvailabilityBlock fields the helpers need. */
export interface BlockLike {
  date: string; // "YYYY-MM-DD" (period timezone)
  startDateTime: Date | string | null;
  endDateTime: Date | string | null;
  status: AvailabilityStatus;
  isAllDay: boolean;
  isOvernight?: boolean;
}

export interface MinRequirements {
  mode: "HARD" | "SOFT" | "DISABLED";
  minimumAvailableSlots?: number | null;
  minimumAvailableDays?: number | null;
  /** Minimum minutes each counted slot must last. */
  minimumSlotDuration?: number | null;
  /** Optional: minimum number of distinct weekdays covered. */
  minimumWeekdays?: number | null;
}

export interface MonthStats {
  blockCount: number;
  availableDays: number;
  availableHours: number;
  confirmedSlots: number;
  likelySlots: number;
  ifNeededSlots: number;
  unknownShiftDays: number;
  unavailableDays: number;
  distinctWeekdays: number;
  /** Slots meeting a given minimum duration (filled by validateMinRequirements). */
  qualifyingSlots?: number;
}

/** Statuses the engine can actually use for an overlap. */
export const ELIGIBLE_STATUSES: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED", "SHIFT_UNCONFIRMED"];

function ms(d: Date | string | null): number | null {
  if (d == null) return null;
  return (typeof d === "string" ? new Date(d) : d).getTime();
}

/** Convert one stored block to an absolute-instant interval. */
export function blockToInterval(b: BlockLike): AvailabilityInterval {
  if (b.isAllDay || b.startDateTime == null || b.endDateTime == null) {
    const day = pktAllDay(b.date);
    return { start: day.start, end: day.end, status: b.status };
  }
  return { start: ms(b.startDateTime)!, end: ms(b.endDateTime)!, status: b.status };
}

/** Convert a set of a single player's blocks to engine intervals. */
export function blocksToIntervals(blocks: BlockLike[]): AvailabilityInterval[] {
  return blocks.map(blockToInterval);
}

function durationHours(b: BlockLike): number {
  const iv = blockToInterval(b);
  return (iv.end - iv.start) / 3_600_000;
}

/** Weekday index (0=Sun..6=Sat) for a YYYY-MM-DD date, in PKT. */
function weekdayOf(dateStr: string): number {
  const day = pktAllDay(dateStr);
  // midday avoids any boundary ambiguity
  return new Date(day.start + 12 * 3_600_000).getUTCDay();
}

export function computeMonthStats(blocks: BlockLike[]): MonthStats {
  const eligibleDays = new Set<string>();
  const shiftDays = new Set<string>();
  const unavailableDays = new Set<string>();
  const weekdays = new Set<number>();
  let confirmed = 0;
  let likely = 0;
  let ifNeeded = 0;
  let availableHours = 0;

  for (const b of blocks) {
    const isEligible = ELIGIBLE_STATUSES.includes(b.status) && b.status !== "SHIFT_UNCONFIRMED";
    if (b.status === "CONFIRMED") confirmed++;
    else if (b.status === "LIKELY") likely++;
    else if (b.status === "IF_NEEDED") ifNeeded++;
    if (b.status === "SHIFT_UNCONFIRMED") shiftDays.add(b.date);
    if (b.status === "UNAVAILABLE") unavailableDays.add(b.date);
    if (isEligible) {
      eligibleDays.add(b.date);
      weekdays.add(weekdayOf(b.date));
      availableHours += durationHours(b);
    }
  }

  return {
    blockCount: blocks.length,
    availableDays: eligibleDays.size,
    availableHours: Math.round(availableHours * 10) / 10,
    confirmedSlots: confirmed,
    likelySlots: likely,
    ifNeededSlots: ifNeeded,
    unknownShiftDays: shiftDays.size,
    unavailableDays: unavailableDays.size,
    distinctWeekdays: weekdays.size,
  };
}

export interface RequirementCheck {
  ok: boolean; // false only when a HARD requirement is unmet
  hardFailures: string[];
  softWarnings: string[];
  qualifyingSlots: number;
}

/**
 * Validate a month's blocks against a tournament's minimum requirements.
 * HARD mode → unmet items block submission; SOFT → warn only; DISABLED → skip.
 */
export function validateMinRequirements(
  blocks: BlockLike[],
  req: MinRequirements
): RequirementCheck {
  const issues: string[] = [];
  const stats = computeMonthStats(blocks);

  // "Slots" = eligible blocks meeting the minimum duration.
  const minDur = req.minimumSlotDuration ?? 0;
  const qualifyingSlots = blocks.filter(
    (b) =>
      ELIGIBLE_STATUSES.includes(b.status) &&
      b.status !== "SHIFT_UNCONFIRMED" &&
      durationHours(b) * 60 >= minDur
  ).length;

  if (req.mode === "DISABLED") {
    return { ok: true, hardFailures: [], softWarnings: [], qualifyingSlots };
  }

  if (req.minimumAvailableSlots && qualifyingSlots < req.minimumAvailableSlots) {
    issues.push(
      `At least ${req.minimumAvailableSlots} available time block(s)${
        minDur ? ` of ≥${minDur} min` : ""
      } required — you have ${qualifyingSlots}.`
    );
  }
  if (req.minimumAvailableDays && stats.availableDays < req.minimumAvailableDays) {
    issues.push(
      `At least ${req.minimumAvailableDays} available day(s) required — you have ${stats.availableDays}.`
    );
  }
  if (req.minimumWeekdays && stats.distinctWeekdays < req.minimumWeekdays) {
    issues.push(
      `Availability should span at least ${req.minimumWeekdays} different weekdays — you have ${stats.distinctWeekdays}.`
    );
  }
  if (stats.availableDays === 0) {
    issues.push("You have no available time at all — the scheduler cannot place any match.");
  }

  const isHard = req.mode === "HARD";
  return {
    ok: !isHard || issues.length === 0,
    hardFailures: isHard ? issues : [],
    softWarnings: isHard ? [] : issues,
    qualifyingSlots,
  };
}

/** List of "YYYY-MM-DD" days in a given month (1-12). */
export function monthDayStrings(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate(); // last day of month
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}
