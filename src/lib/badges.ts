/**
 * Achievement badges computed from player match data.
 * All badges are auto-awarded — no admin action needed.
 */

export interface PlayerBadge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  color: string; // tailwind color class
}

export interface PlayerMatchData {
  totalMatches: number;
  totalWins: number;
  totalGoals: number;
  cleanSheets: number;
  consecutiveCleanSheets: number;
  currentWinStreak: number;
  longestWinStreak: number;
  hatTricks: number; // matches with 3+ goals
  tournamentWins: number; // TOURNAMENT_WINNER awards
  giantKillings: number; // wins vs opponents 50+ ELO higher
  perfectGroupRuns: number; // won all group matches in a group
}

export const ALL_BADGES: Array<{ id: string; name: string; description: string; icon: string; color: string; check: (d: PlayerMatchData) => boolean }> = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Win your first match",
    icon: "⚔️",
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    check: (d) => d.totalWins >= 1,
  },
  {
    id: "hat_trick",
    name: "Hat Trick Hero",
    description: "Score 3+ goals in a match",
    icon: "🔥",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    check: (d) => d.hatTricks >= 1,
  },
  {
    id: "clean_machine",
    name: "Clean Machine",
    description: "5 clean sheets",
    icon: "🛡️",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    check: (d) => d.cleanSheets >= 5,
  },
  {
    id: "win_streak_5",
    name: "Win Streak 5",
    description: "5 wins in a row",
    icon: "⚡",
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    check: (d) => d.longestWinStreak >= 5,
  },
  {
    id: "giant_killer",
    name: "Giant Killer",
    description: "Beat a player with 50+ higher ELO",
    icon: "👑",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    check: (d) => d.giantKillings >= 1,
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Score 100+ career goals",
    icon: "⭐",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    check: (d) => d.totalGoals >= 100,
  },
  {
    id: "iron_wall",
    name: "Iron Wall",
    description: "3 consecutive clean sheets",
    icon: "🧱",
    color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    check: (d) => d.consecutiveCleanSheets >= 3,
  },
  {
    id: "season_champion",
    name: "Season Champion",
    description: "Won a tournament",
    icon: "🏆",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
    check: (d) => d.tournamentWins >= 1,
  },
  {
    id: "ten_win_club",
    name: "10 Win Club",
    description: "10 career wins",
    icon: "🎖️",
    color: "text-green-400 bg-green-500/10 border-green-500/20",
    check: (d) => d.totalWins >= 10,
  },
  {
    id: "perfect_group",
    name: "Perfect Group",
    description: "Won all matches in a group",
    icon: "💎",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    check: (d) => d.perfectGroupRuns >= 1,
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "50+ matches played",
    icon: "🏅",
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    check: (d) => d.totalMatches >= 50,
  },
  {
    id: "goal_machine",
    name: "Goal Machine",
    description: "50+ career goals",
    icon: "⚽",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    check: (d) => d.totalGoals >= 50,
  },
];

export function getEarnedBadges(data: PlayerMatchData): PlayerBadge[] {
  return ALL_BADGES.filter((b) => b.check(data)).map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    color: b.color,
  }));
}
