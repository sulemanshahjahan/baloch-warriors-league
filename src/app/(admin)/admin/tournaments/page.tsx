export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getTournaments } from "@/lib/actions/tournament";
import { Button } from "@/components/ui/button";
import { Plus, Trophy } from "lucide-react";
import { TournamentsTable } from "./tournaments-table";

export const metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  await requireRole("EDITOR");
  const tournaments = await getTournaments();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Tournaments"
        description={`${tournaments.length} tournament${tournaments.length !== 1 ? "s" : ""} total`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/tournaments/new">
              <Plus className="w-4 h-4" />
              New Tournament
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No tournaments yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first tournament to get started.
            </p>
            <Button asChild>
              <Link href="/admin/tournaments/new">
                <Plus className="w-4 h-4" />
                New Tournament
              </Link>
            </Button>
          </div>
        ) : (
          <TournamentsTable tournaments={tournaments as any} />
        )}
      </main>
    </div>
  );
}
