import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { TeamForm } from "@/components/admin/team-form";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Edit Team" };

interface EditTeamPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTeamPage({ params }: EditTeamPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      shortName: true,
      logoUrl: true,
      primaryColor: true,
      captainId: true,
      isActive: true,
    },
  });

  if (!team) notFound();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Edit Team" description={team.name} />
      <main className="flex-1 p-6">
        <Link
          href={`/admin/teams/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Team
        </Link>
        <TeamForm team={team} />
      </main>
    </div>
  );
}
