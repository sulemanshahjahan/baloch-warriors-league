"use client";

import { useRouter } from "next/navigation";
import { AnimatedDraw } from "@/components/admin/animated-draw";
import { bulkAssignPlayersToGroups } from "@/lib/actions/schedule";

interface DrawWrapperProps {
  players: Array<{ id: string; name: string; photoUrl?: string | null }>;
  groups: Array<{ id: string; name: string }>;
}

export function DrawWrapper({ players, groups }: DrawWrapperProps) {
  const router = useRouter();

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <AnimatedDraw
        players={players}
        groups={groups}
        onComplete={async (assignments) => {
          await bulkAssignPlayersToGroups(
            assignments.map((a) => ({
              tournamentPlayerId: a.playerId,
              groupId: a.groupId,
            }))
          );
          router.refresh();
        }}
      />
    </div>
  );
}
