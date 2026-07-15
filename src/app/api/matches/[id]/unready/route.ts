import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/player-session";
import { unready } from "@/lib/match-ready";

export const dynamic = "force-dynamic";

// Clear the caller's ready flag. Rejected (409) while a team lock is active.
// Returns the updated state (with server time).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const result = await unready(id, session.playerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.state, { headers: { "Cache-Control": "no-store" } });
}
