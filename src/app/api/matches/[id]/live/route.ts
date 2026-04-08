import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeScorePens: true,
      awayScorePens: true,
      round: true,
      scheduledAt: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      homePlayer: { select: { id: true, name: true } },
      awayPlayer: { select: { id: true, name: true } },
      tournament: { select: { name: true, slug: true } },
      events: {
        where: { description: { not: "Auto-generated from match result" } },
        orderBy: { minute: "asc" },
        select: {
          id: true,
          type: true,
          minute: true,
          description: true,
          player: { select: { name: true } },
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(match, {
    headers: { "Cache-Control": "no-cache, no-store" },
  });
}
