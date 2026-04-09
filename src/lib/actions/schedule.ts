"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MatchStatus } from "@prisma/client";

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

  const { tournamentId, format, seedingMethod, groupCount = 4, advanceCount = 2 } = options;

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

  // Delete existing scheduled matches
  await prisma.match.deleteMany({
    where: {
      tournamentId,
      status: "SCHEDULED" as MatchStatus,
    },
  });

  let createdMatches = 0;

  if (format === "ROUND_ROBIN") {
    // Round Robin - everyone plays everyone
    const pairs = generateRoundRobinPairs(participants);
    for (let i = 0; i < pairs.length; i++) {
      const [home, away] = pairs[i];
      if (isIndividual) {
        await prisma.match.create({
          data: {
            tournamentId,
            round: `Round ${Math.floor(i / (participants.length / 2)) + 1}`,
            roundNumber: Math.floor(i / (participants.length / 2)) + 1,
            matchNumber: i + 1,
            homePlayerId: home.id,
            awayPlayerId: away.id,
            status: "SCHEDULED" as MatchStatus,
          },
        });
      } else {
        await prisma.match.create({
          data: {
            tournamentId,
            round: `Round ${Math.floor(i / (participants.length / 2)) + 1}`,
            roundNumber: Math.floor(i / (participants.length / 2)) + 1,
            matchNumber: i + 1,
            homeTeamId: home.id,
            awayTeamId: away.id,
            status: "SCHEDULED" as MatchStatus,
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

      // Generate round-robin matches within group
      const pairs = generateRoundRobinPairs(groupParticipants);
      for (let j = 0; j < pairs.length; j++) {
        const [home, away] = pairs[j];
        if (isIndividual) {
          await prisma.match.create({
            data: {
              tournamentId,
              groupId: tournamentGroup.id,
              round: `${tournamentGroup.name} - Round ${Math.floor(j / (groupParticipants.length / 2)) + 1}`,
              roundNumber: Math.floor(j / (groupParticipants.length / 2)) + 1,
              matchNumber: j + 1,
              homePlayerId: home.id,
              awayPlayerId: away.id,
              status: "SCHEDULED" as MatchStatus,
            },
          });
        } else {
          await prisma.match.create({
            data: {
              tournamentId,
              groupId: tournamentGroup.id,
              round: `${tournamentGroup.name} - Round ${Math.floor(j / (groupParticipants.length / 2)) + 1}`,
              roundNumber: Math.floor(j / (groupParticipants.length / 2)) + 1,
              matchNumber: j + 1,
              homeTeamId: home.id,
              awayTeamId: away.id,
              status: "SCHEDULED" as MatchStatus,
            },
          });
        }
        createdMatches++;
      }
    }
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");
  
  return { success: true, count: createdMatches };
}

// ─── CREATE KNOCKOUT BRACKET FROM GROUP STANDINGS ─────────────

export async function generateKnockoutFromGroups(
  tournamentId: string,
  advanceCount: number = 2
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
            orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
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
  
  // Build bracket with proper cross-group seeding
  // Standard format: Group A 1st vs Group B 2nd, Group B 1st vs Group A 2nd, etc.
  const bracket: { 
    home: { id: string; name: string } | null; 
    away: { id: string; name: string } | null;
    roundName: string;
    roundNumber: number;
  }[] = [];

  const groupCount = advancingByGroup.length;
  
  // For 2 groups with 2 advancing each (4 teams) - Semi-finals
  // Match 1: Group A 1st vs Group B 2nd
  // Match 2: Group B 1st vs Group A 2nd
  
  // For 4 groups with 2 advancing each (8 teams) - Quarter-finals
  // Match 1: Group A 1st vs Group B 2nd
  // Match 2: Group C 1st vs Group D 2nd
  // Match 3: Group B 1st vs Group A 2nd
  // Match 4: Group D 1st vs Group C 2nd
  
  // Create proper cross-group pairings
  for (let i = 0; i < groupCount; i++) {
    const groupA = advancingByGroup[i];
    const groupB = advancingByGroup[groupCount - 1 - i]; // Opposite group
    
    if (!groupA || !groupB) continue;
    
    const groupA1st = groupA.participants.find(p => p.position === 1);
    const groupA2nd = groupA.participants.find(p => p.position === 2);
    const groupB1st = groupB.participants.find(p => p.position === 1);
    const groupB2nd = groupB.participants.find(p => p.position === 2);
    
    // Cross pairing: Group X 1st vs Group Y 2nd
    if (groupA1st && groupB2nd) {
      bracket.push({
        home: { id: groupA1st.id, name: groupA1st.name },
        away: { id: groupB2nd.id, name: groupB2nd.name },
        roundName: firstRoundName,
        roundNumber: 1,
      });
    } else if (groupA1st) {
      // Bye for A1st
      bracket.push({
        home: { id: groupA1st.id, name: groupA1st.name },
        away: null,
        roundName: firstRoundName,
        roundNumber: 1,
      });
    }
  }

  // Handle odd numbers or missing pairings by filling remaining slots
  let createdMatches = 0;

  for (const match of bracket) {
    if (!match.home) continue;

    if (isIndividual) {
      await prisma.match.create({
        data: {
          tournamentId,
          round: match.roundName,
          roundNumber: match.roundNumber,
          matchNumber: createdMatches + 1,
          homePlayerId: match.home.id,
          awayPlayerId: match.away?.id || null,
          status: "SCHEDULED" as MatchStatus,
        },
      });
    } else {
      await prisma.match.create({
        data: {
          tournamentId,
          round: match.roundName,
          roundNumber: match.roundNumber,
          matchNumber: createdMatches + 1,
          homeTeamId: match.home.id,
          awayTeamId: match.away?.id || null,
          status: "SCHEDULED" as MatchStatus,
        },
      });
    }
    createdMatches++;
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
  
  const group = await prisma.tournamentGroup.create({
    data: {
      tournamentId,
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

  await prisma.tournamentTeam.update({
    where: { id: tournamentTeamId },
    data: { groupId },
  });

  revalidatePath(`/admin/tournaments/${(await prisma.tournamentTeam.findUnique({ where: { id: tournamentTeamId }, select: { tournamentId: true } }))?.tournamentId}`);
  return { success: true };
}

export async function assignPlayerToGroup(tournamentPlayerId: string, groupId: string | null) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
    where: { id: tournamentPlayerId },
    select: { tournamentId: true },
  });

  await prisma.tournamentPlayer.update({
    where: { id: tournamentPlayerId },
    data: { groupId },
  });

  if (tournamentPlayer) {
    revalidatePath(`/admin/tournaments/${tournamentPlayer.tournamentId}`);
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

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  
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
  
  for (let i = 1; i <= matchCount; i++) {
    // Create the match
    const match = await prisma.match.create({
      data: {
        tournamentId,
        round: `Match ${i}`,
        roundNumber: i,
        matchNumber: i,
        status: "SCHEDULED" as MatchStatus,
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
