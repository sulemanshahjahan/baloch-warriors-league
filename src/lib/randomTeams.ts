// ─────────────────────────────────────────────────────────────
// Random team pool for the match "Ready Check" feature.
//
// A static, versioned list of clubs. Each entry has a stable `id` that is
// persisted on MatchReadyState.assignedTeamId — so the display survives edits
// to this list and we can exclude the previous team on a re-roll.
//
// Team selection ALWAYS happens on the server (see src/lib/match-ready.ts).
// The client never picks a team.
// ─────────────────────────────────────────────────────────────

export interface RandomTeam {
  id: string;
  region: string;
  league: string;
  team: string;
}

/** Lock duration after a team is assigned — buttons stay disabled this long. */
export const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** How often the client polls the ready-state endpoint while the page is open. */
export const POLL_INTERVAL_MS = 4000; // 4 seconds

export const RANDOM_TEAMS: readonly RandomTeam[] = [
  { id: "eng-manutd", region: "Europe", league: "English League", team: "Manchester United" },
  { id: "eng-arsenal", region: "Europe", league: "English League", team: "Arsenal FC" },
  { id: "eng-liverpool", region: "Europe", league: "English League", team: "Liverpool" },
  { id: "eng-mancity", region: "Europe", league: "English League", team: "Manchester City" },
  { id: "eng-chelsea", region: "Europe", league: "English League", team: "Chelsea" },
  { id: "eng-tottenham", region: "Europe", league: "English League", team: "Tottenham Hotspur" },
  { id: "esp-barcelona", region: "Europe", league: "Spanish League", team: "FC Barcelona" },
  { id: "esp-realmadrid", region: "Europe", league: "Spanish League", team: "Real Madrid" },
  { id: "esp-atletico", region: "Europe", league: "Spanish League", team: "Atlético de Madrid" },
  { id: "ita-acmilan", region: "Europe", league: "Italian League", team: "AC Milan" },
  { id: "ita-inter", region: "Europe", league: "Italian League", team: "Inter (Internazionale Milano)" },
  { id: "ita-juventus", region: "Europe", league: "Italian League", team: "Juventus" },
  { id: "ita-roma", region: "Europe", league: "Italian League", team: "AS Roma" },
  { id: "ita-napoli", region: "Europe", league: "Italian League", team: "SSC Napoli" },
  { id: "ita-atalanta", region: "Europe", league: "Italian League", team: "Atalanta B.C." },
  { id: "fra-psg", region: "Europe", league: "Ligue 1 McDonald's", team: "Paris Saint-Germain" },
  { id: "fra-marseille", region: "Europe", league: "Ligue 1 McDonald's", team: "Olympique de Marseille" },
  { id: "fra-monaco", region: "Europe", league: "Ligue 1 McDonald's", team: "AS Monaco" },
  { id: "por-benfica", region: "Europe", league: "Liga Portugal Betclic", team: "SL Benfica" },
  { id: "por-porto", region: "Europe", league: "Liga Portugal Betclic", team: "FC Porto" },
  { id: "tur-galatasaray", region: "Europe", league: "Trendyol Süper Lig", team: "Galatasaray" },
  { id: "tur-fenerbahce", region: "Europe", league: "Trendyol Süper Lig", team: "Fenerbahçe" },
  { id: "ned-ajax", region: "Europe", league: "Eredivisie", team: "AFC Ajax" },
  { id: "ger-dortmund", region: "Europe", league: "German Clubs", team: "Borussia Dortmund" },
  { id: "bra-flamengo", region: "South America", league: "Brasileirão Betano", team: "CR Flamengo" },
  { id: "bra-palmeiras", region: "South America", league: "Brasileirão Betano", team: "SE Palmeiras" },
  { id: "arg-riverplate", region: "South America", league: "Argentine League", team: "River Plate" },
  { id: "arg-boca", region: "South America", league: "Argentine League", team: "Boca Juniors" },
  { id: "usa-intermiami", region: "North & Central America", league: "American League (MLS)", team: "Inter Miami CF" },
  { id: "mex-america", region: "North & Central America", league: "Mexican Clubs", team: "Club América" },
] as const;

/** Look up a team by its stable id (null-safe). */
export function getTeamById(id: string | null | undefined): RandomTeam | null {
  if (!id) return null;
  return RANDOM_TEAMS.find((t) => t.id === id) ?? null;
}

/**
 * Pick a uniformly-random team from the pool. When `excludeId` is provided
 * (the previously assigned team) it is excluded so a re-roll never repeats the
 * immediately previous team. If excluding would empty the pool (shouldn't
 * happen with 30 teams) it falls back to the full pool.
 */
export function pickRandomTeam(excludeId?: string | null): RandomTeam {
  const pool = excludeId ? RANDOM_TEAMS.filter((t) => t.id !== excludeId) : RANDOM_TEAMS;
  const source = pool.length > 0 ? pool : RANDOM_TEAMS;
  const index = Math.floor(Math.random() * source.length);
  return source[index];
}
