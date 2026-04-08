"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { cloneTournament } from "@/lib/actions/tournament";

export function CloneTournamentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={isPending}
      title="Clone tournament"
      onClick={() => {
        startTransition(async () => {
          const result = await cloneTournament(id);
          if (result.success && result.data) {
            router.push(`/admin/tournaments/${result.data.id}/edit`);
          }
        });
      }}
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}
