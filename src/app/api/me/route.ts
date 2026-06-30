import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ player: null });
  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, name: true, slug: true, coins: true, legacyLevel: true },
  });
  return NextResponse.json({ player });
}
