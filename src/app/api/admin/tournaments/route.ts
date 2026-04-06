import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournaments = await prisma.tournament.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      gameCategory: true,
      teams: {
        select: {
          team: {
            select: { id: true, name: true },
          },
        },
      },
      players: {
        select: {
          player: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return NextResponse.json(tournaments);
}
