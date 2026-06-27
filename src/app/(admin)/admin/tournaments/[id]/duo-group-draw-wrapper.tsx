"use client";

// Animated group draw for 2v2 duos. Reuses the same <AnimatedDraw> used for
// solo tournaments — each duo is treated as a single participant whose id is the
// TournamentTeam (enrollment) id and whose name is the duo name.
import { useRouter } from "next/navigation";
import { AnimatedDraw } from "@/components/admin/animated-draw";
import { bulkAssignTeamsToGroups } from "@/lib/actions/schedule";

interface DuoGroupDrawWrapperProps {
  duos: Array<{ tournamentTeamId: string; name: string; photoUrl?: string | null }>;
  groups: Array<{ id: string; name: string }>;
}

export function DuoGroupDrawWrapper({ duos, groups }: DuoGroupDrawWrapperProps) {
  const router = useRouter();

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <AnimatedDraw
        players={duos.map((d) => ({ id: d.tournamentTeamId, name: d.name, photoUrl: d.photoUrl }))}
        groups={groups}
        onComplete={async (assignments) => {
          await bulkAssignTeamsToGroups(
            assignments.map((a) => ({ tournamentTeamId: a.playerId, groupId: a.groupId }))
          );
          router.refresh();
        }}
      />
    </div>
  );
}
