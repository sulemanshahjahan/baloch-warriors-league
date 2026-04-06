export const dynamic = "force-dynamic";

import { AdminHeader } from "@/components/admin/header";
import { getPlayers } from "@/lib/actions/player";
import { PlayersTable } from "./players-table";

export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Players"
        description={`${players.length} registered player${players.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6">
        <PlayersTable players={players} />
      </main>
    </div>
  );
}
