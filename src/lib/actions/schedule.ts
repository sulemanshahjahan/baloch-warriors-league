"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MatchStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { atKarachiHour, fromKarachiInputValue } from "@/lib/utils";
import { recomputeStandings } from "@/lib/actions/match";
import { getOrCreateDefaultStageId } from "@/lib/stages";

// Role hierarchy levels
const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  const userRole = getUserRole(session);
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

interface GenerateScheduleOptions {
  tournamentId: string;
  format: "ROUND_ROBIN" | "KNOCKOUT" | "GROUP_KNOCKOUT";
  seedingMethod: "RANDOM" | "MANUAL" | "BY_SKILL";
  groupCount?: number; // For GROUP_KNOCKOUT
  advanceCount?: number; // How many from each group advance
  deadlineMode?: "none" | "per_round" | "global";
  daysPerRound?: number;
  globalDeadline?: string; // ISO date string — when deadlineMode="global", the hard finish deadline for ALL matches
  maxMatchesPerDay?: number; // Auto-date assignment: max matches per player per day (default 2)
  kickoffHour?: number; // Daily kickoff hour in PKT for auto-assigned dates (default 18)
  kickoffMinute?: number; // Daily kickoff minute in PKT (default 0)
}

// ─── HELPERS ─────────────────────────────────────────────────

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoundRobinPairs<T>(teams: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}

/** Append reversed (return-leg) fixtures for a double round-robin. */
function withReturnLegs<T>(pairs: [T, T][], double: boolean): [T, T][] {
  if (!double) return pairs;
  return [...pairs, ...pairs.map(([home, away]) => [away, home] as [T, T])];
}

function generateKnockoutBracket<T>(teams: T[]): [T | null, T | null][] {
  // For knockout, we need power of 2
  const count = teams.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(count)));
  const byes = nextPowerOf2 - count;
  
  const bracket: [T | null, T | null][] = [];
  let teamIdx = 0;
  
  for (let i = 0; i < nextPowerOf2 / 2; i++) {
    const home = teams[teamIdx++] || null;
    const away = (i < byes / 2) ? null : teams[teamIdx++] || null;
    bracket.push([home, away]);
  }
  
  return bracket;
}

// ─── MAIN SCHEDULE GENERATOR ─────────────────────────────────

export async function generateSchedule(options: GenerateScheduleOptions) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const { tournamentId, format, seedingMethod, groupCount = 4, advanceCount = 2, deadlineMode = "none", daysPerRound, globalDeadline, kickoffHour = 18, kickoffMinute = 0 } = options;

  // Hard finish deadline (applied to every match) when using a global deadline.
  const hardDeadline = deadlineMode === "global" && globalDeadline ? fromKarachiInputValue(globalDeadline) : null;

  // Get tournament and participants
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { include: { team: true } },
      players: { include: { player: true } },
    },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };

  const isIndividual = tournament.participantType === "INDIVIDUAL";
  const stageId = await getOrCreateDefaultStageId(tournamentId);

  // Get participants
  let participants: { id: string; name: string; skillLevel?: number | null }[] = isIndividual
    ? tournament.players.map((p) => ({
        id: p.playerId,
        name: p.player.name,
        skillLevel: p.player.skillLevel,
      }))
    : tournament.teams.map((t) => ({
        id: t.teamId,
        name: t.team.name,
      }));

  if (participants.length < 2) {
    return { success: false, error: "Need at least 2 participants" };
  }

  // Apply seeding
  if (seedingMethod === "RANDOM") {
    participants = shuffle(participants);
  } else if (seedingMethod === "BY_SKILL" && isIndividual) {
    participants.sort((a, b) => (b.skillLevel || 50) - (a.skillLevel || 50));
  }
  // MANUAL keeps current order

  // Compute deadline for a given round number
  const computeDeadline = (roundNum: number): Date | null => {
    if (deadlineMode === "global" && globalDeadline) {
      return fromKarachiInputValue(globalDeadline);
    }
    if (deadlineMode === "per_round" && daysPerRound && tournament.startDate) {
      return new Date(tournament.startDate.getTime() + roundNum * daysPerRound * 86400000);
    }
    return null;
  };

  // Delete existing scheduled matches
  await prisma.match.deleteMany({
    where: {
      tournamentId,
      status: "SCHEDULED" as MatchStatus,
    },
  });

  let createdMatches = 0;

  if (format === "ROUND_ROBIN") {
    // Round Robin - everyone plays everyone (twice when doubleRoundRobin)
    const pairs = withReturnLegs(generateRoundRobinPairs(participants), tournament.doubleRoundRobin);
    for (let i = 0; i < pairs.length; i++) {
      const [home, away] = pairs[i];
      const roundNum = Math.floor(i / (participants.length / 2)) + 1;
      if (isIndividual) {
        await prisma.match.create({
          data: {
            tournamentId,
            round: `Round ${roundNum}`,
            roundNumber: roundNum,
            matchNumber: i + 1,
            homePlayerId: home.id,
            awayPlayerId: away.id,
            status: "SCHEDULED" as MatchStatus,
            homeToken: randomUUID(),
            awayToken: randomUUID(),
            deadline: computeDeadline(roundNum),
          },
        });
      } else {
        await prisma.match.create({
          data: {
            tournamentId,
            round: `Round ${roundNum}`,
            roundNumber: roundNum,
            matchNumber: i + 1,
            homeTeamId: home.id,
            awayTeamId: away.id,
            status: "SCHEDULED" as MatchStatus,
            homeToken: randomUUID(),
            awayToken: randomUUID(),
            deadline: computeDeadline(roundNum),
          },
        });
      }
      createdMatches++;
    }
  } else if (format === "KNOCKOUT") {
    // Knockout bracket
    const bracket = generateKnockoutBracket(participants);
    for (let i = 0; i < bracket.length; i++) {
      const [home, away] = bracket[i];
      if (!home) continue;
      
      if (isIndividual) {
        await prisma.match.create({
          data: {
            tournamentId,
            round: "Round of " + (bracket.length * 2),
            roundNumber: 1,
            matchNumber: i + 1,
            homePlayerId: home.id,
            awayPlayerId: away?.id || null,
            status: "SCHEDULED" as MatchStatus,
            homeToken: randomUUID(),
            awayToken: randomUUID(),
            deadline: computeDeadline(1),
          },
        });
      } else {
        await prisma.match.create({
          data: {
            tournamentId,
            round: "Round of " + (bracket.length * 2),
            roundNumber: 1,
            matchNumber: i + 1,
            homeTeamId: home.id,
            awayTeamId: away?.id || null,
            status: "SCHEDULED" as MatchStatus,
            homeToken: randomUUID(),
            awayToken: randomUUID(),
            deadline: computeDeadline(1),
          },
        });
      }
      createdMatches++;
    }
  } else if (format === "GROUP_KNOCKOUT") {
    // For GROUP_KNOCKOUT, use existing groups and their assigned players
    const existingGroups = await prisma.tournamentGroup.findMany({
      where: { tournamentId },
      orderBy: { orderIndex: "asc" },
    });

    // Fetch group assignments separately based on type
    const groupAssignments = isIndividual
      ? await prisma.tournamentPlayer.findMany({
          where: { tournamentId, groupId: { not: null } },
          include: { player: true },
        })
      : await prisma.tournamentTeam.findMany({
          where: { tournamentId, groupId: { not: null } },
          include: { team: true },
        });

    if (existingGroups.length === 0) {
      return { success: false, error: "No groups found. Please create groups and assign players first." };
    }

    // Generate matches for each existing group
    for (const tournamentGroup of existingGroups) {
      // Get participants in this group
      let groupParticipants: { id: string; name: string }[] = [];
      
      if (isIndividual) {
        const playerAssignments = groupAssignments as Array<{
          playerId: string;
          groupId: string | null;
          player: { name: string };
        }>;
        groupParticipants = playerAssignments
          .filter((p) => p.groupId === tournamentGroup.id)
          .map((p) => ({
            id: p.playerId,
            name: p.player.name,
          }));
      } else {
        const teamAssignments = groupAssignments as Array<{
          teamId: string;
          groupId: string | null;
          team: { name: string };
        }>;
        groupParticipants = teamAssignments
          .filter((t) => t.groupId === tournamentGroup.id)
          .map((t) => ({
            id: t.teamId,
            name: t.team.name,
          }));
      }

      if (groupParticipants.length < 2) {
        continue; // Skip groups with less than 2 participants
      }

      // Generate round-robin matches within group (twice when doubleRoundRobin)
      const pairs = withReturnLegs(generateRoundRobinPairs(groupParticipants), tournament.doubleRoundRobin);
      for (let j = 0; j < pairs.length; j++) {
        const [home, away] = pairs[j];
        const groupRoundNum = Math.floor(j / (groupParticipants.length / 2)) + 1;
        if (isIndividual) {
          await prisma.match.create({
            data: {
              tournamentId,
              groupId: tournamentGroup.id,
              round: `${tournamentGroup.name} - Round ${groupRoundNum}`,
              roundNumber: groupRoundNum,
              matchNumber: j + 1,
              homePlayerId: home.id,
              awayPlayerId: away.id,
              status: "SCHEDULED" as MatchStatus,
              deadline: computeDeadline(groupRoundNum),
            },
          });
        } else {
          await prisma.match.create({
            data: {
              tournamentId,
              groupId: tournamentGroup.id,
              round: `${tournamentGroup.name} - Round ${groupRoundNum}`,
              roundNumber: groupRoundNum,
              matchNumber: j + 1,
              homeTeamId: home.id,
              awayTeamId: away.id,
              status: "SCHEDULED" as MatchStatus,
              deadline: computeDeadline(groupRoundNum),
            },
          });
        }
        createdMatches++;
      }
    }
  }

  // Stamp all newly-created fixtures with the tournament's (single) stage.
  await prisma.match.updateMany({ where: { tournamentId, stageId: null }, data: { stageId } });

  // ── Auto-assign dates (1-2 matches per player per day) ──
  if (tournament.startDate && createdMatches > 0) {
    const maxPerDay = options.maxMatchesPerDay ?? 2;

    // Fetch all SCHEDULED matches for this tournament
    const scheduledMatches = await prisma.match.findMany({
      where: { tournamentId, status: "SCHEDULED" as MatchStatus },
      orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
      select: { id: true, homePlayerId: true, awayPlayerId: true, homeTeamId: true, awayTeamId: true },
    });

    // Smart scheduling: greedy slot-filling with rest day preference
    // - Max N matches per player per day
    // - Prefer a gap day after a player's last match (avoid back-to-back)
    const playerDayCount = new Map<string, Map<number, number>>();
    const playerLastDay = new Map<string, number>(); // last assigned day per player

    const getCount = (playerId: string, day: number) =>
      playerDayCount.get(playerId)?.get(day) ?? 0;

    const increment = (playerId: string, day: number) => {
      if (!playerDayCount.has(playerId)) playerDayCount.set(playerId, new Map());
      playerDayCount.get(playerId)!.set(day, getCount(playerId, day) + 1);
      playerLastDay.set(playerId, Math.max(playerLastDay.get(playerId) ?? -1, day));
    };

    const isRestDay = (playerId: string, day: number) => {
      const last = playerLastDay.get(playerId) ?? -99;
      return day - last <= 1; // played yesterday or today already
    };

    const updates: { id: string; scheduledAt: Date; deadline: Date }[] = [];

    for (const m of scheduledMatches) {
      const homeId = m.homePlayerId ?? m.homeTeamId ?? "";
      const awayId = m.awayPlayerId ?? m.awayTeamId ?? "";

      let bestDay = -1;

      // Pass 1: find a day with rest (gap after last match) for both players
      for (let d = 0; d < 365; d++) {
        const homeCount = homeId ? getCount(homeId, d) : 0;
        const awayCount = awayId ? getCount(awayId, d) : 0;
        if (homeCount >= maxPerDay || awayCount >= maxPerDay) continue;

        const homeNeedsRest = homeId ? isRestDay(homeId, d) : false;
        const awayNeedsRest = awayId ? isRestDay(awayId, d) : false;

        if (!homeNeedsRest && !awayNeedsRest) {
          bestDay = d;
          break;
        }
      }

      // Pass 2: if no rest-day slot found, fall back to first available day
      if (bestDay === -1) {
        for (let d = 0; d < 365; d++) {
          const homeCount = homeId ? getCount(homeId, d) : 0;
          const awayCount = awayId ? getCount(awayId, d) : 0;
          if (homeCount < maxPerDay && awayCount < maxPerDay) {
            bestDay = d;
            break;
          }
        }
      }

      if (bestDay >= 0) {
        const dayAnchor = new Date(tournament.startDate!);
        dayAnchor.setUTCDate(dayAnchor.getUTCDate() + bestDay);
        const scheduledAt = atKarachiHour(dayAnchor, kickoffHour, kickoffMinute);

        // Use the hard finish deadline if set, otherwise kickoff + 24h.
        let deadline: Date;
        if (hardDeadline) {
          deadline = hardDeadline;
        } else {
          deadline = new Date(scheduledAt);
          deadline.setHours(deadline.getHours() + 24);
        }

        updates.push({ id: m.id, scheduledAt, deadline });

        if (homeId) increment(homeId, bestDay);
        if (awayId) increment(awayId, bestDay);
      }
    }

    // Batch update all matches with assigned dates
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.match.update({
            where: { id: u.id },
            data: { scheduledAt: u.scheduledAt, deadline: u.deadline },
          })
        )
      );
    }
  }

  // Seed standings (all teams/players at 0) so group + league tables show
  // immediately, before any match is played.
  await recomputeStandings(tournamentId, { stageId });

  const sched = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");
  if (sched?.slug) revalidatePath(`/tournaments/${sched.slug}`);

  return { success: true, count: createdMatches };
}

// ─── KNOCKOUT SEEDING (group → bracket) ───────────────────────
// Standard recursive bracket seed order: slotToSeed[slot] = seed rank (1-based).
// e.g. size 8 → [1,8,4,5,2,7,3,6]; adjacent pairs are the opening-round matches
// and the first half of the slots is the top half of the draw.
function bracketSeedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const len = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(len - s);
    }
    seeds = next;
  }
  return seeds;
}

type SeedQ = { id: string; name: string };
type SeededMatch = {
  home: SeedQ | null;
  away: SeedQ | null;
  roundName: string;
  roundNumber: number;
};

/**
 * Seed the first knockout round from group qualifiers so that:
 *  - every group's 1st- and 2nd-placed players land in OPPOSITE halves of the
 *    bracket (so they can only ever meet in the final), and
 *  - no opening-round match pairs two players from the same group.
 * Group winners take the strongest seeds and are spread across the draw.
 *
 * NOTE: when more than 2 advance per group, the 3rd/4th places cannot all be
 * kept apart (mathematically impossible to separate 3+ same-group teams across
 * only 2 halves) — but the top two are always separated to opposite halves.
 */
function seedKnockoutFirstRound(
  advancingByGroup: { groupName: string; participants: { id: string; name: string; position: number }[] }[],
  firstRoundName: string,
): SeededMatch[] {
  const total = advancingByGroup.reduce((s, g) => s + g.participants.length, 0);
  const size = Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(total, 2)))));
  const half = size / 2;

  const slotToSeed = bracketSeedOrder(size);
  const seedToSlot = new Map<number, number>();
  slotToSeed.forEach((seed, slot) => seedToSlot.set(seed, slot));
  const seedHalf = (seed: number): "T" | "B" => (seedToSlot.get(seed)! < half ? "T" : "B");

  const used = new Set<number>();
  const totalHalf = { T: 0, B: 0 };
  const seedToQ = new Map<number, SeedQ>();
  const seedGroup = new Map<number, number>();
  const groupHalf = advancingByGroup.map(() => ({ T: 0, B: 0 }));
  const winnerSeed: (number | undefined)[] = advancingByGroup.map(() => undefined);

  const bestUnused = (h?: "T" | "B"): number | null => {
    for (let s = 1; s <= size; s++) if (!used.has(s) && (!h || seedHalf(s) === h)) return s;
    return null;
  };
  const place = (gi: number, q: SeedQ, preferred?: "T" | "B"): number => {
    const seed = (preferred ? bestUnused(preferred) : null) ?? bestUnused();
    if (seed == null) throw new Error("knockout seeding overflow");
    used.add(seed);
    seedToQ.set(seed, q);
    seedGroup.set(seed, gi);
    const h = seedHalf(seed);
    totalHalf[h]++;
    groupHalf[gi][h]++;
    return seed;
  };

  // 1) Winners take the best available seeds (standard seeding spreads them).
  advancingByGroup.forEach((g, gi) => {
    const w = g.participants.find((p) => p.position === 1);
    if (w) winnerSeed[gi] = place(gi, { id: w.id, name: w.name });
  });
  // 2) Runners-up go to the OPPOSITE half of their own group's winner.
  advancingByGroup.forEach((g, gi) => {
    const r = g.participants.find((p) => p.position === 2);
    if (!r) return;
    const ws = winnerSeed[gi];
    const opp: "T" | "B" = ws != null && seedHalf(ws) === "T" ? "B" : "T";
    place(gi, { id: r.id, name: r.name }, opp);
  });
  // 3) Remaining places (3rd, 4th, …): spread each group evenly across halves.
  const maxPos = Math.max(0, ...advancingByGroup.flatMap((g) => g.participants.map((p) => p.position)));
  for (let pos = 3; pos <= maxPos; pos++) {
    advancingByGroup.forEach((g, gi) => {
      const q = g.participants.find((p) => p.position === pos);
      if (!q) return;
      const gc = groupHalf[gi];
      const preferred: "T" | "B" =
        gc.T < gc.B ? "T" : gc.B < gc.T ? "B" : totalHalf.T <= totalHalf.B ? "T" : "B";
      place(gi, { id: q.id, name: q.name }, preferred);
    });
  }

  // Build opening-round matches from adjacent slot pairs (top half first).
  type M = { home: SeedQ | null; away: SeedQ | null; hg: number | null; ag: number | null };
  const matches: M[] = [];
  for (let slot = 0; slot < size; slot += 2) {
    const sa = slotToSeed[slot];
    const sb = slotToSeed[slot + 1];
    const qa = seedToQ.get(sa) ?? null;
    const qb = seedToQ.get(sb) ?? null;
    matches.push({ home: qa, away: qb, hg: qa ? seedGroup.get(sa)! : null, ag: qb ? seedGroup.get(sb)! : null });
  }
  // Safety net: repair any same-group opening match by swapping an away player
  // with another match in the SAME half (keeps the halves, so top-2 stay apart).
  const sameHalf = (i: number, k: number) =>
    Math.floor(i / Math.max(1, matches.length / 2)) === Math.floor(k / Math.max(1, matches.length / 2));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.hg == null || m.ag == null || m.hg !== m.ag) continue;
    for (let k = 0; k < matches.length; k++) {
      if (k === i || !sameHalf(i, k)) continue;
      const n = matches[k];
      if (n.ag == null) continue;
      if (m.hg !== n.ag && (n.hg == null || n.hg !== m.ag)) {
        [m.away, n.away] = [n.away, m.away];
        [m.ag, n.ag] = [n.ag, m.ag];
        break;
      }
    }
  }
  return matches.map((m) => ({ home: m.home, away: m.away, roundName: firstRoundName, roundNumber: 1 }));
}

// ─── CREATE KNOCKOUT BRACKET FROM GROUP STANDINGS ─────────────

export async function generateKnockoutFromGroups(
  tournamentId: string,
  advanceCount: number = 2,
  options?: { kickoffHour?: number; kickoffMinute?: number; finalDeadline?: string; gapDays?: number }
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: {
        orderBy: { orderIndex: "asc" },
        include: {
          standings: {
            // Qualifiers by the persisted rank (honours points config + tiebreakers
            // incl. head-to-head). nulls-last keeps un-recomputed rows out of the top.
            orderBy: [{ rank: "asc" }, { id: "asc" }],
            take: advanceCount,
            include: {
              team: true,
              player: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };
  if (tournament.groups.length === 0) {
    return { success: false, error: "No groups found" };
  }

  // Guard: don't seed the knockout until every group-stage match is played,
  // otherwise standings (and therefore qualifiers) are not yet final.
  const pendingGroupMatches = await prisma.match.count({
    where: { tournamentId, groupId: { not: null }, status: { not: "COMPLETED" } },
  });
  if (pendingGroupMatches > 0) {
    return {
      success: false,
      error: `Group stage is not complete — ${pendingGroupMatches} group match(es) still unplayed.`,
    };
  }

  const isIndividual = tournament.participantType === "INDIVIDUAL";
  
  // Collect advancing participants from each group, organized by group
  const advancingByGroup: { 
    groupName: string; 
    participants: { id: string; name: string; position: number }[] 
  }[] = [];
  
  for (const group of tournament.groups) {
    const groupParticipants: { id: string; name: string; position: number }[] = [];
    for (let i = 0; i < group.standings.length; i++) {
      const standing = group.standings[i];
      const participant = isIndividual ? standing.player : standing.team;
      if (participant) {
        groupParticipants.push({
          id: isIndividual ? standing.playerId! : standing.teamId!,
          name: participant.name,
          position: i + 1, // 1st, 2nd, etc.
        });
      }
    }
    if (groupParticipants.length > 0) {
      advancingByGroup.push({
        groupName: group.name,
        participants: groupParticipants,
      });
    }
  }

  const totalAdvancing = advancingByGroup.reduce((sum, g) => sum + g.participants.length, 0);
  if (totalAdvancing < 2) {
    return { success: false, error: "Not enough participants to create knockout" };
  }

  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalAdvancing)));
  const roundCount = Math.log2(bracketSize);
  
  // Round names from earliest to final
  const roundNames: Record<number, string> = {
    1: "Final",
    2: "Semi-finals",
    3: "Quarter-finals",
    4: "Round of 16",
    5: "Round of 32",
  };
  
  const firstRoundName = roundNames[roundCount] || `Round of ${bracketSize}`;
  
  // Build the bracket with proper group-separated seeding: each group's top two
  // qualifiers land in opposite halves (only meet in the final) and no opening
  // match is an intra-group rematch. See seedKnockoutFirstRound above.
  const bracket = seedKnockoutFirstRound(advancingByGroup, firstRoundName);

  // Phase 1: knockout shares the tournament's single stage.
  const koStageId = await getOrCreateDefaultStageId(tournamentId);

  let createdMatches = 0;

  for (const match of bracket) {
    if (!match.home) continue;

    if (isIndividual) {
      await prisma.match.create({
        data: {
          tournamentId,
          stageId: koStageId,
          round: match.roundName,
          roundNumber: match.roundNumber,
          matchNumber: createdMatches + 1,
          homePlayerId: match.home.id,
          awayPlayerId: match.away?.id || null,
          status: "SCHEDULED" as MatchStatus,
          homeToken: randomUUID(),
          awayToken: randomUUID(),
        },
      });
    } else {
      await prisma.match.create({
        data: {
          tournamentId,
          stageId: koStageId,
          round: match.roundName,
          roundNumber: match.roundNumber,
          matchNumber: createdMatches + 1,
          homeTeamId: match.home.id,
          awayTeamId: match.away?.id || null,
          status: "SCHEDULED" as MatchStatus,
          homeToken: randomUUID(),
          awayToken: randomUUID(),
        },
      });
    }
    createdMatches++;
  }

  // Auto-assign dates to knockout matches
  if (tournament.startDate && createdMatches > 0) {
    const kickoffHour = options?.kickoffHour ?? 18;
    const kickoffMinute = options?.kickoffMinute ?? 0;
    const gapDays = options?.gapDays ?? 1;
    const hardDeadline = options?.finalDeadline ? fromKarachiInputValue(options.finalDeadline) : null;

    const koMatches = await prisma.match.findMany({
      where: { tournamentId, status: "SCHEDULED" as MatchStatus, groupId: null },
      orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
      select: { id: true, homePlayerId: true, awayPlayerId: true, homeTeamId: true, awayTeamId: true },
    });

    // Find the latest date from group stage matches to start knockout after
    const lastGroupMatch = await prisma.match.findFirst({
      where: { tournamentId, groupId: { not: null }, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    const koStartDate = lastGroupMatch?.completedAt
      ? new Date(Math.max(lastGroupMatch.completedAt.getTime(), tournament.startDate.getTime()))
      : tournament.startDate;
    // Gap (days) after group stage before knockout starts
    koStartDate.setDate(koStartDate.getDate() + gapDays);

    const koUpdates: { id: string; scheduledAt: Date; deadline: Date }[] = [];
    let dayOffset = 0;

    for (const m of koMatches) {
      const dayAnchor = new Date(koStartDate);
      dayAnchor.setUTCDate(dayAnchor.getUTCDate() + dayOffset);
      const scheduledAt = atKarachiHour(dayAnchor, kickoffHour, kickoffMinute);

      // Use the hard finish deadline if set, otherwise kickoff + 24h.
      let deadline: Date;
      if (hardDeadline) {
        deadline = hardDeadline;
      } else {
        deadline = new Date(scheduledAt);
        deadline.setHours(deadline.getHours() + 24);
      }

      koUpdates.push({ id: m.id, scheduledAt, deadline });
      // For RO16: 2 matches per day
      if ((koUpdates.length % 2) === 0) dayOffset++;
    }

    if (koUpdates.length > 0) {
      await prisma.$transaction(
        koUpdates.map((u) =>
          prisma.match.update({
            where: { id: u.id },
            data: { scheduledAt: u.scheduledAt, deadline: u.deadline },
          })
        )
      );
    }
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");

  return { success: true, count: createdMatches, advancing: totalAdvancing };
}

// ─── DELETE SCHEDULE ───────────────────────────────────────

export async function deleteTournamentSchedule(tournamentId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const result = await prisma.match.deleteMany({
    where: {
      tournamentId,
      status: "SCHEDULED" as MatchStatus,
    },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");

  return { success: true, count: result.count };
}

// ─── GROUP MANAGEMENT ────────────────────────────────────────

export async function createGroup(tournamentId: string, name: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const count = await prisma.tournamentGroup.count({ where: { tournamentId } });
  const stageId = await getOrCreateDefaultStageId(tournamentId);

  const group = await prisma.tournamentGroup.create({
    data: {
      tournamentId,
      stageId,
      name: name || `Group ${String.fromCharCode(65 + count)}`,
      orderIndex: count,
    },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  return { success: true, data: group };
}

export async function deleteGroup(groupId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const group = await prisma.tournamentGroup.findUnique({
    where: { id: groupId },
    select: { tournamentId: true },
  });

  if (!group) return { success: false, error: "Group not found" };

  await prisma.tournamentGroup.delete({ where: { id: groupId } });

  revalidatePath(`/admin/tournaments/${group.tournamentId}`);
  return { success: true };
}

export async function assignTeamToGroup(tournamentTeamId: string, groupId: string | null) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const updated = await prisma.tournamentTeam.update({
    where: { id: tournamentTeamId },
    data: { groupId },
    select: { tournamentId: true, tournament: { select: { slug: true } } },
  });

  await recomputeStandings(updated.tournamentId, { stageId: await getOrCreateDefaultStageId(updated.tournamentId) });
  revalidatePath(`/admin/tournaments/${updated.tournamentId}`);
  if (updated.tournament?.slug) revalidatePath(`/tournaments/${updated.tournament.slug}`);
  return { success: true };
}

export async function assignPlayerToGroup(tournamentPlayerId: string, groupId: string | null) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
    where: { id: tournamentPlayerId },
    select: { tournamentId: true, tournament: { select: { slug: true } } },
  });

  await prisma.tournamentPlayer.update({
    where: { id: tournamentPlayerId },
    data: { groupId },
  });

  if (tournamentPlayer) {
    await recomputeStandings(tournamentPlayer.tournamentId, { stageId: await getOrCreateDefaultStageId(tournamentPlayer.tournamentId) });
    revalidatePath(`/admin/tournaments/${tournamentPlayer.tournamentId}`);
    if (tournamentPlayer.tournament?.slug) revalidatePath(`/tournaments/${tournamentPlayer.tournament.slug}`);
  }
  return { success: true };
}

export async function bulkAssignPlayersToGroups(
  assignments: Array<{ tournamentPlayerId: string; groupId: string }>
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

  let tournamentId: string | null = null;

  for (const { tournamentPlayerId, groupId } of assignments) {
    const tp = await prisma.tournamentPlayer.update({
      where: { id: tournamentPlayerId },
      data: { groupId },
      select: { tournamentId: true },
    });
    if (!tournamentId) tournamentId = tp.tournamentId;
  }

  if (tournamentId) {
    await recomputeStandings(tournamentId, { stageId: await getOrCreateDefaultStageId(tournamentId) });
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    if (t?.slug) revalidatePath(`/tournaments/${t.slug}`);
    revalidatePath("/tournaments");

    // Notify about the draw
    import("@/lib/push").then(({ notify }) =>
      notify({
        title: "Group Draw Complete!",
        body: `${assignments.length} players have been drawn into groups`,
        url: t?.slug ? `/tournaments/${t.slug}` : "/tournaments",
        tag: `draw-${tournamentId}`,
      })
    ).catch(() => {});
  }

  return { success: true, data: { count: assignments.length } };
}

/** Bulk-assign duo (team) enrollments to groups — used by the 2v2 animated draw. */
export async function bulkAssignTeamsToGroups(
  assignments: Array<{ tournamentTeamId: string; groupId: string }>
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

  let tournamentId: string | null = null;

  for (const { tournamentTeamId, groupId } of assignments) {
    const tt = await prisma.tournamentTeam.update({
      where: { id: tournamentTeamId },
      data: { groupId },
      select: { tournamentId: true },
    });
    if (!tournamentId) tournamentId = tt.tournamentId;
  }

  if (tournamentId) {
    await recomputeStandings(tournamentId, { stageId: await getOrCreateDefaultStageId(tournamentId) });
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    if (t?.slug) revalidatePath(`/tournaments/${t.slug}`);
    revalidatePath("/tournaments");

    import("@/lib/push").then(({ notify }) =>
      notify({
        title: "Group Draw Complete!",
        body: `${assignments.length} duos have been drawn into groups`,
        url: t?.slug ? `/tournaments/${t.slug}` : "/tournaments",
        tag: `draw-${tournamentId}`,
      })
    ).catch(() => {});
  }

  return { success: true, data: { count: assignments.length } };
}

// ─── RANDOM DRAW FOR GROUPS ──────────────────────────────────

interface RandomDrawOptions {
  tournamentId: string;
  method: "RANDOM" | "SNAKE" | "BY_SKILL";
}

export async function randomDrawToGroups(options: RandomDrawOptions) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const { tournamentId, method } = options;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: { orderBy: { orderIndex: "asc" } },
      teams: { include: { team: true } },
      players: { include: { player: true } },
    },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };
  if (tournament.groups.length === 0) return { success: false, error: "No groups created" };

  const isIndividual = tournament.participantType === "INDIVIDUAL";
  const groups = tournament.groups;
  
  // Get unassigned participants
  let participants: Array<{ id: string; name: string; tournamentId: string; skillLevel?: number | null }>;
  
  if (isIndividual) {
    participants = tournament.players
      .filter((tp) => !tp.groupId)
      .map((tp) => ({
        id: tp.id,
        name: tp.player.name,
        tournamentId: tp.id,
        skillLevel: tp.player.skillLevel,
      }));
  } else {
    participants = tournament.teams
      .filter((tt) => !tt.groupId)
      .map((tt) => ({
        id: tt.id,
        name: tt.team.name,
        tournamentId: tt.id,
      }));
  }

  if (participants.length === 0) {
    return { success: false, error: "All participants are already assigned to groups" };
  }

  // Apply seeding method
  if (method === "RANDOM") {
    participants = shuffle(participants);
  } else if (method === "BY_SKILL" && isIndividual) {
    participants.sort((a, b) => (b.skillLevel || 50) - (a.skillLevel || 50));
  }
  // SNAKE keeps current order for snake draft

  // Distribute participants to groups
  const assignments: { groupId: string; participantId: string; name: string }[] = [];
  
  if (method === "SNAKE") {
    // Snake draft: 1,2,3,4 then 4,3,2,1 then 1,2,3,4 etc.
    let reverse = false;
    let groupIndex = 0;
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const group = groups[reverse ? groups.length - 1 - groupIndex : groupIndex];
      
      assignments.push({
        groupId: group.id,
        participantId: participant.tournamentId,
        name: participant.name,
      });

      if (reverse) {
        groupIndex++;
        if (groupIndex >= groups.length) {
          groupIndex = 0;
          reverse = false;
        }
      } else {
        groupIndex++;
        if (groupIndex >= groups.length) {
          groupIndex = 0;
          reverse = true;
        }
      }
    }
  } else {
    // Round-robin distribution
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const group = groups[i % groups.length];
      
      assignments.push({
        groupId: group.id,
        participantId: participant.tournamentId,
        name: participant.name,
      });
    }
  }

  // Apply assignments
  for (const assignment of assignments) {
    if (isIndividual) {
      await prisma.tournamentPlayer.update({
        where: { id: assignment.participantId },
        data: { groupId: assignment.groupId },
      });
    } else {
      await prisma.tournamentTeam.update({
        where: { id: assignment.participantId },
        data: { groupId: assignment.groupId },
      });
    }
  }

  await recomputeStandings(tournamentId);
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  if (tournament.slug) revalidatePath(`/tournaments/${tournament.slug}`);

  return {
    success: true,
    count: assignments.length,
    assignments: assignments.map((a) => a.name),
  };
}

// ─── PUBG BATTLE ROYALE MATCHES ──────────────────────────────

interface PUBGMatchOptions {
  tournamentId: string;
  matchCount: number;
  pointsPerKill: number;
  placementPoints: { placement: number; points: number }[];
}

export async function createPUBGMatches(options: PUBGMatchOptions) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const { tournamentId, matchCount, pointsPerKill, placementPoints } = options;

  // Get tournament and participants
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { include: { team: true } },
      players: { include: { player: true } },
    },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };
  if (tournament.gameCategory !== "PUBG") {
    return { success: false, error: "This function is only for PUBG tournaments" };
  }

  const isIndividual = tournament.participantType === "INDIVIDUAL";
  
  // Get participants
  const participants = isIndividual
    ? tournament.players.map((p) => ({ id: p.playerId, name: p.player.name }))
    : tournament.teams.map((t) => ({ id: t.teamId, name: t.team.name }));

  if (participants.length < 2) {
    return { success: false, error: "Need at least 2 participants" };
  }

  // Delete existing scheduled matches
  await prisma.match.deleteMany({
    where: {
      tournamentId,
      status: "SCHEDULED" as MatchStatus,
    },
  });

  // Create PUBG matches - all participants in each match
  const createdMatches = [];
  const pubgStageId = await getOrCreateDefaultStageId(tournamentId);

  for (let i = 1; i <= matchCount; i++) {
    // Create the match
    const match = await prisma.match.create({
      data: {
        tournamentId,
        stageId: pubgStageId,
        round: `Match ${i}`,
        roundNumber: i,
        matchNumber: i,
        status: "SCHEDULED" as MatchStatus,
        homeToken: randomUUID(),
        awayToken: randomUUID(),
        // Store PUBG scoring config in notes field as JSON
        notes: JSON.stringify({
          type: "PUBG",
          pointsPerKill,
          placementPoints,
        }),
      },
    });

    // Create MatchParticipant records for all participants
    // Initially all have null scores (to be filled after match is played)
    for (const participant of participants) {
      await prisma.matchParticipant.create({
        data: {
          matchId: match.id,
          teamId: isIndividual ? null : participant.id,
          playerId: isIndividual ? participant.id : null,
          placement: null,
          score: 0, // Will be calculated: placementPoints + (kills * pointsPerKill)
        },
      });
    }

    createdMatches.push(match);
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");

  return {
    success: true,
    count: createdMatches.length,
  };
}

// ─── ADD LATE PLAYER/TEAM TO GROUP ──────────────────────────────
//
// Enrolls a player (or team) into a group mid-tournament and generates
// only the missing matches against existing group members.
// Does NOT touch any existing matches, results, or fixtures.

export async function addLatePlayerToGroup(
  tournamentId: string,
  playerId: string,
  groupId: string
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, slug: true, participantType: true, format: true },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };
  if (tournament.format !== "GROUP_KNOCKOUT") {
    return { success: false, error: "Late additions only supported for Group + Knockout format" };
  }

  const group = await prisma.tournamentGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, tournamentId: true, stageId: true },
  });
  if (!group || group.tournamentId !== tournamentId) {
    return { success: false, error: "Group not found in this tournament" };
  }

  const lateStageId = group.stageId ?? (await getOrCreateDefaultStageId(tournamentId));
  const isIndividual = tournament.participantType === "INDIVIDUAL";

  if (isIndividual) {
    // Enroll if not already enrolled
    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
    });

    if (existing) {
      // Already enrolled — just assign to group if not already
      if (existing.groupId === groupId) {
        return { success: false, error: "Player is already in this group" };
      }
      await prisma.tournamentPlayer.update({
        where: { id: existing.id },
        data: { groupId },
      });
    } else {
      // Enroll and assign to group in one step
      await prisma.tournamentPlayer.create({
        data: { tournamentId, playerId, groupId },
      });
    }

    // Find all other players in this group
    const groupMembers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId, groupId, playerId: { not: playerId } },
      select: { playerId: true, player: { select: { name: true } } },
    });

    // Find existing matches for this player in this group (avoid duplicates)
    const existingMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        groupId,
        OR: [
          { homePlayerId: playerId },
          { awayPlayerId: playerId },
        ],
      },
      select: { homePlayerId: true, awayPlayerId: true },
    });

    const alreadyScheduled = new Set(
      existingMatches.map((m) =>
        m.homePlayerId === playerId ? m.awayPlayerId : m.homePlayerId
      )
    );

    // Create only the missing matches
    const newOpponents = groupMembers.filter(
      (m) => !alreadyScheduled.has(m.playerId)
    );

    if (newOpponents.length === 0) {
      return { success: true, data: undefined, message: "Player added to group. All matches already exist." };
    }

    // Get highest existing match number in this group for numbering
    const lastMatch = await prisma.match.findFirst({
      where: { tournamentId, groupId },
      orderBy: { matchNumber: "desc" },
      select: { matchNumber: true },
    });
    let nextMatchNum = (lastMatch?.matchNumber ?? 0) + 1;

    for (const opponent of newOpponents) {
      await prisma.match.create({
        data: {
          tournamentId,
          stageId: lateStageId,
          groupId,
          round: `${group.name} - Late`,
          roundNumber: 99, // high number so they sort at end
          matchNumber: nextMatchNum++,
          homePlayerId: playerId,
          awayPlayerId: opponent.playerId,
          status: "SCHEDULED" as MatchStatus,
          homeToken: randomUUID(),
          awayToken: randomUUID(),
        },
      });
    }

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournament.slug}`);
    revalidatePath("/admin/matches");

    return {
      success: true,
      data: undefined,
      message: `Player added to ${group.name}. Created ${newOpponents.length} new match(es).`,
    };
  } else {
    // Team-based late addition
    const existing = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_teamId: { tournamentId, teamId: playerId } },
    });

    if (existing) {
      if (existing.groupId === groupId) {
        return { success: false, error: "Team is already in this group" };
      }
      await prisma.tournamentTeam.update({
        where: { id: existing.id },
        data: { groupId },
      });
    } else {
      await prisma.tournamentTeam.create({
        data: { tournamentId, teamId: playerId, groupId },
      });
    }

    const groupMembers = await prisma.tournamentTeam.findMany({
      where: { tournamentId, groupId, teamId: { not: playerId } },
      select: { teamId: true },
    });

    const existingMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        groupId,
        OR: [
          { homeTeamId: playerId },
          { awayTeamId: playerId },
        ],
      },
      select: { homeTeamId: true, awayTeamId: true },
    });

    const alreadyScheduled = new Set(
      existingMatches.map((m) =>
        m.homeTeamId === playerId ? m.awayTeamId : m.homeTeamId
      )
    );

    const newOpponents = groupMembers.filter(
      (m) => !alreadyScheduled.has(m.teamId)
    );

    if (newOpponents.length === 0) {
      return { success: true, data: undefined, message: "Team added to group. All matches already exist." };
    }

    const lastMatch = await prisma.match.findFirst({
      where: { tournamentId, groupId },
      orderBy: { matchNumber: "desc" },
      select: { matchNumber: true },
    });
    let nextMatchNum = (lastMatch?.matchNumber ?? 0) + 1;

    for (const opponent of newOpponents) {
      await prisma.match.create({
        data: {
          tournamentId,
          stageId: lateStageId,
          groupId,
          round: `${group.name} - Late`,
          roundNumber: 99,
          matchNumber: nextMatchNum++,
          homeTeamId: playerId,
          awayTeamId: opponent.teamId,
          status: "SCHEDULED" as MatchStatus,
          homeToken: randomUUID(),
          awayToken: randomUUID(),
        },
      });
    }

    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournament.slug}`);
    revalidatePath("/admin/matches");

    return {
      success: true,
      data: undefined,
      message: `Team added to ${group.name}. Created ${newOpponents.length} new match(es).`,
    };
  }
}
