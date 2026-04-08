import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { TournamentForm } from "@/components/admin/tournament-form";

export const metadata = { title: "New Tournament" };

export default async function NewTournamentPage() {
  await requireRole("EDITOR");
  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="New Tournament"
        description="Create a new tournament"
      />
      <main className="flex-1 p-6">
        <TournamentForm />
      </main>
    </div>
  );
}
