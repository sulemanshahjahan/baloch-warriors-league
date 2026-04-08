import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // standings, matches, players
  const tournamentId = searchParams.get("tournamentId");
  const format = searchParams.get("format") ?? "csv";

  if (!type) return new NextResponse("Missing type parameter", { status: 400 });

  try {
    let data: Record<string, unknown>[] = [];
    let filename = "export";

    if (type === "standings" && tournamentId) {
      const standings = await prisma.standing.findMany({
        where: { tournamentId, groupId: null },
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
        include: {
          player: { select: { name: true } },
          team: { select: { name: true } },
        },
      });
      data = standings.map((s, i) => ({
        Rank: i + 1,
        Name: s.player?.name ?? s.team?.name ?? "",
        Played: s.played,
        Won: s.won,
        Drawn: s.drawn,
        Lost: s.lost,
        GF: s.goalsFor,
        GA: s.goalsAgainst,
        GD: s.goalDiff,
        Points: s.points,
      }));
      filename = "standings";
    } else if (type === "matches" && tournamentId) {
      const matches = await prisma.match.findMany({
        where: { tournamentId },
        orderBy: { scheduledAt: "asc" },
        include: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          homePlayer: { select: { name: true } },
          awayPlayer: { select: { name: true } },
        },
      });
      data = matches.map((m) => ({
        Round: m.round ?? "",
        Home: m.homePlayer?.name ?? m.homeTeam?.name ?? "—",
        Away: m.awayPlayer?.name ?? m.awayTeam?.name ?? "—",
        HomeScore: m.homeScore ?? "",
        AwayScore: m.awayScore ?? "",
        Status: m.status,
        Date: m.scheduledAt?.toISOString().split("T")[0] ?? "",
      }));
      filename = "matches";
    } else if (type === "players") {
      const players = await prisma.player.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          name: true,
          nickname: true,
          nationality: true,
          position: true,
          skillLevel: true,
        },
      });
      data = players.map((p) => ({
        Name: p.name,
        Nickname: p.nickname ?? "",
        Nationality: p.nationality ?? "",
        Position: p.position ?? "",
        SkillLevel: p.skillLevel ?? "",
      }));
      filename = "players";
    } else {
      return new NextResponse("Invalid type or missing tournamentId", { status: 400 });
    }

    if (format === "json") {
      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV
    if (data.length === 0) {
      return new NextResponse("No data", { status: 404 });
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
          })
          .join(",")
      ),
    ];

    return new NextResponse(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}
