// ─────────────────────────────────────────────────────────────
// Random team pool for the match "Ready Check" feature.
//
// A static, versioned list of clubs. Each entry has a stable `id` that is
// persisted on MatchReadyState.assignedTeamId — so the display survives edits
// to this list and we can exclude the previous team on a re-roll.
//
// `team` is the real club name, `efootball` is the in-game (eFootball) name.
// `teamLogo` / `leagueLogo` point at the crests under /public/teams and
// /public/leagues.
//
// Team selection ALWAYS happens on the server (see src/lib/match-ready.ts).
// The client never picks a team.
// ─────────────────────────────────────────────────────────────

export interface RandomTeam {
  id: string;
  region: string;
  league: string;
  team: string; // real club name
  efootball: string; // in-game (eFootball) name
  teamLogo: string; // /teams/<file>.webp
  leagueLogo: string; // /leagues/<file>.webp
}

/** Lock duration after a team is assigned — buttons stay disabled this long. */
export const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** How often the client polls the ready-state endpoint while the page is open. */
export const POLL_INTERVAL_MS = 4000; // 4 seconds

// League → crest under /public/leagues.
const LEAGUE_LOGO: Record<string, string> = {
  "English League": "/leagues/English League.webp",
  "Spanish League": "/leagues/Spanish League.webp",
  "Italian League": "/leagues/Lega Italia.webp",
  "Ligue 1 McDonald's": "/leagues/Ligue 1 McDonalds.webp",
  "Liga Portugal Betclic": "/leagues/Liga Portugal.webp",
  "Trendyol Süper Lig": "/leagues/Trendyol Super League.webp",
  "German Clubs": "/leagues/Other European Teams.webp",
};

// Compact source table — [id, league, realName, efootballName, teamLogoFile].
// leagueLogo is derived from LEAGUE_LOGO; region is Europe for all current entries.
const SRC: [string, string, string, string, string][] = [
  ["eng-manutd", "English League", "Manchester United", "Manchester United", "Manchester United.webp"],
  ["eng-arsenal", "English League", "Arsenal FC", "Arsenal FC", "Arsenal FC.webp"],
  ["eng-liverpool", "English League", "Liverpool", "Liverpool R", "Liverpool R.webp"],
  ["eng-mancity", "English League", "Manchester City", "Manchester B", "Manchester B.webp"],
  ["eng-chelsea", "English League", "Chelsea", "Chelsea B", "chelsea b.webp"],
  ["esp-barcelona", "Spanish League", "FC Barcelona", "FC Barcelona", "FC Barcelona.webp"],
  ["esp-realmadrid", "Spanish League", "Real Madrid", "Madrid Chamartin B", "Madrid Chamartin B.webp"],
  ["esp-atletico", "Spanish League", "Atlético de Madrid", "Madrid Rosas RB", "Madrid Rosas RB.webp"],
  ["ita-acmilan", "Italian League", "AC Milan", "AC Milan", "AC Milan.webp"],
  ["ita-inter", "Italian League", "Inter Milan", "Internazionale Milano", "Internazionale Milano.webp"],
  ["ita-juventus", "Italian League", "Juventus", "Piemonte BN", "Piemonte BN.webp"],
  ["ita-napoli", "Italian League", "SSC Napoli", "Napoli A", "Napoli A.webp"],
  ["ita-atalanta", "Italian League", "Atalanta B.C.", "Atalanta BC", "Atalanta BC.webp"],
  ["fra-psg", "Ligue 1 McDonald's", "Paris Saint-Germain", "Paris Saint-Germain", "Paris Saint-Germain.webp"],
  ["por-benfica", "Liga Portugal Betclic", "SL Benfica", "SL Benfica", "SL Benfica.webp"],
  ["tur-galatasaray", "Trendyol Süper Lig", "Galatasaray", "Galatasaray SK", "Galatasaray SK.webp"],
  ["ger-dortmund", "German Clubs", "Borussia Dortmund", "Borussia Dortmund", "Borussia Dortmund.webp"],
];

export const RANDOM_TEAMS: readonly RandomTeam[] = SRC.map(
  ([id, league, team, efootball, logoFile]) => ({
    id,
    region: "Europe",
    league,
    team,
    efootball,
    teamLogo: `/teams/${logoFile}`,
    leagueLogo: LEAGUE_LOGO[league] ?? "",
  }),
);

/** Look up a team by its stable id (null-safe). */
export function getTeamById(id: string | null | undefined): RandomTeam | null {
  if (!id) return null;
  return RANDOM_TEAMS.find((t) => t.id === id) ?? null;
}

/**
 * Pick a uniformly-random team from the pool. When `excludeId` is provided
 * (the previously assigned team) it is excluded so a re-roll never repeats the
 * immediately previous team. If excluding would empty the pool (shouldn't
 * happen) it falls back to the full pool.
 */
export function pickRandomTeam(excludeId?: string | null): RandomTeam {
  const pool = excludeId ? RANDOM_TEAMS.filter((t) => t.id !== excludeId) : RANDOM_TEAMS;
  const source = pool.length > 0 ? pool : RANDOM_TEAMS;
  const index = Math.floor(Math.random() * source.length);
  return source[index];
}
