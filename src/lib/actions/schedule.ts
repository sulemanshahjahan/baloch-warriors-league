"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MatchStatus } from "@prisma/client";

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

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      groups: {
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
  
  // Collect advancing participants from each group
  const advancing: { id: string; name: string; groupName: string; position: number }[] = [];
  
  for (const group of tournament.groups) {
    for (let i = 0; i < group.standings.length; i++) {
      const standing = group.standings[i];
      const participant = isIndividual ? standing.player : standing.team;
      if (participant) {
        advancing.push({
          id: isIndividual ? standing.playerId! : standing.teamId!,
          name: participant.name,
          groupName: group.name,
          position: i + 1, // 1st, 2nd, etc.
        });
      }
    }
  }

  if (advancing.length < 2) {
    return { success: false, error: "Not enough participants to create knockout" };
  }

  // Create knockout bracket
  const bracket = generateKnockoutBracket(advancing);
  let createdMatches = 0;

  for (let i = 0; i < bracket.length; i++) {
    const [home, away] = bracket[i];
    if (!home) continue;

    if (isIndividual) {
      await prisma.match.create({
        data: {
          tournamentId,
          round: "Knockout Stage",
          roundNumber: 100, // Higher than group stage
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
          round: "Knockout Stage",
          roundNumber: 100,
          matchNumber: i + 1,
          homeTeamId: home.id,
          awayTeamId: away?.id || null,
          status: "SCHEDULED" as MatchStatus,
        },
      });
    }
    createdMatches++;
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/admin/matches");

  return { success: true, count: createdMatches, advancing: advancing.length };
}

// ─── DELETE SCHEDULE ───────────────────────────────────────

export async function deleteTournamentSchedule(tournamentId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

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

// ─── RANDOM DRAW FOR GROUPS ──────────────────────────────────

interface RandomDrawOptions {
  tournamentId: string;
  method: "RANDOM" | "SNAKE" | "BY_SKILL";
}

export async function randomDrawToGroups(options: RandomDrawOptions) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

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
