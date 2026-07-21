/**
 * End-to-end simulation of the BWL Cup 20-player format.
 *   npx tsx scripts/simulate-bwl-cup.ts
 *
 * Seeds 20 players, runs all four phases with scripted results, and asserts the
 * full pipeline: qualifiers, playoff winners → seeds 13-14, snake groups, QF
 * pairings, stage-scoped standings isolation, playoff exclusion from standings,
 * and a champion. Also checks a legacy single-stage tournament still recomputes
 * identically. Exits non-zero on any failure.
 */
import { prisma } from "../src/lib/db";
import { recomputeStandings, advanceKnockoutWinner } from "../src/lib/actions/match";
import { getOrCreateDefaultStageId, backfillStageParticipants } from "../src/lib/stages";
import {
  generateStage1GroupsCore,
  closeStage1Core,
  computeStage2Seeds,
  generateStage2DrawCore,
  generateStage2KnockoutCore,
} from "../src/lib/actions/stage-progression";

let failures = 0;
function assert(name: string, cond: boolean, detail = "") {
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const SLUG_T = "bwl-cup-sim";
const SLUG_P = "bwlsim-";

async function cleanup() {
  await prisma.tournament.deleteMany({ where: { slug: { startsWith: SLUG_T } } }); // cascades stages/matches/standings/participants
  await prisma.player.deleteMany({ where: { slug: { startsWith: SLUG_P } } });
}

async function setResult(matchId: string, hs: number, as: number, hp?: number, ap?: number) {
  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: hs, awayScore: as,
      homeScorePens: hp ?? null, awayScorePens: ap ?? null,
      status: "COMPLETED", completedAt: new Date(),
    },
  });
}

async function main() {
  await cleanup();

  // ── Seed 20 players (index 0 = strongest) ──
  const players: { id: string; idx: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const p = await prisma.player.create({
      data: { name: `SimP${i}`, slug: `${SLUG_P}p${i}`, skillLevel: 99 - i },
    });
    players.push({ id: p.id, idx: i });
  }
  const strength = new Map(players.map((p) => [p.id, p.idx])); // lower idx = stronger

  const tournament = await prisma.tournament.create({
    data: { name: "BWL Cup Sim", slug: `${SLUG_T}-${players[0].id.slice(0, 6)}`, gameCategory: "EFOOTBALL", format: "GROUP_KNOCKOUT", participantType: "INDIVIDUAL", status: "ACTIVE" },
  });
  const tid = tournament.id;
  for (const p of players) await prisma.tournamentPlayer.create({ data: { tournamentId: tid, playerId: p.id } });

  // ── STAGE 1 ──
  const s1 = await generateStage1GroupsCore(tid);
  assert("Stage 1 generated (4 groups)", s1.success && s1.data?.groups === 4, JSON.stringify(s1));
  const stage1 = (await prisma.tournamentStage.findFirst({ where: { tournamentId: tid, orderIndex: 0 } }))!;

  // Script every group match: stronger player wins by (2 + group orderIndex).
  const s1Groups = await prisma.tournamentGroup.findMany({ where: { stageId: stage1.id }, select: { id: true, orderIndex: true } });
  const groupOrder = new Map(s1Groups.map((g) => [g.id, g.orderIndex]));
  const s1Matches = await prisma.match.findMany({ where: { stageId: stage1.id }, select: { id: true, groupId: true, homePlayerId: true, awayPlayerId: true } });
  assert("Stage 1 fixture count = 40", s1Matches.length === 40, `${s1Matches.length}`);
  for (const m of s1Matches) {
    const margin = 2 + (groupOrder.get(m.groupId!) ?? 0);
    const homeStronger = strength.get(m.homePlayerId!)! < strength.get(m.awayPlayerId!)!;
    await setResult(m.id, homeStronger ? margin : 0, homeStronger ? 0 : margin);
  }
  await recomputeStandings(tid, { stageId: stage1.id });

  // Snapshot Stage 1 standings (to prove Stage 2 recompute never touches them).
  const snapStage1 = async () =>
    (await prisma.standing.findMany({ where: { stageId: stage1.id }, orderBy: [{ groupId: "asc" }, { rank: "asc" }] }))
      .map((s) => `${s.groupId}|${s.playerId}|r${s.rank}|p${s.points}|gd${s.goalDiff}|gf${s.goalsFor}`).join(",");
  const stage1Before = await snapStage1();

  // Stage-1 tables (per group, ranked) for independent expectations.
  const tableOf = async (stageId: string, groupId: string) =>
    prisma.standing.findMany({ where: { stageId, groupId }, orderBy: [{ rank: "asc" }, { id: "asc" }], include: { player: { select: { name: true } } } });
  const orderedGroups = await prisma.tournamentGroup.findMany({ where: { stageId: stage1.id }, orderBy: { orderIndex: "asc" } });
  type G1Row = Awaited<ReturnType<typeof tableOf>>;
  const g1tables: G1Row[] = [];
  for (const g of orderedGroups) g1tables.push(await tableOf(stage1.id, g.id));

  const fourths = g1tables.map((t) => t[3]); // A4,B4,C4,D4

  // ── CLOSE STAGE 1 → PLAYOFF ──
  const closed = await closeStage1Core(tid);
  assert("closeStage1 creates 2 playoff matches", closed.success && closed.data?.playoffMatches === 2, JSON.stringify(closed));
  const playoff = (await prisma.tournamentStage.findFirst({ where: { tournamentId: tid, kind: "PLAYOFF" } }))!;
  const poMatches = await prisma.match.findMany({ where: { stageId: playoff.id }, orderBy: { matchNumber: "asc" } });
  assert("Playoff pairing A4 vs B4", poMatches[0].homePlayerId === fourths[0].playerId && poMatches[0].awayPlayerId === fourths[1].playerId);
  assert("Playoff pairing C4 vs D4", poMatches[1].homePlayerId === fourths[2].playerId && poMatches[1].awayPlayerId === fourths[3].playerId);

  // Playoff results: match1 drawn → home wins on pens; match2 home wins in normal time.
  await setResult(poMatches[0].id, 1, 1, 3, 2); // A4 wins on pens
  await setResult(poMatches[1].id, 2, 0);        // C4 wins
  await recomputeStandings(tid, { stageId: playoff.id }); // must produce NO standings
  const playoffWinnerIds = [poMatches[0].homePlayerId, poMatches[1].homePlayerId]; // A4, C4

  assert("Playoff has zero standings rows", (await prisma.standing.count({ where: { stageId: playoff.id } })) === 0);

  // ── SEEDS ──
  const seedRes = await computeStage2Seeds(tid);
  assert("computeStage2Seeds ok, 14 seeds", seedRes.ok && seedRes.seeds.length === 14, JSON.stringify(seedRes).slice(0, 120));
  if (!seedRes.ok) { report(); return; }
  const seeds = seedRes.seeds;
  assert("Seed 13 = playoff match 1 winner (A4)", seeds[12].playerId === playoffWinnerIds[0], `${seeds[12].playerId} vs ${playoffWinnerIds[0]}`);
  assert("Seed 14 = playoff match 2 winner (C4)", seeds[13].playerId === playoffWinnerIds[1]);

  // Independent expected seed list from the actual Stage 1 tables + playoff winners.
  const bySort = (rows: typeof g1tables[number]) => rows;
  void bySort;
  const posGroup = (pos: number) =>
    g1tables.map((t) => t[pos]).filter(Boolean).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
  const expectedDirect = [...posGroup(0), ...posGroup(1), ...posGroup(2)].map((s) => s.playerId);
  const expectedSeedIds = [...expectedDirect, playoffWinnerIds[0]!, playoffWinnerIds[1]!];
  assert("Seed order matches independent expectation", JSON.stringify(seeds.map((s) => s.playerId)) === JSON.stringify(expectedSeedIds));

  // 14 qualifiers = 12 direct (top3 per group) + 2 playoff winners, exactly.
  const expectedQualSet = new Set(expectedSeedIds);
  assert("Exactly 14 qualifiers", expectedQualSet.size === 14);

  // ── STAGE 2 DRAW (snake) ──
  const draw = await generateStage2DrawCore(tid);
  assert("Stage 2 draw ok", draw.success, JSON.stringify(draw).slice(0, 120));
  const stage2 = (await prisma.tournamentStage.findFirst({ where: { tournamentId: tid, orderIndex: 2 } }))!;
  const s2groups = await prisma.tournamentGroup.findMany({ where: { stageId: stage2.id }, orderBy: { orderIndex: "asc" } });
  const gX = s2groups.find((g) => g.name === "Group X")!;
  const gY = s2groups.find((g) => g.name === "Group Y")!;
  const partX = await prisma.stageParticipant.findMany({ where: { stageId: stage2.id, groupId: gX.id }, select: { playerId: true, seed: true } });
  const partY = await prisma.stageParticipant.findMany({ where: { stageId: stage2.id, groupId: gY.id }, select: { playerId: true, seed: true } });
  const X_SEEDS = new Set([1, 4, 5, 8, 9, 12, 13]);
  const xSeedsActual = partX.map((p) => p.seed!).sort((a, b) => a - b);
  const ySeedsActual = partY.map((p) => p.seed!).sort((a, b) => a - b);
  assert("Snake: Group X seeds = {1,4,5,8,9,12,13}", JSON.stringify(xSeedsActual) === JSON.stringify([1, 4, 5, 8, 9, 12, 13]), JSON.stringify(xSeedsActual));
  assert("Snake: Group Y seeds = {2,3,6,7,10,11,14}", JSON.stringify(ySeedsActual) === JSON.stringify([2, 3, 6, 7, 10, 11, 14]), JSON.stringify(ySeedsActual));
  // Each seed's player lands in the group the seed dictates.
  const seedToPlayer = new Map(seeds.map((s) => [s.seed, s.playerId]));
  let snakeOk = true;
  for (const p of partX) if (!X_SEEDS.has(p.seed!) || seedToPlayer.get(p.seed!) !== p.playerId) snakeOk = false;
  for (const p of partY) if (X_SEEDS.has(p.seed!) || seedToPlayer.get(p.seed!) !== p.playerId) snakeOk = false;
  assert("Snake players match the seed list", snakeOk);

  // Stage 1 standings unchanged after the Stage 2 draw+recompute.
  assert("Stage 1 standings unchanged after Stage 2", (await snapStage1()) === stage1Before);

  // ── SIMULATE STAGE 2 (lower stage-2 seed wins 1-0) ──
  const s2seed = new Map((await prisma.stageParticipant.findMany({ where: { stageId: stage2.id }, select: { playerId: true, seed: true } })).map((p) => [p.playerId!, p.seed!]));
  const s2Matches = await prisma.match.findMany({ where: { stageId: stage2.id }, select: { id: true, homePlayerId: true, awayPlayerId: true } });
  assert("Stage 2 fixture count = 42", s2Matches.length === 42, `${s2Matches.length}`);
  for (const m of s2Matches) {
    const homeStronger = s2seed.get(m.homePlayerId!)! < s2seed.get(m.awayPlayerId!)!;
    await setResult(m.id, homeStronger ? 1 : 0, homeStronger ? 0 : 1);
  }
  await recomputeStandings(tid, { stageId: stage2.id });
  assert("Stage 1 standings STILL unchanged after Stage 2 played", (await snapStage1()) === stage1Before);

  // Expected top-4 per group (by seed ascending).
  const top4 = (parts: { playerId: string | null; seed: number | null }[]) =>
    [...parts].sort((a, b) => a.seed! - b.seed!).slice(0, 4).map((p) => p.playerId);
  const X = top4(partX); // X1..X4
  const Y = top4(partY);

  // ── KNOCKOUT ──
  const ko = await generateStage2KnockoutCore(tid);
  assert("Knockout generated (4 QF)", ko.success && ko.data?.qf === 4, JSON.stringify(ko));
  const koStage = (await prisma.tournamentStage.findFirst({ where: { tournamentId: tid, orderIndex: 3 } }))!;
  const qfs = await prisma.match.findMany({ where: { stageId: koStage.id, round: "Quarter-finals" }, orderBy: { matchNumber: "asc" } });
  const pair = (m: { homePlayerId: string | null; awayPlayerId: string | null }) => [m.homePlayerId, m.awayPlayerId];
  assert("QF1 = X1 vs Y4", JSON.stringify(pair(qfs[0])) === JSON.stringify([X[0], Y[3]]));
  assert("QF2 = X2 vs Y3", JSON.stringify(pair(qfs[1])) === JSON.stringify([X[1], Y[2]]));
  assert("QF3 = Y1 vs X4", JSON.stringify(pair(qfs[2])) === JSON.stringify([Y[0], X[3]]));
  assert("QF4 = Y2 vs X3", JSON.stringify(pair(qfs[3])) === JSON.stringify([Y[1], X[2]]));
  assert("Knockout stage has zero standings rows", (await prisma.standing.count({ where: { stageId: koStage.id } })) === 0);

  // Simulate KO round by round (lower stage-2 seed advances; unseeded → weak).
  const koSeed = (id: string | null) => (id && s2seed.has(id) ? s2seed.get(id)! : 999);
  const playRound = async (round: string) => {
    const ms = await prisma.match.findMany({ where: { stageId: koStage.id, round }, orderBy: { matchNumber: "asc" } });
    for (const m of ms) {
      if (!m.homePlayerId || !m.awayPlayerId) continue;
      const homeWins = koSeed(m.homePlayerId) < koSeed(m.awayPlayerId);
      await setResult(m.id, homeWins ? 1 : 0, homeWins ? 0 : 1);
      await advanceKnockoutWinner(m.id, tid);
    }
    return ms.length;
  };
  await playRound("Quarter-finals");
  const sfCount = await playRound("Semi-finals");
  assert("Semi-finals created (2)", sfCount === 2, `${sfCount}`);
  const finalCount = await playRound("Final");
  assert("Final created (1)", finalCount === 1, `${finalCount}`);
  const final = await prisma.match.findFirst({ where: { stageId: koStage.id, round: "Final" } });
  const championId = final ? (final.homeScore! > final.awayScore! ? final.homePlayerId : final.awayPlayerId) : null;
  assert("Champion produced", !!championId && final?.status === "COMPLETED", `champion=${championId}`);

  // Playoff matches absent from ALL standings tables (any stage).
  const allStandings = await prisma.standing.findMany({ where: { tournamentId: tid }, select: { stageId: true } });
  const playoffOrKoStandings = allStandings.filter((s) => s.stageId === playoff.id || s.stageId === koStage.id).length;
  assert("No standings rows for playoff or knockout stages", playoffOrKoStandings === 0);

  // ── LEGACY single-stage no-op ──
  const legacyPlayers = [];
  for (let i = 0; i < 4; i++) legacyPlayers.push(await prisma.player.create({ data: { name: `SimLeg${i}`, slug: `${SLUG_P}leg${i}` } }));
  const legacy = await prisma.tournament.create({ data: { name: "Sim Legacy League", slug: `${SLUG_T}-legacy-${legacyPlayers[0].id.slice(0, 6)}`, gameCategory: "EFOOTBALL", format: "LEAGUE", participantType: "INDIVIDUAL", status: "ACTIVE" } });
  const legStage = await getOrCreateDefaultStageId(legacy.id);
  for (const p of legacyPlayers) await prisma.tournamentPlayer.create({ data: { tournamentId: legacy.id, playerId: p.id } });
  await backfillStageParticipants();
  let mn = 1;
  for (let i = 0; i < legacyPlayers.length; i++)
    for (let j = i + 1; j < legacyPlayers.length; j++) {
      const m = await prisma.match.create({ data: { tournamentId: legacy.id, stageId: legStage, round: `Round ${mn}`, roundNumber: mn, matchNumber: mn, homePlayerId: legacyPlayers[i].id, awayPlayerId: legacyPlayers[j].id, status: "COMPLETED", homeScore: 2, awayScore: i === 0 ? 0 : 1, completedAt: new Date() } });
      void m; mn++;
    }
  await recomputeStandings(legacy.id);
  const legSnap = async () => (await prisma.standing.findMany({ where: { tournamentId: legacy.id }, orderBy: [{ rank: "asc" }] })).map((s) => `${s.playerId}|r${s.rank}|p${s.points}`).join(",");
  const legBefore = await legSnap();
  await recomputeStandings(legacy.id);
  const legAfter = await legSnap();
  assert("Legacy single-stage recomputes identically", legBefore === legAfter && legBefore.length > 0);
  assert("Legacy tournament has exactly 1 stage", (await prisma.tournamentStage.count({ where: { tournamentId: legacy.id } })) === 1);

  await cleanup();
  report();
}

function report() {
  console.log(failures === 0 ? "\nALL ASSERTIONS PASSED" : `\n${failures} ASSERTION(S) FAILED`);
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((e) => { console.error(e); process.exit(1); });
