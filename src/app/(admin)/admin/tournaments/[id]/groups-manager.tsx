"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, deleteGroup, assignTeamToGroup, assignPlayerToGroup, randomDrawToGroups, addLatePlayerToGroup } from "@/lib/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Users, Shield, Shuffle, Dices, Trophy, X, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { getInitials } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  orderIndex: number;
  teams?: {
    id: string;
    teamId: string;
    team: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  }[];
  players?: {
    id: string;
    playerId: string;
    player: {
      id: string;
      name: string;
      photoUrl: string | null;
    };
  }[];
}

interface Participant {
  id: string;
  tournamentId: string;
  name: string;
  photoUrl: string | null;
  skillLevel?: number | null;
}

interface AvailablePlayer {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface GroupsManagerProps {
  tournamentId: string;
  groups: Group[];
  unassignedParticipants: Participant[];
  participantType: "TEAM" | "INDIVIDUAL";
  availablePlayers?: AvailablePlayer[];
}

export function GroupsManager({
  tournamentId,
  groups,
  unassignedParticipants,
  participantType,
  availablePlayers = [],
}: GroupsManagerProps) {
  const router = useRouter();
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  
  // Assignment dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Random draw dialog states
  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [drawMethod, setDrawMethod] = useState<"RANDOM" | "SNAKE" | "BY_SKILL">("RANDOM");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState<string[] | null>(null);

  // Late player addition dialog states
  const [lateAddDialogOpen, setLateAddDialogOpen] = useState(false);
  const [lateAddGroupId, setLateAddGroupId] = useState<string>("");
  const [lateAddPlayerId, setLateAddPlayerId] = useState<string>("");
  const [isAddingLate, setIsAddingLate] = useState(false);
  const [lateAddResult, setLateAddResult] = useState<string | null>(null);
  const [lateAddError, setLateAddError] = useState<string | null>(null);

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

  const handleAssign = async () => {
    if (selectedParticipants.length === 0 || !selectedGroupId) return;
    
    setIsAssigning(true);
    for (const participantId of selectedParticipants) {
      if (participantType === "INDIVIDUAL") {
        await assignPlayerToGroup(participantId, selectedGroupId);
      } else {
        await assignTeamToGroup(participantId, selectedGroupId);
      }
    }
    setIsAssigning(false);
    setAssignDialogOpen(false);
    setSelectedParticipants([]);
    setSelectedGroupId("");
    router.refresh();
  };

  const handleRandomDraw = async () => {
    if (unassignedParticipants.length === 0) return;
    
    setIsDrawing(true);
    setDrawResult(null);
    
    const result = await randomDrawToGroups({
      tournamentId,
      method: drawMethod,
    });
    
    setIsDrawing(false);
    if (result.success && result.assignments) {
      setDrawResult(result.assignments);
      setTimeout(() => {
        setDrawDialogOpen(false);
        setDrawResult(null);
        router.refresh();
      }, 2000);
    }
  };

  const handleLateAdd = async () => {
    if (!lateAddPlayerId || !lateAddGroupId) return;
    setIsAddingLate(true);
    setLateAddResult(null);
    setLateAddError(null);

    const result = await addLatePlayerToGroup(tournamentId, lateAddPlayerId, lateAddGroupId);

    setIsAddingLate(false);
    if (result.success) {
      setLateAddResult(result.message ?? "Player added successfully.");
      setTimeout(() => {
        setLateAddDialogOpen(false);
        setLateAddResult(null);
        setLateAddPlayerId("");
        setLateAddGroupId("");
        router.refresh();
      }, 2000);
    } else {
      setLateAddError(result.error ?? "Something went wrong");
    }
  };

  const isIndividual = participantType === "INDIVIDUAL";
  const hasUnassigned = unassignedParticipants.length > 0;

  return (
    <div className="space-y-4">
      {/* Create Group & Actions */}
      <div className="flex flex-wrap items-center gap-2">
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
        
        {hasUnassigned && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignDialogOpen(true)}
            >
              <Users className="w-4 h-4 mr-1" />
              Manual Assign
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawDialogOpen(true)}
            >
              <Dices className="w-4 h-4 mr-1" />
              Random Draw
            </Button>
          </>
        )}
        {groups.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLateAddDialogOpen(true)}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Add Late {isIndividual ? "Player" : "Team"}
          </Button>
        )}
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No groups created yet. Add groups to organize the tournament.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const participants = isIndividual 
              ? (group.players || []).map((p) => ({ id: p.id, name: p.player.name, photoUrl: p.player.photoUrl }))
              : (group.teams || []).map((t) => ({ id: t.id, name: t.team.name, photoUrl: t.team.logoUrl }));

            return (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      {group.name}
                      <Badge variant="secondary" className="text-xs">
                        {participants.length}
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
                  {participants.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No {isIndividual ? "players" : "teams"} assigned
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 p-2 rounded bg-muted/50"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={p.photoUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(p.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unassigned Participants */}
      {hasUnassigned && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              Unassigned {isIndividual ? "Players" : "Teams"}
              <Badge variant="secondary" className="text-xs">
                {unassignedParticipants.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {unassignedParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={p.photoUrl ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  {p.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Assignment</DialogTitle>
            <DialogDescription>
              Select {isIndividual ? "players" : "teams"} and assign them to a group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Group Selection */}
            <div className="space-y-2">
              <Label>Select Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participants Selection */}
            <div className="space-y-2">
              <Label>Select {isIndividual ? "Players" : "Teams"}</Label>
              <div className="h-60 overflow-y-auto border rounded-lg p-2 space-y-1">
                {unassignedParticipants.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      selectedParticipants.includes(p.id)
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(p.id)}
                      onCheckedChange={() => {
                        if (selectedParticipants.includes(p.id)) {
                          setSelectedParticipants(selectedParticipants.filter((id) => id !== p.id));
                        } else {
                          setSelectedParticipants([...selectedParticipants, p.id]);
                        }
                      }}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.photoUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignDialogOpen(false);
              setSelectedParticipants([]);
              setSelectedGroupId("");
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={selectedParticipants.length === 0 || !selectedGroupId || isAssigning}
            >
              {isAssigning ? "Assigning..." : `Assign (${selectedParticipants.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Random Draw Dialog */}
      <Dialog open={drawDialogOpen} onOpenChange={setDrawDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="w-5 h-5" />
              Random Draw
            </DialogTitle>
            <DialogDescription>
              Automatically distribute {unassignedParticipants.length} {isIndividual ? "players" : "teams"} across {groups.length} groups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Draw Method</Label>
              <Select value={drawMethod} onValueChange={(v) => setDrawMethod(v as typeof drawMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RANDOM">
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Random Draw
                    </div>
                  </SelectItem>
                  <SelectItem value="SNAKE">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      Snake Draft
                    </div>
                  </SelectItem>
                  {isIndividual && (
                    <SelectItem value="BY_SKILL">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        By Skill Level
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Method description */}
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              {drawMethod === "RANDOM" && "Participants are randomly shuffled and distributed evenly across groups."}
              {drawMethod === "SNAKE" && "Participants are distributed in a snake pattern: Group A → B → C → D, then D → C → B → A, etc."}
              {drawMethod === "BY_SKILL" && "Highest rated players are distributed evenly across groups for balanced competition."}
            </div>

            {drawResult && (
              <div className="bg-green-500/10 text-green-500 p-3 rounded text-sm">
                <p className="font-medium">Draw Complete!</p>
                <p>Assigned {drawResult.length} participants</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDrawDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRandomDraw}
              disabled={isDrawing || unassignedParticipants.length === 0}
            >
              {isDrawing ? "Drawing..." : "Start Draw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Late Player/Team Dialog */}
      <Dialog open={lateAddDialogOpen} onOpenChange={(open) => {
        setLateAddDialogOpen(open);
        if (!open) { setLateAddResult(null); setLateAddError(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Late {isIndividual ? "Player" : "Team"}</DialogTitle>
            <DialogDescription>
              Add a new {isIndividual ? "player" : "team"} to a group mid-tournament. Matches against existing group members will be created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Group</Label>
              <Select value={lateAddGroupId} onValueChange={setLateAddGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => {
                    const count = isIndividual ? (g.players?.length ?? 0) : (g.teams?.length ?? 0);
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({count} {isIndividual ? "players" : "teams"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select {isIndividual ? "Player" : "Team"}</Label>
              <Select value={lateAddPlayerId} onValueChange={setLateAddPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${isIndividual ? "player" : "team"}...`} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={p.photoUrl ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                  {availablePlayers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No available {isIndividual ? "players" : "teams"} to add
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {lateAddGroupId && lateAddPlayerId && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                This will enroll the {isIndividual ? "player" : "team"} and create matches against all existing members of the group. No existing matches or results will be affected.
              </div>
            )}

            {lateAddResult && (
              <div className="bg-green-500/10 text-green-500 p-3 rounded text-sm font-medium">
                {lateAddResult}
              </div>
            )}

            {lateAddError && (
              <div className="bg-red-500/10 text-red-500 p-3 rounded text-sm font-medium">
                {lateAddError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLateAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLateAdd}
              disabled={isAddingLate || !lateAddGroupId || !lateAddPlayerId}
            >
              {isAddingLate ? "Adding..." : `Add & Generate Matches`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialogOpen} onOpenChange={() => setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group?</DialogTitle>
            <DialogDescription>
              This will delete the group. {isIndividual ? "Players" : "Teams"} in this group will become unassigned.
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
