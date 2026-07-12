import "server-only";
import { prisma } from "@/lib/db";
import type { MinRequirements } from "./blocks";

export interface ResolvedRequirements {
  requirements: MinRequirements;
  tournaments: { id: string; name: string }[];
}

/**
 * Aggregate the strictest minimum-availability requirements across every
 * scheduling-enabled tournament this player is currently in (individually or
 * via a duo/team). Returns DISABLED when none apply — the common case until an
 * admin turns scheduling on for a tournament.
 */
export async function getPlayerMonthRequirements(
  playerId: string
): Promise<ResolvedRequirements> {
  const disabled: ResolvedRequirements = {
    requirements: { mode: "DISABLED" },
    tournaments: [],
  };

  // Enabled scheduling settings for live tournaments.
  const settings = await prisma.tournamentSchedulingSettings.findMany({
    where: {
      enabled: true,
      tournament: { status: { in: ["UPCOMING", "ACTIVE", "DRAFT"] } },
    },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (settings.length === 0) return disabled;

  const tournamentIds = settings.map((s) => s.tournamentId);

  // Tournaments this player is enrolled in — as an individual…
  const individual = await prisma.tournamentPlayer.findMany({
    where: { playerId, tournamentId: { in: tournamentIds } },
    select: { tournamentId: true },
  });

  // …or via any active team membership (covers 2v2 duos).
  const teamMemberships = await prisma.teamPlayer.findMany({
    where: { playerId, isActive: true },
    select: { teamId: true },
  });
  const teamIds = teamMemberships.map((t) => t.teamId);
  const viaTeam =
    teamIds.length > 0
      ? await prisma.tournamentTeam.findMany({
          where: { teamId: { in: teamIds }, tournamentId: { in: tournamentIds } },
          select: { tournamentId: true },
        })
      : [];

  const enrolledIds = new Set([
    ...individual.map((i) => i.tournamentId),
    ...viaTeam.map((t) => t.tournamentId),
  ]);
  const applicable = settings.filter((s) => enrolledIds.has(s.tournamentId));
  if (applicable.length === 0) return disabled;

  // Strictest wins: HARD > SOFT > DISABLED; take the max of each minimum.
  const modeRank = { DISABLED: 0, SOFT: 1, HARD: 2 } as const;
  let mode: MinRequirements["mode"] = "DISABLED";
  const maxOf = (get: (s: (typeof applicable)[number]) => number | null) =>
    applicable.reduce<number | null>((m, s) => {
      const v = get(s);
      return v == null ? m : m == null ? v : Math.max(m, v);
    }, null);

  for (const s of applicable) {
    if (modeRank[s.minRequirementMode] > modeRank[mode]) mode = s.minRequirementMode;
  }

  return {
    requirements: {
      mode,
      minimumAvailableSlots: maxOf((s) => s.minimumAvailableSlots),
      minimumAvailableDays: maxOf((s) => s.minimumAvailableDays),
      minimumSlotDuration: maxOf((s) => s.minimumSlotDuration),
    },
    tournaments: applicable.map((s) => ({ id: s.tournament.id, name: s.tournament.name })),
  };
}
