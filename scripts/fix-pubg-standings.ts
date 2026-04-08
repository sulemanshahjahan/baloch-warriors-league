/**
 * One-time script to recompute all PUBG tournament standings
 * with kills and chicken dinner tracking.
 *
 * Run: npx tsx scripts/fix-pubg-standings.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all PUBG tournaments
  const pubgTournaments = await prisma.tournament.findMany({
    where: { gameCategory: "PUBG" },
    select: { id: true, name: true, participantType: true },
  });

  console.log(`Found ${pubgTournaments.length} PUBG tournament(s)`);

  for (const tournament of pubgTournaments) {
    console.log(`\nRecomputing: ${tournament.name} (${tournament.id})`);

    // Get all completed matches with participants
    const matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id, status: "COMPLETED" },
      select: {
        id: true,
        notes: true,
        participants: {
          select: { id: true, playerId: true, teamId: true, placement: true, score: true },
        },
      },
    });

    console.log(`  ${matches.length} completed match(es)`);

    // Get enrolled participants
    const isIndividual = tournament.participantType === "INDIVIDUAL";
    const enrolled = isIndividual
      ? await prisma.tournamentPlayer.findMany({
          where: { tournamentId: tournament.id },
          select: { playerId: true },
        })
      : await prisma.tournamentTeam.findMany({
          where: { tournamentId: tournament.id },
          select: { teamId: true },
        });

    // Initialize stats
    const stats: Record<string, { played: number; points: number; kills: number; dinners: number }> = {};
    for (const e of enrolled) {
      const pid = isIndividual ? (e as any).playerId : (e as any).teamId;
      stats[pid] = { played: 0, points: 0, kills: 0, dinners: 0 };
    }

    // Process each match
    for (const match of matches) {
      let ppk = 1;
      let placementPts: { placement: number; points: number }[] = [];
      try {
        const cfg = JSON.parse(match.notes || "{}");
        ppk = cfg.pointsPerKill || 1;
        placementPts = cfg.placementPoints || [];
      } catch { /* defaults */ }

      const getPlacePts = (pl: number) =>
        placementPts.find((p) => p.placement === pl)?.points ?? 0;

      for (const p of match.participants) {
        const pid = isIndividual ? p.playerId : p.teamId;
        if (!pid) continue;
        if (!stats[pid]) stats[pid] = { played: 0, points: 0, kills: 0, dinners: 0 };

        const placePts = getPlacePts(p.placement ?? 99);
        const kills = Math.max(0, Math.round(((p.score ?? 0) - placePts) / ppk));

        stats[pid].played++;
        stats[pid].points += p.score ?? 0;
        stats[pid].kills += kills;
        if (p.placement === 1) stats[pid].dinners++;
      }
    }

    // Delete and recreate standings
    await prisma.standing.deleteMany({ where: { tournamentId: tournament.id } });

    let created = 0;
    for (const [pid, s] of Object.entries(stats)) {
      const data = isIndividual
        ? { tournamentId: tournament.id, playerId: pid }
        : { tournamentId: tournament.id, teamId: pid };

      await prisma.standing.create({
        data: {
          ...data,
          played: s.played,
          points: s.points,
          goalsFor: s.kills,    // kills stored in goalsFor
          won: s.dinners,       // chicken dinners stored in won
          drawn: 0,
          lost: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          cleanSheets: 0,
        },
      });
      created++;
    }

    console.log(`  Created ${created} standing(s) with kills & dinners`);
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
