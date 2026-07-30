import "server-only";

import { prisma } from "@/lib/db";
import { getOverallStats } from "@/lib/actions/stats";
import { gameLabel, getRoundDisplayName, getWalkoverSide } from "@/lib/utils";

/**
 * Landing-page data.
 *
 * Every section of the v2 landing page is fed from here so the page issues one
 * co-ordinated round of queries instead of each section fetching for itself.
 * Groups are settled independently — a section whose query fails renders its
 * empty state rather than taking the whole page down.
 */

// BWL leadership shown on the homepage. Roles are editorial (not stored on the
// Player model); avatars + names come from the live player records by slug.
const MANAGER_ROSTER = [
  { slug: "suleman", role: "Manager" },
  { slug: "yousuf", role: "Manager" },
  { slug: "haroon", role: "Manager" },
] as const;

/** Awards that read as "season honours" next to the champion. */
const HONOUR_TYPES = [
  "TOURNAMENT_WINNER",
  "TOURNAMENT_MVP",
  "GOLDEN_BOOT",
  "TOP_ASSISTS",
  "BEST_PLAYER",
  "BEST_GOALKEEPER",
  "FAIR_PLAY",
  "CUSTOM",
] as const;

export const HONOUR_LABELS: Record<string, string> = {
  TOURNAMENT_WINNER: "Grand final winner",
  BEST_PLAYER: "Player of the season",
  GOLDEN_BOOT: "Golden boot",
  TOP_ASSISTS: "Top assists",
  BEST_GOALKEEPER: "Best goalkeeper",
  FAIR_PLAY: "Fair play",
  TOURNAMENT_MVP: "Player of the tournament",
};

export function awardLabel(a: { type: string; customName: string | null }): string {
  if (a.type === "CUSTOM") return a.customName ?? "Honour";
  return (
    HONOUR_LABELS[a.type] ??
    a.type.split("_").map((s) => s[0] + s.slice(1).toLowerCase()).join(" ")
  );
}

export interface SideRef {
  /** null when the fixture side is still to be decided */
  id: string | null;
  name: string;
  href: string | null;
  type: "player" | "team";
}

export interface ResultRow {
  id: string;
  href: string;
  roundLabel: string | null;
  tournamentName: string;
  gameLabel: string;
  completedAt: Date | null;
  home: SideRef;
  away: SideRef;
  homeScore: number;
  awayScore: number;
  pens: { home: number; away: number } | null;
  /** "home" | "away" | null — null on a draw */
  winner: "home" | "away" | null;
  motm: string | null;
}

export interface FixtureRow {
  id: string;
  href: string;
  roundLabel: string | null;
  tournamentName: string;
  scheduledAt: Date | null;
  home: SideRef;
  away: SideRef;
  walkoverSide: "home" | "away" | null;
}

export interface LeaderCard {
  key: "goals" | "winRate" | "elo" | "cleanSheets";
  label: string;
  tag: string;
  value: number;
  suffix: string;
  playerName: string;
  playerId: string;
  href: string;
}

export interface ChampionData {
  tournament: { name: string; slug: string; endDate: Date | null; bannerUrl: string | null };
  winnerName: string;
  winnerHref: string;
  posterAlt: string;
  crownedAt: Date | null;
  description: string | null;
  stats: { matches: number; wins: number; losses: number; goals: number } | null;
  /** knockout ladder of the winning campaign, oldest round first */
  road: string[];
  finalScore: string | null;
  honours: {
    id: string;
    label: string;
    recipientName: string;
    recipientHref: string | null;
    avatarSrc: string | null;
    note: string | null;
  }[];
}

export interface PlayerOfWeekData {
  id: string;
  name: string;
  slug: string;
  goals: number;
  wins: number;
  matchesPlayed: number;
  eloGained: number;
  goalsPerMatch: string;
  eloRank: number | null;
  /** most recent last, true = win */
  form: boolean[];
  formLabel: string;
}

export interface ManagerCard {
  id: string;
  name: string;
  slug: string;
  role: string;
  tournaments: number;
  matches: number;
}

export interface TournamentCard {
  id: string;
  name: string;
  slug: string;
  gameCategory: string;
  status: string;
  participants: number;
  participantLabel: string;
  matches: number;
  eFootballMode: string | null;
  eFootballType: string | null;
}

export interface NewsCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
}

export interface LandingData {
  stats: { tournaments: number; players: number; matches: number; goals: number } | null;
  headline: {
    tournamentName: string;
    tournamentSlug: string;
    status: string;
    activePlayers: number;
  } | null;
  champion: ChampionData | null;
  playerOfWeek: PlayerOfWeekData | null;
  leaders: LeaderCard[];
  tournaments: TournamentCard[];
  managers: ManagerCard[];
  results: ResultRow[];
  fixtures: FixtureRow[];
  news: NewsCard[];
}

export const avatarSrc = (type: "player" | "team", id: string, size = 128) =>
  `/api/image?type=${type}&id=${id}&size=${size}`;

const settle = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
  r.status === "fulfilled" ? r.value : fallback;

/** Goals a side scored across all legs of a completed match. */
function legTotals(m: {
  homeScore: number | null;
  awayScore: number | null;
  leg2HomeScore: number | null;
  leg2AwayScore: number | null;
  leg3HomeScore: number | null;
  leg3AwayScore: number | null;
}) {
  const home = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
  const away = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
  return { home, away };
}

const matchSideSelect = {
  homeTeam: { select: { id: true, name: true, shortName: true, slug: true } },
  awayTeam: { select: { id: true, name: true, shortName: true, slug: true } },
  homePlayer: { select: { id: true, name: true, slug: true } },
  awayPlayer: { select: { id: true, name: true, slug: true } },
} as const;

type RawSides = {
  homeTeam: { id: string; name: string; shortName: string | null; slug: string } | null;
  awayTeam: { id: string; name: string; shortName: string | null; slug: string } | null;
  homePlayer: { id: string; name: string; slug: string } | null;
  awayPlayer: { id: string; name: string; slug: string } | null;
};

function toSide(m: RawSides, side: "home" | "away"): SideRef {
  const player = side === "home" ? m.homePlayer : m.awayPlayer;
  const team = side === "home" ? m.homeTeam : m.awayTeam;
  if (player) {
    return { id: player.id, name: player.name, href: `/players/${player.slug}`, type: "player" };
  }
  if (team) {
    return {
      id: team.id,
      name: team.shortName ?? team.name,
      href: `/teams/${team.slug}`,
      type: "team",
    };
  }
  return { id: null, name: "TBD", href: null, type: "player" };
}

async function loadChampion(): Promise<ChampionData | null> {
  // Current "Season Champion" = the most recently crowned tournament winner.
  // (Ordering tournaments by endDate is unreliable — many have a null endDate,
  //  which sorts first under DESC and would surface an older champion.)
  const latestWinnerAward = await prisma.award.findFirst({
    where: { type: "TOURNAMENT_WINNER" },
    orderBy: { createdAt: "desc" },
    select: { tournamentId: true, createdAt: true },
  });
  if (!latestWinnerAward) return null;

  const tournament = await prisma.tournament.findUnique({
    where: { id: latestWinnerAward.tournamentId },
    select: {
      id: true,
      name: true,
      slug: true,
      endDate: true,
      bannerUrl: true,
      awards: {
        where: { type: { in: [...HONOUR_TYPES] } },
        select: {
          id: true,
          type: true,
          customName: true,
          description: true,
          player: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!tournament) return null;

  const winnerAward =
    tournament.awards.find((a) => a.type === "TOURNAMENT_WINNER" && a.team) ??
    tournament.awards.find((a) => a.type === "TOURNAMENT_WINNER");
  if (!winnerAward) return null;

  const winnerName = winnerAward.player?.name ?? winnerAward.team?.name ?? "Champion";
  const winnerHref = winnerAward.player
    ? `/players/${winnerAward.player.slug}`
    : winnerAward.team
      ? `/teams/${winnerAward.team.slug}`
      : `/tournaments/${tournament.slug}`;

  // Winning campaign: every completed match of the tournament, used both for the
  // champion's record and for the "road to final" ladder. Ordered chronologically
  // — multi-stage tournaments restart roundNumber per stage, so it cannot order
  // the campaign on its own.
  const played = await prisma.match.findMany({
    where: { tournamentId: tournament.id, status: "COMPLETED" },
    orderBy: [{ completedAt: "asc" }, { roundNumber: "asc" }, { matchNumber: "asc" }],
    select: {
      round: true,
      roundNumber: true,
      matchNumber: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
      homeScorePens: true,
      awayScorePens: true,
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
    },
  });

  const winnerId = winnerAward.player?.id ?? winnerAward.team?.id ?? null;
  const isTeam = !winnerAward.player && !!winnerAward.team;

  let stats: ChampionData["stats"] = null;
  let finalScore: string | null = null;
  if (winnerId) {
    let matches = 0;
    let wins = 0;
    let losses = 0;
    let goals = 0;
    for (const m of played) {
      const homeId = isTeam ? m.homeTeamId : m.homePlayerId;
      const awayId = isTeam ? m.awayTeamId : m.awayPlayerId;
      const side = homeId === winnerId ? "home" : awayId === winnerId ? "away" : null;
      if (!side) continue;
      const t = legTotals(m);
      const own = side === "home" ? t.home : t.away;
      const opp = side === "home" ? t.away : t.home;
      matches++;
      goals += own;
      if (own > opp) wins++;
      else if (own < opp) losses++;
      else if (m.homeScorePens != null && m.awayScorePens != null) {
        const ownP = side === "home" ? m.homeScorePens : m.awayScorePens;
        const oppP = side === "home" ? m.awayScorePens : m.homeScorePens;
        if (ownP > oppP) wins++;
        else if (ownP < oppP) losses++;
      }
    }
    if (matches > 0) stats = { matches, wins, losses, goals };

    const finalMatch = [...played]
      .reverse()
      .find((m) => (m.round ?? "").toLowerCase().includes("final") && !(m.round ?? "").toLowerCase().includes("semi") && !(m.round ?? "").toLowerCase().includes("quarter"));
    if (finalMatch) {
      const t = legTotals(finalMatch);
      const homeId = isTeam ? finalMatch.homeTeamId : finalMatch.homePlayerId;
      finalScore =
        homeId === winnerId ? `${t.home}–${t.away}` : `${t.away}–${t.home}`;
    }
  }

  // "Road to final" — the champion's own knockout ladder, oldest step first.
  // Group/league rounds are excluded: the rail is about the run to the title.
  const road: string[] = [];
  for (const m of played) {
    if (!m.round || !/final/i.test(m.round)) continue;
    if (winnerId) {
      const homeId = isTeam ? m.homeTeamId : m.homePlayerId;
      const awayId = isTeam ? m.awayTeamId : m.awayPlayerId;
      if (homeId !== winnerId && awayId !== winnerId) continue;
    }
    const label = getRoundDisplayName(m.round, m.roundNumber, null);
    if (!road.includes(label)) road.push(label);
  }

  const honours = tournament.awards
    .filter((a) => a.id !== winnerAward.id)
    .map((a) => {
      const recipient = a.player ?? a.team;
      const isPlayer = !!a.player;
      return {
        id: a.id,
        label: awardLabel(a),
        recipientName: recipient?.name ?? "—",
        recipientHref: recipient
          ? isPlayer
            ? `/players/${recipient.slug}`
            : `/teams/${recipient.slug}`
          : null,
        avatarSrc: recipient ? avatarSrc(isPlayer ? "player" : "team", recipient.id) : null,
        note: a.description,
      };
    });

  return {
    tournament: {
      name: tournament.name,
      slug: tournament.slug,
      endDate: tournament.endDate,
      bannerUrl: tournament.bannerUrl,
    },
    winnerName,
    winnerHref,
    posterAlt: `${tournament.name} champion — ${winnerName}`,
    crownedAt: tournament.endDate ?? latestWinnerAward.createdAt,
    description: winnerAward.description,
    stats,
    road: road.slice(-4),
    finalScore,
    honours: [
      {
        id: winnerAward.id,
        label: HONOUR_LABELS.TOURNAMENT_WINNER,
        recipientName: winnerName,
        recipientHref: winnerHref,
        avatarSrc: winnerAward.player
          ? avatarSrc("player", winnerAward.player.id)
          : winnerAward.team
            ? avatarSrc("team", winnerAward.team.id)
            : null,
        note: finalScore ? `Final score ${finalScore}` : null,
      },
      ...honours,
    ],
  };
}

async function loadPlayerOfWeek(): Promise<PlayerOfWeekData | null> {
  // Only show Player of the Week if it was computed recently (within ~2 weeks) —
  // otherwise hide it rather than surfacing a stale winner from an idle period.
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const potw = await prisma.playerOfWeek.findFirst({
    where: { weekEnd: { gte: cutoff } },
    orderBy: { weekStart: "desc" },
    include: { player: { select: { id: true, name: true, slug: true, eloRating: true } } },
  });
  if (!potw?.player) return null;

  const [higherRated, recent] = await Promise.all([
    prisma.player.count({
      where: { isActive: true, eloRating: { gt: potw.player.eloRating } },
    }),
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ homePlayerId: potw.playerId }, { awayPlayerId: potw.playerId }],
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        homePlayerId: true,
        homeScore: true,
        awayScore: true,
        leg2HomeScore: true,
        leg2AwayScore: true,
        leg3HomeScore: true,
        leg3AwayScore: true,
      },
    }),
  ]);

  // Oldest first so the bar chart reads left → right through time.
  const form = [...recent].reverse().map((m) => {
    const t = legTotals(m);
    return m.homePlayerId === potw.playerId ? t.home > t.away : t.away > t.home;
  });
  const wonInForm = form.filter(Boolean).length;

  return {
    id: potw.player.id,
    name: potw.player.name,
    slug: potw.player.slug,
    goals: potw.goals,
    wins: potw.wins,
    matchesPlayed: potw.matchesPlayed,
    eloGained: potw.eloGained,
    goalsPerMatch:
      potw.matchesPlayed > 0 ? (potw.goals / potw.matchesPlayed).toFixed(1) : "0.0",
    eloRank: higherRated + 1,
    form,
    formLabel: form.length
      ? `Form · ${wonInForm}W ${form.length - wonInForm}L`
      : "Form · no matches yet",
  };
}

async function loadLeaders(): Promise<LeaderCard[]> {
  // Sourced from the canonical overall-stats calculator so the homepage always
  // matches /stats (includes 1v1 + 2v2 performance).
  const [overall, eloLeader] = await Promise.all([
    getOverallStats(),
    prisma.player.findFirst({
      where: { isActive: true, eloRating: { gt: 100 } },
      orderBy: [{ eloRating: "desc" }, { cardRank: "desc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true, eloRating: true },
    }),
  ]);

  const cards: LeaderCard[] = [];
  const scorer = overall.topScorers?.[0];
  if (scorer?.player) {
    cards.push({
      key: "goals",
      label: "Goals",
      tag: "League best",
      value: scorer.count,
      suffix: "",
      playerName: scorer.player.name,
      playerId: scorer.player.id,
      href: `/players/${scorer.player.slug}`,
    });
  }
  const winRate = overall.bestWinRate?.[0];
  if (winRate?.player) {
    cards.push({
      key: "winRate",
      label: "Win rate",
      tag: `${winRate.matches} matches`,
      value: winRate.count,
      suffix: "%",
      playerName: winRate.player.name,
      playerId: winRate.player.id,
      href: `/players/${winRate.player.slug}`,
    });
  }
  if (eloLeader) {
    cards.push({
      key: "elo",
      label: "ELO",
      tag: "Top rating",
      value: eloLeader.eloRating,
      suffix: "",
      playerName: eloLeader.name,
      playerId: eloLeader.id,
      href: `/players/${eloLeader.slug}`,
    });
  }
  const cleanSheets = overall.topCleanSheets?.[0];
  if (cleanSheets?.player) {
    cards.push({
      key: "cleanSheets",
      label: "Clean sheets",
      tag: "League best",
      value: cleanSheets.count,
      suffix: "",
      playerName: cleanSheets.player.name,
      playerId: cleanSheets.player.id,
      href: `/players/${cleanSheets.player.slug}`,
    });
  }
  return cards;
}

async function loadManagers(): Promise<ManagerCard[]> {
  const records = await prisma.player.findMany({
    where: { slug: { in: MANAGER_ROSTER.map((m) => m.slug) } },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { tournaments: true } },
    },
  });
  if (records.length === 0) return [];

  const playedCounts = await Promise.all(
    records.map((p) =>
      prisma.match.count({
        where: {
          status: "COMPLETED",
          OR: [{ homePlayerId: p.id }, { awayPlayerId: p.id }],
        },
      }),
    ),
  );
  const matchesById = new Map(records.map((p, i) => [p.id, playedCounts[i]]));

  return MANAGER_ROSTER.flatMap((m) => {
    const p = records.find((r) => r.slug === m.slug);
    if (!p) return [];
    return [
      {
        id: p.id,
        name: p.name,
        slug: p.slug,
        role: m.role,
        tournaments: p._count.tournaments,
        matches: matchesById.get(p.id) ?? 0,
      },
    ];
  });
}

export async function getLandingData(): Promise<LandingData> {
  const [
    statsR,
    headlineR,
    championR,
    potwR,
    leadersR,
    tournamentsR,
    managersR,
    resultsR,
    fixturesR,
    newsR,
  ] = await Promise.allSettled([
    prisma
      .$transaction([
        prisma.tournament.count(),
        prisma.player.count({ where: { isActive: true } }),
        prisma.match.count({ where: { status: "COMPLETED" } }),
        prisma.matchEvent.count({ where: { type: "GOAL" } }),
      ])
      .then(([tournaments, players, matches, goals]) => ({
        tournaments,
        players,
        matches,
        goals,
      })),
    // Headline tournament for the live strip — the running competition if there
    // is one, otherwise whatever is next up.
    prisma.tournament.findFirst({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      orderBy: [{ status: "asc" }, { isFeatured: "desc" }, { startDate: "asc" }],
      select: { name: true, slug: true, status: true },
    }),
    loadChampion(),
    loadPlayerOfWeek(),
    loadLeaders(),
    prisma.tournament.findMany({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      orderBy: [{ isFeatured: "desc" }, { startDate: "asc" }],
      take: 4,
      select: {
        id: true,
        name: true,
        slug: true,
        gameCategory: true,
        status: true,
        participantType: true,
        eFootballMode: true,
        eFootballType: true,
        // bannerUrl intentionally omitted — base64 stored images would bloat the ISR payload
        _count: { select: { teams: true, players: true, matches: true } },
      },
    }),
    loadManagers(),
    prisma.match.findMany({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        id: true,
        round: true,
        roundNumber: true,
        matchNumber: true,
        homeScore: true,
        awayScore: true,
        leg2HomeScore: true,
        leg2AwayScore: true,
        leg3HomeScore: true,
        leg3AwayScore: true,
        homeScorePens: true,
        awayScorePens: true,
        completedAt: true,
        tournament: { select: { name: true, gameCategory: true } },
        motmPlayer: { select: { name: true } },
        ...matchSideSelect,
      },
    }),
    prisma.match.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 4,
      select: {
        id: true,
        round: true,
        roundNumber: true,
        matchNumber: true,
        scheduledAt: true,
        notes: true,
        tournament: { select: { name: true } },
        ...matchSideSelect,
      },
    }),
    prisma.newsPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        publishedAt: true,
      },
    }),
  ]);

  const stats = settle(statsR, null);
  const headlineTournament = settle(headlineR, null);
  const champion = settle(championR, null);

  const rawResults = settle(resultsR, []);
  const results: ResultRow[] = rawResults.map((m) => {
    const t = legTotals(m);
    let winner: "home" | "away" | null =
      t.home > t.away ? "home" : t.away > t.home ? "away" : null;
    if (!winner && m.homeScorePens != null && m.awayScorePens != null) {
      winner = m.homeScorePens > m.awayScorePens ? "home" : m.awayScorePens > m.homeScorePens ? "away" : null;
    }
    return {
      id: m.id,
      href: `/matches/${m.id}`,
      roundLabel: m.round
        ? getRoundDisplayName(m.round, m.roundNumber, m.matchNumber)
        : null,
      tournamentName: m.tournament.name,
      gameLabel: gameLabel(m.tournament.gameCategory),
      completedAt: m.completedAt,
      home: toSide(m, "home"),
      away: toSide(m, "away"),
      homeScore: t.home,
      awayScore: t.away,
      pens:
        m.homeScorePens != null && m.awayScorePens != null
          ? { home: m.homeScorePens, away: m.awayScorePens }
          : null,
      winner,
      motm: m.motmPlayer?.name ?? null,
    };
  });

  const fixtures: FixtureRow[] = settle(fixturesR, []).map((m) => ({
    id: m.id,
    href: `/matches/${m.id}`,
    roundLabel: m.round ? getRoundDisplayName(m.round, m.roundNumber, m.matchNumber) : null,
    tournamentName: m.tournament.name,
    scheduledAt: m.scheduledAt,
    home: toSide(m, "home"),
    away: toSide(m, "away"),
    walkoverSide: getWalkoverSide(m.notes),
  }));

  const tournaments: TournamentCard[] = settle(tournamentsR, []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    gameCategory: t.gameCategory,
    status: t.status,
    participants: t.participantType === "INDIVIDUAL" ? t._count.players : t._count.teams,
    participantLabel: t.participantType === "INDIVIDUAL" ? "players" : "teams",
    matches: t._count.matches,
    eFootballMode: t.eFootballMode,
    eFootballType: t.eFootballType,
  }));

  const headline =
    headlineTournament != null
      ? {
          tournamentName: headlineTournament.name,
          tournamentSlug: headlineTournament.slug,
          status: headlineTournament.status,
          activePlayers: stats?.players ?? 0,
        }
      : champion != null
        ? {
            tournamentName: champion.tournament.name,
            tournamentSlug: champion.tournament.slug,
            status: "COMPLETED",
            activePlayers: stats?.players ?? 0,
          }
        : null;

  return {
    stats,
    headline,
    champion,
    playerOfWeek: settle(potwR, null),
    leaders: settle(leadersR, []),
    tournaments,
    managers: settle(managersR, []),
    results,
    fixtures,
    news: settle(newsR, []),
  };
}
