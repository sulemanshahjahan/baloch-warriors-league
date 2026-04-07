"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { enrollTeamInTournament, removeTeamFromTournament } from "@/lib/actions/tournament";
import { getInitials } from "@/lib/utils";

interface TeamEnrollmentProps {
  tournamentId: string;
  enrolledTeams: Array<{
    id: string;
    team: {
      id: string;
      name: string;
      shortName: string | null;
      logoUrl: string | null;
    };
  }>;
  availableTeams: Array<{
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  }>;
}

export function TeamEnrollment({
  tournamentId,
  enrolledTeams,
  availableTeams,
}: TeamEnrollmentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  function handleEnroll() {
    if (!selectedTeamId) return;

    setError("");
    startTransition(async () => {
      const result = await enrollTeamInTournament(tournamentId, selectedTeamId);
      if (result.success) {
        setDialogOpen(false);
        setSelectedTeamId("");
        router.refresh();
      } else {
        setError((result as any).error ?? "Failed to enroll team");
      }
    });
  }

  function handleRemove(tournamentTeamId: string) {
    startTransition(async () => {
      const result = await removeTeamFromTournament(tournamentId, tournamentTeamId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Enrolled Teams List */}
      {enrolledTeams.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No teams enrolled yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {enrolledTeams.map(({ id, team }) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
            >
              <Link
                href={`/admin/teams/${team.id}`}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={team.logoUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{team.name}</p>
                  {team.shortName && (
                    <p className="text-xs text-muted-foreground">
                      {team.shortName}
                    </p>
                  )}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(id)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-destructive" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Team Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full"
            disabled={availableTeams.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            {availableTeams.length === 0
              ? "All teams enrolled"
              : "Add Team to Tournament"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
            <DialogDescription>
              Select a team to enroll in this tournament.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team..." />
            </SelectTrigger>
            <SelectContent>
              {availableTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={team.logoUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(team.name)}
                      </AvatarFallback>
                    </Avatar>
                    {team.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={!selectedTeamId || isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Team
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
