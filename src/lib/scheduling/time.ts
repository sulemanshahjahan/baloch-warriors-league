/**
 * Minimal, dependency-free PKT (Asia/Karachi, fixed +05:00) helpers.
 *
 * The rest of the app uses `@/lib/utils` for date formatting; this module
 * exists so the scheduling engine and its tests stay free of any Prisma /
 * Next imports. Karachi has no DST, so a fixed offset is exact.
 */
const MINUTE = 60_000;
const DAY = 86_400_000;
export const PKT_OFFSET_MIN = 300;

/** Epoch ms for a wall-clock time interpreted in PKT. */
export function pktInstant(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute = 0,
  offsetMin = PKT_OFFSET_MIN
): number {
  return Date.UTC(year, month - 1, day, hour, minute) - offsetMin * MINUTE;
}

/**
 * Build an absolute UTC range from a calendar date and local start/end times.
 * Handles overnight (end ≤ start rolls to the next day, e.g. 23:00→02:00).
 */
export function pktRange(
  dateYYYYMMDD: string,
  startHM: string,
  endHM: string,
  overnight = false
): { start: number; end: number } {
  const [y, mo, d] = dateYYYYMMDD.split("-").map(Number);
  const [sh, sm] = startHM.split(":").map(Number);
  const [eh, em] = endHM.split(":").map(Number);
  const start = pktInstant(y, mo, d, sh, sm);
  let end = pktInstant(y, mo, d, eh, em);
  if (overnight || end <= start) end += DAY;
  return { start, end };
}

/** Whole calendar day (PKT) as a UTC range. */
export function pktAllDay(dateYYYYMMDD: string): { start: number; end: number } {
  const [y, mo, d] = dateYYYYMMDD.split("-").map(Number);
  const start = pktInstant(y, mo, d, 0, 0);
  return { start, end: start + DAY };
}

export function pktLocalHour(epochMs: number, offsetMin = PKT_OFFSET_MIN): number {
  return new Date(epochMs + offsetMin * MINUTE).getUTCHours();
}
