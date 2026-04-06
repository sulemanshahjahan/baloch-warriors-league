import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { PlayerForm } from "@/components/admin/player-form";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Player" };

interface EditPlayerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlayerPage({ params }: EditPlayerPageProps) {
  const { id } = await params;
  const player = await prisma.player.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nickname: true,
      photoUrl: true,
      position: true,
      nationality: true,
      bio: true,
      dateOfBirth: true,
      isActive: true,
    },
  });

  if (!player) notFound();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Edit Player" description={player.name} />
      <main className="flex-1 p-6">
        <Link
          href={`/admin/players/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Player
        </Link>
        <PlayerForm player={player} />
      </main>
    </div>
  );
}
