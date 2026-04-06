import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BWL database...");

  // ─── Admin User ──────────────────────────────────────────
  const password = await bcrypt.hash("bwl-admin-2025", 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@bwl.com" },
    update: {},
    create: {
      email: "admin@bwl.com",
      name: "BWL Admin",
      password,
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // ─── Season ──────────────────────────────────────────────
  const season = await prisma.season.upsert({
    where: { id: "seed-season-1" },
    update: {},
    create: {
      id: "seed-season-1",
      name: "Season 1 — 2025",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      isActive: true,
    },
  });
  console.log("✅ Season created:", season.name);

  // ─── Teams ───────────────────────────────────────────────
  const teamData = [
    { name: "Baloch Warriors FC", shortName: "BWL FC", primaryColor: "#dc2626" },
    { name: "Desert Eagles", shortName: "DEA", primaryColor: "#f59e0b" },
    { name: "Iron Lions", shortName: "IRL", primaryColor: "#3b82f6" },
    { name: "Storm United", shortName: "STU", primaryColor: "#8b5cf6" },
  ];

  const teams = [];
  for (const t of teamData) {
    const slug = t.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const team = await prisma.team.upsert({
      where: { slug },
      update: {},
      create: { name: t.name, slug, shortName: t.shortName, primaryColor: t.primaryColor },
    });
    teams.push(team);
    console.log("✅ Team:", team.name);
  }

  // ─── Players ─────────────────────────────────────────────
  const playerData = [
    { name: "Ahmed Khan", nickname: "Hawk", position: "FWD", teamIndex: 0 },
    { name: "Bilal Raza", nickname: "Thunder", position: "MID", teamIndex: 0 },
    { name: "Kamran Ali", nickname: "Wall", position: "DEF", teamIndex: 0 },
    { name: "Usman Baloch", nickname: "Eagle", position: "FWD", teamIndex: 1 },
    { name: "Tariq Hussain", nickname: "Rocket", position: "MID", teamIndex: 1 },
    { name: "Asif Malik", nickname: "Tank", position: "DEF", teamIndex: 2 },
    { name: "Zubair Shah", nickname: "Storm", position: "FWD", teamIndex: 2 },
    { name: "Naeem Gul", nickname: "Flash", position: "MID", teamIndex: 3 },
  ];

  for (const p of playerData) {
    const slug = p.name.toLowerCase().replace(/\s+/g, "-");
    const player = await prisma.player.upsert({
      where: { slug },
      update: {},
      create: {
        name: p.name,
        slug,
        nickname: p.nickname,
        position: p.position,
        nationality: "Pakistani",
      },
    });

    // Link to team
    const existingLink = await prisma.teamPlayer.findFirst({
      where: { playerId: player.id, teamId: teams[p.teamIndex].id, isActive: true },
    });

    if (!existingLink) {
      await prisma.teamPlayer.create({
        data: {
          teamId: teams[p.teamIndex].id,
          playerId: player.id,
          isActive: true,
        },
      });
    }

    console.log("✅ Player:", player.name);
  }

  // ─── Tournament ──────────────────────────────────────────
  const tournament = await prisma.tournament.upsert({
    where: { slug: "bwl-football-league-2025" },
    update: {},
    create: {
      name: "BWL Football League 2025",
      slug: "bwl-football-league-2025",
      description:
        "The inaugural season of the Baloch Warriors League Football Championship. Four teams battle it out in a full round-robin league format.",
      gameCategory: "FOOTBALL",
      format: "LEAGUE",
      participantType: "TEAM",
      status: "ACTIVE",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-08-31"),
      isFeatured: true,
      season: { connect: { id: season.id } },
    },
  });
  console.log("✅ Tournament:", tournament.name);

  // Enroll teams
  for (const team of teams) {
    const existing = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: tournament.id, teamId: team.id },
    });
    if (!existing) {
      await prisma.tournamentTeam.create({
        data: { tournamentId: tournament.id, teamId: team.id },
      });
    }
  }
  console.log("✅ Teams enrolled in tournament");

  // ─── Sample Matches ───────────────────────────────────────
  const matchData = [
    {
      home: 0, away: 1, homeScore: 3, awayScore: 1,
      round: "Matchday 1", roundNumber: 1, matchNumber: 1,
      status: "COMPLETED" as const,
      completedAt: new Date("2025-04-05"),
      scheduledAt: new Date("2025-04-05"),
    },
    {
      home: 2, away: 3, homeScore: 2, awayScore: 2,
      round: "Matchday 1", roundNumber: 1, matchNumber: 2,
      status: "COMPLETED" as const,
      completedAt: new Date("2025-04-05"),
      scheduledAt: new Date("2025-04-05"),
    },
    {
      home: 0, away: 2, homeScore: null, awayScore: null,
      round: "Matchday 2", roundNumber: 2, matchNumber: 1,
      status: "SCHEDULED" as const,
      scheduledAt: new Date("2025-04-20"),
    },
    {
      home: 1, away: 3, homeScore: null, awayScore: null,
      round: "Matchday 2", roundNumber: 2, matchNumber: 2,
      status: "SCHEDULED" as const,
      scheduledAt: new Date("2025-04-20"),
    },
  ];

  const createdMatches = [];
  for (const m of matchData) {
    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[m.home].id,
        awayTeamId: teams[m.away].id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        round: m.round,
        roundNumber: m.roundNumber,
        matchNumber: m.matchNumber,
        status: m.status,
        scheduledAt: m.scheduledAt,
        completedAt: m.status === "COMPLETED" ? m.completedAt : null,
      },
    });
    createdMatches.push(match);
    console.log(`✅ Match: ${teams[m.home].name} vs ${teams[m.away].name}`);
  }

  // ─── Standings (computed from seeded matches) ────────────
  // Match 1: BWL FC 3-1 Desert Eagles → BWL FC W, DEA L
  // Match 2: Iron Lions 2-2 Storm United → both D

  const standingsData = [
    { teamIndex: 0, played: 1, won: 1, drawn: 0, lost: 0, points: 3, gf: 3, ga: 1 }, // BWL FC
    { teamIndex: 1, played: 1, won: 0, drawn: 0, lost: 1, points: 0, gf: 1, ga: 3 }, // Desert Eagles
    { teamIndex: 2, played: 1, won: 0, drawn: 1, lost: 0, points: 1, gf: 2, ga: 2 }, // Iron Lions
    { teamIndex: 3, played: 1, won: 0, drawn: 1, lost: 0, points: 1, gf: 2, ga: 2 }, // Storm United
  ];

  for (const s of standingsData) {
    await prisma.standing.create({
      data: {
        tournamentId: tournament.id,
        teamId: teams[s.teamIndex].id,
        played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
        points: s.points, goalsFor: s.gf, goalsAgainst: s.ga,
        goalDiff: s.gf - s.ga,
      },
    });
  }
  console.log("✅ Standings seeded");

  console.log("\n🎉 Seed complete!");
  console.log("\n─────────────────────────────────────");
  console.log("Admin login:");
  console.log("  Email:    admin@bwl.com");
  console.log("  Password: bwl-admin-2025");
  console.log("─────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
