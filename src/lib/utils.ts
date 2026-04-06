import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyLib from "slugify";
import {
  GameCategory,
  TournamentStatus,
  MatchStatus,
  TournamentFormat,
} from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, trim: true });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "TBD";
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function gameLabel(game: GameCategory): string {
  const map: Record<GameCategory, string> = {
    FOOTBALL: "Football",
    EFOOTBALL: "eFootball",
    PUBG: "PUBG",
    SNOOKER: "Snooker",
    CHECKERS: "Checkers",
  };
  return map[game] ?? game;
}

export function formatLabel(format: TournamentFormat): string {
  const map: Record<TournamentFormat, string> = {
    LEAGUE: "League",
    KNOCKOUT: "Knockout",
    GROUP_KNOCKOUT: "Group + Knockout",
  };
  return map[format] ?? format;
}

export function statusLabel(status: TournamentStatus | MatchStatus): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    UPCOMING: "Upcoming",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    SCHEDULED: "Scheduled",
    LIVE: "Live",
    POSTPONED: "Postponed",
  };
  return map[status] ?? status;
}

export function statusColor(status: TournamentStatus | MatchStatus): string {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-500/20 text-gray-400",
    UPCOMING: "bg-blue-500/20 text-blue-400",
    ACTIVE: "bg-green-500/20 text-green-400",
    LIVE: "bg-red-500/20 text-red-400 animate-pulse",
    COMPLETED: "bg-slate-500/20 text-slate-400",
    CANCELLED: "bg-red-800/20 text-red-600",
    SCHEDULED: "bg-blue-500/20 text-blue-400",
    POSTPONED: "bg-yellow-500/20 text-yellow-400",
  };
  return map[status] ?? "bg-gray-500/20 text-gray-400";
}

export function gameColor(game: GameCategory): string {
  const map: Record<GameCategory, string> = {
    FOOTBALL: "bg-emerald-500/20 text-emerald-400",
    EFOOTBALL: "bg-purple-500/20 text-purple-400",
    PUBG: "bg-orange-500/20 text-orange-400",
    SNOOKER: "bg-teal-500/20 text-teal-400",
    CHECKERS: "bg-amber-500/20 text-amber-400",
  };
  return map[game] ?? "bg-gray-500/20 text-gray-400";
}

export function generateSlug(text: string): string {
  return slugify(text + "-" + Date.now().toString(36));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };
