import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "30", 10);

    const matches = await prisma.match.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
      take: Math.min(limit, 100),
      select: {
        id: true,
        status: true,
        scheduledAt: true,
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
    });

    return NextResponse.json(matches, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
