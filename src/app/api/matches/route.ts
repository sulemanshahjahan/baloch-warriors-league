import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 50);

    const where = status ? { status: status as any } : undefined;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: [
          { roundNumber: "asc" },
          { round: "asc" },
          { matchNumber: "asc" },
        ],
        skip,
        take: Math.min(limit, 50),
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          round: true,
          roundNumber: true,
          matchNumber: true,
          homeScore: true,
          awayScore: true,
          homeScorePens: true,
          awayScorePens: true,
          tournament: {
            select: { name: true, slug: true, gameCategory: true },
          },
          homeTeam: {
            select: { id: true, name: true, shortName: true },
          },
          awayTeam: {
            select: { id: true, name: true, shortName: true },
          },
          homePlayer: {
            select: { id: true, name: true },
          },
          awayPlayer: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.match.count({ where }),
    ]);

    return NextResponse.json(
      { matches, total, page, limit, totalPages: Math.ceil(total / limit) },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
