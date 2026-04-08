import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

function randScore() {
  return Math.floor(Math.random() * 5);
}

function noDrawScore(): [number, number] {
  const h = Math.floor(Math.random() * 5) + 1;
  let a = Math.floor(Math.random() * 5);
  if (a === h) a = h > 1 ? h - 1 : h + 1;
  return [h, a];
}

async function main() {
  const season = await p.season.findFirst({ where: { isActive: true } });
  const allPlayers = await p.player.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 16,
  });
  console.log(`Using ${allPlayers.length} players`);

  // Create tournament
  const t = await p.tournament.create({
    data: {
      name: "Dummy League",
      slug: "dummy-league",
      description: "Demo eFootball league — 4 groups, quarter-finals, semi-finals, final.",
      gameCategory: "EFOOTBALL",
      format: "GROUP_KNOCKOUT",
      participantType: "INDIVIDUAL",
      status: "ACTIVE",
      seasonId: season?.id || null,
      isFeatured: true,
    },
  });
  console.log(`Tournament: ${t.id}`);

  // Create 4 groups
  const groupNames = ["Group A", "Group B", "Group C", "Group D"];
  const groups = [];
  for (let i = 0; i < 4; i++) {
    const g = await p.tournamentGroup.create({
      data: { tournamentId: t.id, name: groupNames[i], orderIndex: i },
    });
    groups.push(g);
  }

  // Enroll players (4 per group)
  for (let i = 0; i < 16; i++) {
    await p.tournamentPlayer.create({
      data: {
        tournamentId: t.id,
        playerId: allPlayers[i].id,
        groupId: groups[Math.floor(i / 4)].id,
      },
    });
  }
  console.log("Enrolled 16 players into 4 groups");

  // ── Group stage matches (round-robin, 6 per group = 24 total) ──
  let globalMatchNum = 0;
  for (let g = 0; g < 4; g++) {
    const gp = allPlayers.slice(g * 4, g * 4 + 4);
    let round = 1;
    for (let i = 0; i < gp.length; i++) {
      for (let j = i + 1; j < gp.length; j++) {
        globalMatchNum++;
        const hs = randScore();
        const as = randScore();
        await p.match.create({
          data: {
            tournamentId: t.id,
            groupId: groups[g].id,
            round: `${groupNames[g]} - Round ${round}`,
            roundNumber: round,
            matchNumber: globalMatchNum,
            homePlayerId: gp[i].id,
            awayPlayerId: gp[j].id,
            homeScore: hs,
            awayScore: as,
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
        round++;
      }
    }
  }
  console.log(`Created ${globalMatchNum} group matches`);

  // ── Compute standings ──
  interface Stats {
    played: number; won: number; drawn: number; lost: number;
    gf: number; ga: number; pts: number;
  }

  for (let g = 0; g < 4; g++) {
    const gp = allPlayers.slice(g * 4, g * 4 + 4);
    const stats: Record<string, Stats> = {};
    for (const pl of gp) {
      stats[pl.id] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
    }

    const matches = await p.match.findMany({
      where: { tournamentId: t.id, groupId: groups[g].id, status: "COMPLETED" },
      select: { homePlayerId: true, awayPlayerId: true, homeScore: true, awayScore: true },
    });

    for (const m of matches) {
      const h = m.homePlayerId!, a = m.awayPlayerId!;
      const hs = m.homeScore ?? 0, as_ = m.awayScore ?? 0;
      stats[h].played++; stats[a].played++;
      stats[h].gf += hs; stats[h].ga += as_;
      stats[a].gf += as_; stats[a].ga += hs;
      if (hs > as_) { stats[h].won++; stats[h].pts += 3; stats[a].lost++; }
      else if (as_ > hs) { stats[a].won++; stats[a].pts += 3; stats[h].lost++; }
      else { stats[h].drawn++; stats[a].drawn++; stats[h].pts++; stats[a].pts++; }
    }

    const sorted = Object.entries(stats)
      .sort(([, a], [, b]) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

    for (const [pid, s] of sorted) {
      // Group standing
      await p.standing.create({
        data: {
          tournamentId: t.id, groupId: groups[g].id, playerId: pid,
          played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
          goalsFor: s.gf, goalsAgainst: s.ga, goalDiff: s.gf - s.ga, points: s.pts,
        },
      });
      // Overall standing
      await p.standing.create({
        data: {
          tournamentId: t.id, playerId: pid,
          played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
          goalsFor: s.gf, goalsAgainst: s.ga, goalDiff: s.gf - s.ga, points: s.pts,
        },
      });
    }

    console.log(`  ${groupNames[g]}: ${sorted.map(([pid]) => gp.find(p => p.id === pid)?.name).join(", ")}`);
  }

  // ── Get top 2 from each group ──
  const advancing: { id: string; name: string }[] = [];
  for (let g = 0; g < 4; g++) {
    const top2 = await p.standing.findMany({
      where: { tournamentId: t.id, groupId: groups[g].id },
      orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
      take: 2,
      include: { player: { select: { name: true } } },
    });
    for (const s of top2) advancing.push({ id: s.playerId!, name: s.player!.name });
  }
  console.log(`\nAdvancing to QF: ${advancing.map(p => p.name).join(", ")}`);

  // ── Quarter-finals (A1 vs D2, B1 vs C2, C1 vs B2, D1 vs A2) ──
  const qfPairings = [
    [advancing[0], advancing[7]], // A1 vs D2
    [advancing[2], advancing[5]], // B1 vs C2
    [advancing[4], advancing[3]], // C1 vs B2
    [advancing[6], advancing[1]], // D1 vs A2
  ];

  const qfWinners: { id: string; name: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const [home, away] = qfPairings[i];
    const [hs, as] = noDrawScore();
    await p.match.create({
      data: {
        tournamentId: t.id,
        round: "Quarter-finals",
        roundNumber: 1,
        matchNumber: i + 1,
        homePlayerId: home.id,
        awayPlayerId: away.id,
        homeScore: hs,
        awayScore: as,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const winner = hs > as ? home : away;
    qfWinners.push(winner);
    console.log(`  QF${i + 1}: ${home.name} ${hs}-${as} ${away.name} → ${winner.name}`);
  }

  // ── Semi-finals ──
  const sfWinners: { id: string; name: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const home = qfWinners[i * 2];
    const away = qfWinners[i * 2 + 1];
    const [hs, as] = noDrawScore();
    await p.match.create({
      data: {
        tournamentId: t.id,
        round: "Semi-finals",
        roundNumber: 2,
        matchNumber: i + 1,
        homePlayerId: home.id,
        awayPlayerId: away.id,
        homeScore: hs,
        awayScore: as,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const winner = hs > as ? home : away;
    sfWinners.push(winner);
    console.log(`  SF${i + 1}: ${home.name} ${hs}-${as} ${away.name} → ${winner.name}`);
  }

  // ── Final ──
  const [hs, as] = noDrawScore();
  await p.match.create({
    data: {
      tournamentId: t.id,
      round: "Final",
      roundNumber: 3,
      matchNumber: 1,
      homePlayerId: sfWinners[0].id,
      awayPlayerId: sfWinners[1].id,
      homeScore: hs,
      awayScore: as,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  const champion = hs > as ? sfWinners[0] : sfWinners[1];
  console.log(`  Final: ${sfWinners[0].name} ${hs}-${as} ${sfWinners[1].name}`);
  console.log(`\n🏆 CHAMPION: ${champion.name}`);
  console.log(`\nVisit: /tournaments/dummy-league`);
}

main().catch(console.error).finally(() => p.$disconnect());
