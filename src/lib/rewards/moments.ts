import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// BWL Moments — permanent career memories. Idempotent (one per player+type).

export async function createMoment(opts: {
  playerId: string;
  type: string;
  title: string;
  description: string;
  icon?: string;
  rarity?: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  matchId?: string;
  tournamentId?: string;
}): Promise<boolean> {
  try {
    await prisma.playerMoment.create({
      data: {
        playerId: opts.playerId,
        type: opts.type,
        title: opts.title,
        description: opts.description,
        icon: opts.icon ?? null,
        rarity: opts.rarity ?? "COMMON",
        matchId: opts.matchId ?? null,
        tournamentId: opts.tournamentId ?? null,
      },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

function aggregate(home: boolean, m: {
  homeScore: number | null; awayScore: number | null;
  leg2HomeScore: number | null; leg2AwayScore: number | null;
  leg3HomeScore: number | null; leg3AwayScore: number | null;
}) {
  const h = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
  const a = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
  return home ? { mine: h, opp: a } : { mine: a, opp: h };
}

/** Create milestone moments triggered by a completed match. */
export async function createMomentsForMatch(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true, status: true, motmPlayerId: true,
      homePlayerId: true, awayPlayerId: true,
      homeScore: true, awayScore: true,
      leg2HomeScore: true, leg2AwayScore: true,
      leg3HomeScore: true, leg3AwayScore: true,
      tournament: { select: { gameCategory: true } },
      homeTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
      awayTeam: { select: { players: { where: { isActive: true }, select: { playerId: true } } } },
    },
  });
  if (!match || match.status !== "COMPLETED") return;

  const home = match.homePlayerId ? [match.homePlayerId] : (match.homeTeam?.players.map((p) => p.playerId) ?? []);
  const away = match.awayPlayerId ? [match.awayPlayerId] : (match.awayTeam?.players.map((p) => p.playerId) ?? []);
  const allIds = [...home, ...away];
  if (allIds.length === 0) return;
  const supportsCleanSheet = match.tournament.gameCategory === "EFOOTBALL" || match.tournament.gameCategory === "FOOTBALL";

  const cardRanks = new Map(
    (await prisma.player.findMany({ where: { id: { in: allIds } }, select: { id: true, cardRank: true } }))
      .map((p) => [p.id, p.cardRank]),
  );

  for (const side of [{ players: home, home: true }, { players: away, home: false }]) {
    const { mine, opp } = aggregate(side.home, match);
    const won = mine > opp;
    const cleanSheet = supportsCleanSheet && opp === 0;
    for (const playerId of side.players) {
      if (won) await createMoment({ playerId, type: "FIRST_WIN", title: "First Win", description: "Won their first BWL match.", icon: "🏅", rarity: "COMMON", matchId });
      if (cleanSheet) await createMoment({ playerId, type: "FIRST_CLEAN_SHEET", title: "First Clean Sheet", description: "Kept their first clean sheet.", icon: "🧤", rarity: "RARE", matchId });
      if ((cardRanks.get(playerId) ?? 0) >= 99) {
        await createMoment({ playerId, type: "REACHED_99", title: "Reached 99 Card Rank", description: "Hit the highest card rank in BWL.", icon: "💎", rarity: "LEGENDARY" });
      }
    }
  }

  if (match.motmPlayerId) {
    await createMoment({ playerId: match.motmPlayerId, type: "FIRST_MOTM", title: "First Man of the Match", description: "Earned their first MOTM award.", icon: "⭐", rarity: "RARE", matchId });
  }
}
