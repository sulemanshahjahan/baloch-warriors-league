"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, deleteGroup } from "@/lib/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Group {
  id: string;
  name: string;
  orderIndex: number;
  teams: {
    id: string;
    teamId: string;
    team: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  }[];
}

interface GroupsManagerProps {
  tournamentId: string;
  groups: Group[];
  unassignedTeams: {
    id: string;
    teamId: string;
    team: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  }[];
}

export function GroupsManager({ tournamentId, groups, unassignedTeams }: GroupsManagerProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    await createGroup(tournamentId, newGroupName);
    setNewGroupName("");
    setIsCreating(false);
    router.refresh();
  };

  const handleDeleteGroup = async (groupId: string) => {
    await deleteGroup(groupId);
    setDeleteDialogOpen(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Create Group */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Group name (e.g. Group A)"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
        />
        <Button
          size="sm"
          onClick={handleCreateGroup}
          disabled={isCreating || !newGroupName.trim()}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Group
        </Button>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No groups created yet. Add groups to organize the tournament.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    {group.name}
                    <Badge variant="secondary" className="text-xs">
                      {group.teams.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setDeleteDialogOpen(group.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {group.teams.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No teams assigned
                  </p>
                ) : (
                  <div className="space-y-2">
                    {group.teams.map(({ team }) => (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={team.logoUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(team.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{team.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Unassigned Teams */}
      {unassignedTeams.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              Unassigned Teams
              <Badge variant="secondary" className="text-xs">
                {unassignedTeams.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {unassignedTeams.map(({ team }) => (
                <div
                  key={team.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={team.logoUrl ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(team.name)}
                    </AvatarFallback>
                  </Avatar>
                  {team.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialogOpen} onOpenChange={() => setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group?</DialogTitle>
            <DialogDescription>
              This will delete the group. Teams in this group will become unassigned.
              Matches associated with this group will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialogOpen && handleDeleteGroup(deleteDialogOpen)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
