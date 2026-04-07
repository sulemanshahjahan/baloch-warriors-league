import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyLib from "slugify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export type GameCategory =
  | "FOOTBALL"
  | "EFOOTBALL"
  | "PUBG"
  | "SNOOKER"
  | "CHECKERS";

export type TournamentStatus =
  | "DRAFT"
  | "UPCOMING"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type MatchStatus = "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";

const GAME_LABELS: Record<GameCategory, string> = {
  FOOTBALL: "Football",
  EFOOTBALL: "eFootball",
  PUBG: "PUBG",
  SNOOKER: "Snooker",
  CHECKERS: "Checkers",
};

const STATUS_LABELS: Record<TournamentStatus | MatchStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  POSTPONED: "Postponed",
};

const GAME_COLORS: Record<GameCategory, string> = {
  FOOTBALL: "bg-green-500/10 text-green-500",
  EFOOTBALL: "bg-blue-500/10 text-blue-500",
  PUBG: "bg-orange-500/10 text-orange-500",
  SNOOKER: "bg-red-500/10 text-red-500",
  CHECKERS: "bg-gray-500/10 text-gray-500",
};

const STATUS_COLORS: Record<TournamentStatus | MatchStatus, string> = {
  DRAFT: "bg-gray-500/10 text-gray-500",
  UPCOMING: "bg-blue-500/10 text-blue-500",
  REGISTRATION_OPEN: "bg-green-500/10 text-green-500",
  REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-500",
  ACTIVE: "bg-green-500/10 text-green-500",
  COMPLETED: "bg-gray-500/10 text-gray-500",
  CANCELLED: "bg-red-500/10 text-red-500",
  SCHEDULED: "bg-yellow-500/10 text-yellow-500",
  LIVE: "bg-red-500/10 text-red-500 animate-pulse",
  POSTPONED: "bg-orange-500/10 text-orange-500",
};

export function gameLabel(game: GameCategory): string {
  return GAME_LABELS[game] ?? game;
}

export function statusLabel(status: TournamentStatus | MatchStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function gameColor(game: GameCategory): string {
  return GAME_COLORS[game] ?? "bg-gray-500/10 text-gray-500";
}

export function statusColor(status: TournamentStatus | MatchStatus): string {
  return STATUS_COLORS[status] ?? "bg-gray-500/10 text-gray-500";
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLabel(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get display name for a knockout round based on stored round name and round number.
 * Handles proper labeling for all knockout stages with match numbers.
 */
export function getRoundDisplayName(
  round: string | null,
  roundNumber: number | null,
  matchNumber: number | null = null
): string {
  // If round already has a proper descriptive name, use it and add match number
  if (round) {
    const lowerRound = round.toLowerCase();
    
    // Check for already descriptive round names
    if (lowerRound.includes("final")) {
      // Could be "Final", "Semi Final", "Quarter Final", etc.
      return formatRoundWithMatchNumber(round, matchNumber);
    }
    
    if (lowerRound.includes("semi")) {
      return formatRoundWithMatchNumber("Semi Final", matchNumber);
    }
    
    if (lowerRound.includes("quarter")) {
      return formatRoundWithMatchNumber("Quarter Final", matchNumber);
    }
    
    if (lowerRound.includes("round of 16") || lowerRound.includes("16")) {
      return formatRoundWithMatchNumber("Round of 16", matchNumber);
    }
    
    // Group stage matches - keep as is
    if (lowerRound.includes("group")) {
      return round;
    }
    
    // If it's "Round X" format, try to determine based on context
    const roundMatch = round.match(/^round\s*(\d+)$/i);
    if (roundMatch) {
      const num = parseInt(roundMatch[1], 10);
      return inferRoundNameFromNumber(num, matchNumber);
    }
    
    // Any other round name, return as-is with match number if provided
    return formatRoundWithMatchNumber(round, matchNumber);
  }
  
  // No round name, try to infer from roundNumber
  if (roundNumber) {
    return inferRoundNameFromNumber(roundNumber, matchNumber);
  }
  
  // Default fallback
  return matchNumber ? `Match ${matchNumber}` : "Match";
}

/**
 * Format a round name with optional match number
 */
function formatRoundWithMatchNumber(roundName: string, matchNumber: number | null): string {
  if (!matchNumber) return roundName;
  return `${roundName} ${matchNumber}`;
}

/**
 * Infer round name from round number based on typical tournament structures.
 * This is a best guess when we don't have descriptive round names.
 */
function inferRoundNameFromNumber(roundNum: number, matchNumber: number | null): string {
  // The interpretation depends on how many rounds the tournament has
  // We assume the highest round number is the Final
  
  // For now, use a common mapping that works for most tournaments:
  // - Small tournament (4 players): Round 1 = Semi-finals, Round 2 = Final
  // - Medium tournament (8 players): Round 1 = Quarter-finals, Round 2 = Semi-finals, Round 3 = Final
  // - Large tournament (16 players): Round 1 = Round of 16, Round 2 = Quarter-finals, Round 3 = Semi-finals, Round 4 = Final
  
  // Since we don't know total rounds, we'll use a generic but clear mapping
  switch (roundNum) {
    case 1:
      return formatRoundWithMatchNumber("Round 1", matchNumber);
    case 2:
      return formatRoundWithMatchNumber("Round 2", matchNumber);
    case 3:
      return formatRoundWithMatchNumber("Round 3", matchNumber);
    case 4:
      return formatRoundWithMatchNumber("Round 4", matchNumber);
    default:
      return formatRoundWithMatchNumber(`Round ${roundNum}`, matchNumber);
  }
}

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };
