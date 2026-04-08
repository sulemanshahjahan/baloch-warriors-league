import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [], teams: [], tournaments: [] });
  }

  const contains = q;

  const [players, teams, tournaments] = await Promise.all([
    prisma.player.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains, mode: "insensitive" } },
          { nickname: { contains, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, position: true },
      take: 5,
    }),
    prisma.team.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains, mode: "insensitive" } },
          { shortName: { contains, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, shortName: true },
      take: 5,
    }),
    prisma.tournament.findMany({
      where: {
        name: { contains, mode: "insensitive" },
        status: { not: "CANCELLED" },
      },
      select: { id: true, name: true, slug: true, gameCategory: true, status: true },
      take: 5,
    }),
  ]);

  return NextResponse.json(
    { players, teams, tournaments },
    { headers: { "Cache-Control": "public, s-maxage=30" } }
  );
}
