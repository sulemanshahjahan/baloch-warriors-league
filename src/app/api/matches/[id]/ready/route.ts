import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/player-session";
import { readyUp } from "@/lib/match-ready";

export const dynamic = "force-dynamic";

// Mark the caller ready. Assigns a team + starts the lock if this makes both
// players ready. Returns the updated state (with server time).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in to ready up." }, { status: 401 });
  }

  const result = await readyUp(id, session.playerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.state, { headers: { "Cache-Control": "no-store" } });
}
