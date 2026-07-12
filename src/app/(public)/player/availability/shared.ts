// Shared types + status metadata for the availability calendar.
// Colors always pair with a label/short code so status is never conveyed by
// colour alone (accessibility requirement from the spec).

export type AvailabilityStatus =
  | "CONFIRMED"
  | "LIKELY"
  | "UNAVAILABLE"
  | "SHIFT_UNCONFIRMED"
  | "IF_NEEDED"
  | "NO_RESPONSE";

export interface DayBlock {
  id: string;
  date: string; // YYYY-MM-DD (PKT)
  status: AvailabilityStatus;
  isAllDay: boolean;
  isOvernight: boolean;
  startTime: string | null; // "HH:MM" PKT
  endTime: string | null; // "HH:MM" PKT
  dutyType: string | null;
  confidence: number | null;
  note: string | null;
  privacy: string;
}

export interface StatusMeta {
  label: string;
  short: string;
  /** chip classes */
  chip: string;
  /** solid dot classes for calendar cells */
  dot: string;
  cell: string;
}

export const STATUS_META: Record<AvailabilityStatus, StatusMeta> = {
  CONFIRMED: {
    label: "Confirmed available",
    short: "Available",
    chip: "bg-green-500/15 text-green-300 border border-green-500/30",
    dot: "bg-green-500",
    cell: "bg-green-500/10 border-green-500/30",
  },
  LIKELY: {
    label: "Likely available",
    short: "Likely",
    chip: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-500",
    cell: "bg-amber-500/10 border-amber-500/30",
  },
  IF_NEEDED: {
    label: "Available if needed",
    short: "If needed",
    chip: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    dot: "bg-sky-500",
    cell: "bg-sky-500/10 border-sky-500/30",
  },
  SHIFT_UNCONFIRMED: {
    label: "Shift not confirmed",
    short: "Shift TBD",
    chip: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    dot: "bg-purple-500",
    cell: "bg-purple-500/10 border-purple-500/30",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    short: "Unavailable",
    chip: "bg-red-500/15 text-red-300 border border-red-500/30",
    dot: "bg-red-500",
    cell: "bg-red-500/10 border-red-500/30",
  },
  NO_RESPONSE: {
    label: "No response",
    short: "—",
    chip: "bg-muted text-muted-foreground border border-border",
    dot: "bg-muted-foreground/40",
    cell: "",
  },
};

export const DUTY_LABELS: Record<string, string> = {
  DAY_SHIFT: "Day shift",
  NIGHT_SHIFT: "Night shift",
  OFF_DUTY: "Off duty",
  ROTATING: "Rotating shift",
  UNKNOWN: "Unknown duty",
  CUSTOM: "Custom",
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Weekday index (0=Sun) for a YYYY-MM-DD string. UTC-noon avoids DST/edge issues. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function fmtTimeRange(b: DayBlock): string {
  if (b.isAllDay) return "All day";
  if (!b.startTime || !b.endTime) return "All day";
  return `${b.startTime}–${b.endTime}${b.isOvernight ? " (+1)" : ""}`;
}
