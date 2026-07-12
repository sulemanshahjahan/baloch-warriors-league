/**
 * Pure interval / time-range math used by the scheduling engine.
 *
 * All times are absolute UTC epoch milliseconds. Overnight availability
 * (e.g. 11:00 PM–2:00 AM) is represented as a single range whose `end`
 * is simply greater than `start` — there is no special-casing here because
 * the data layer resolves local wall-clock times to absolute instants
 * before the engine ever sees them. This keeps the math trivial and correct
 * across midnight and (fixed-offset) timezones.
 */

export interface TimeRange {
  start: number; // epoch ms (UTC), inclusive
  end: number; // epoch ms (UTC), exclusive
}

/** Sort by start, then end. Returns a new array. */
export function sortRanges(rs: TimeRange[]): TimeRange[] {
  return [...rs].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Drop zero/negative-length ranges. */
export function compactRanges(rs: TimeRange[]): TimeRange[] {
  return rs.filter((r) => r.end > r.start);
}

/** Clip a single range to [lo, hi]; returns null if nothing remains. */
export function clipRange(r: TimeRange, lo?: number, hi?: number): TimeRange | null {
  const start = lo != null ? Math.max(r.start, lo) : r.start;
  const end = hi != null ? Math.min(r.end, hi) : r.end;
  return end > start ? { start, end } : null;
}

/** Merge overlapping / touching ranges into a minimal set. */
export function mergeRanges(rs: TimeRange[]): TimeRange[] {
  const sorted = sortRanges(compactRanges(rs));
  const out: TimeRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** Intersection of two range sets (time only). */
export function intersectTwo(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  const A = mergeRanges(a);
  const B = mergeRanges(b);
  const out: TimeRange[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const start = Math.max(A[i].start, B[j].start);
    const end = Math.min(A[i].end, B[j].end);
    if (end > start) out.push({ start, end });
    if (A[i].end < B[j].end) i++;
    else j++;
  }
  return out;
}

/** Intersection across many range sets. Empty input → empty. */
export function intersectMany(lists: TimeRange[][]): TimeRange[] {
  if (lists.length === 0) return [];
  return lists.reduce<TimeRange[]>(
    (acc, cur) => intersectTwo(acc, cur),
    mergeRanges(lists[0])
  );
}

/** Subtract `cut` from `base` (set difference). */
export function subtractRanges(base: TimeRange[], cut: TimeRange[]): TimeRange[] {
  let result = mergeRanges(base);
  for (const c of mergeRanges(cut)) {
    const next: TimeRange[] = [];
    for (const r of result) {
      // No overlap.
      if (c.end <= r.start || c.start >= r.end) {
        next.push(r);
        continue;
      }
      // Left remainder.
      if (c.start > r.start) next.push({ start: r.start, end: c.start });
      // Right remainder.
      if (c.end < r.end) next.push({ start: c.end, end: r.end });
    }
    result = next;
  }
  return result;
}

/** Total covered duration (ms) of a range set. */
export function totalDuration(rs: TimeRange[]): number {
  return mergeRanges(rs).reduce((s, r) => s + (r.end - r.start), 0);
}

/** True when `outer` fully covers [start, end). */
export function rangesCover(outer: TimeRange[], start: number, end: number): boolean {
  return mergeRanges(outer).some((r) => r.start <= start && r.end >= end);
}
