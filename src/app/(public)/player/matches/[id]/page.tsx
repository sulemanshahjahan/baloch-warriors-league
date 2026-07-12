import { redirect, notFound } from "next/navigation";
import { getPlayerSession } from "@/lib/player-session";
import { getMatchSchedulingView } from "@/lib/scheduling/view";
import { MatchSchedulingClient } from "./match-scheduling-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Match Scheduling | BWL" };

export default async function PlayerMatchSchedulingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const { id } = await params;

  const view = await getMatchSchedulingView(id, session.playerId);
  if (!view) notFound();

  return <MatchSchedulingClient view={view} />;
}
