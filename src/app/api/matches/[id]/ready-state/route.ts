import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/player-session";
import { getReadyState } from "@/lib/match-ready";

export const dynamic = "force-dynamic";

// Full ready state for a match (both flags, assigned team, lock window, server
// time). Public — spectators get a state with viewerSide: null.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getPlayerSession();
  const state = await getReadyState(id, session?.playerId ?? null);
  if (!state) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
