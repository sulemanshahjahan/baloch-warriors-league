import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { TournamentForm } from "@/components/admin/tournament-form";
import { prisma } from "@/lib/db";

export const metadata = { title: "Edit Tournament" };

interface EditTournamentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTournamentPage({ params }: EditTournamentPageProps) {
  await requireRole("EDITOR");
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { id } });

  if (!tournament) notFound();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Edit Tournament"
        description={tournament.name}
      />
      <main className="flex-1 p-6">
        <TournamentForm tournament={tournament} />
      </main>
    </div>
  );
}
