"use client";

import { useState } from "react";
import Link from "next/link";
import { bulkDeletePlayers, bulkCreatePlayers } from "@/lib/actions/player";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Eye, Trash2, AlertTriangle, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  position: string | null;
  nationality: string | null;
  skillLevel: number | null;
  teams: { team: { name: string } }[];
  _count: { matchEvents: number };
}

interface PlayersTableProps {
  players: Player[];
}

export function PlayersTable({ players }: PlayersTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const allSelected = players.length > 0 && selectedIds.length === players.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < players.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(players.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    setIsLoading(true);
    const result = await bulkDeletePlayers(selectedIds);
    setIsLoading(false);
    if (result.success) {
      setSelectedIds([]);
      setDeleteOpen(false);
      router.refresh();
    }
  };

  const parseImportData = (): { name: string; nickname?: string; position?: string; nationality?: string }[] => {
    const lines = importText.trim().split("\n").filter((l) => l.trim());
    return lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        name: parts[0],
        nickname: parts[1] || undefined,
        position: parts[2] || undefined,
        nationality: parts[3] || undefined,
      };
    });
  };

  const handleBulkImport = async () => {
    const playersToCreate = parseImportData();
    if (playersToCreate.length === 0) return;

    setIsLoading(true);
    const result = await bulkCreatePlayers(playersToCreate);
    setIsLoading(false);
    if (result.success) {
      setImportText("");
      setImportOpen(false);
      router.refresh();
    }
  };

  const selectedPlayers = players.filter((p) => selectedIds.includes(p.id));

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {players.length > 0 && (
            <Checkbox
              id="select-all"
              checked={allSelected}
              data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all players"
            />
          )}
          <span className="text-sm text-muted-foreground">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : players.length > 0 ? `${players.length} players` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete ({selectedIds.length})
            </Button>
          )}

          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk Import Players</DialogTitle>
                <DialogDescription>
                  Enter player data, one per line. Format: Name, Nickname, Position, Nationality
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded space-y-1">
                  <p className="font-medium">Example formats:</p>
                  <code className="block">John Smith</code>
                  <code className="block">John Smith,Johnny,Forward,Pakistan</code>
                  <code className="block">Ali Khan,,Midfielder</code>
                </div>
                <Textarea
                  placeholder="Enter players..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={10}
                />
                {importText.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {parseImportData().length} players will be imported
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleBulkImport}
                  disabled={!importText.trim() || isLoading}
                >
                  {isLoading ? "Importing..." : "Import Players"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />
            Bulk Import
          </Button>

          <Button asChild size="sm">
            <Link href="/admin/players/new">
              <Plus className="w-4 h-4 mr-1" />
              New Player
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl">👤</span>
          </div>
          <h3 className="text-lg font-medium mb-1">No players yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add players to your league roster.
          </p>
          <Button asChild>
            <Link href="/admin/players/new">
              <Plus className="w-4 h-4 mr-1" />
              New Player
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Current Team</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead className="text-center">Events</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id} className={selectedIds.includes(player.id) ? "bg-primary/5" : ""}>
                  <TableCell className="py-2">
                    <Checkbox
                      checked={selectedIds.includes(player.id)}
                      onCheckedChange={() => toggleSelect(player.id)}
                      aria-label={`Select ${player.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={player.photoUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{player.name}</p>
                        {player.nickname && (
                          <p className="text-xs text-muted-foreground">
                            &quot;{player.nickname}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {player.position ?? "—"}
                  </TableCell>
                  <TableCell>
                    {player.skillLevel ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                        {player.skillLevel}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {player.teams[0]?.team.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {player.nationality ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {player._count.matchEvents}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link href={`/admin/players/${player.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link href={`/admin/players/${player.id}/edit`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete {selectedIds.length} Players?
            </DialogTitle>
            <DialogDescription>
              This action will soft-delete the selected players. They will be marked as inactive
              but their data will remain in the database.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto text-sm text-muted-foreground border rounded p-2 space-y-1">
            {selectedPlayers.map((player) => (
              <div key={player.id} className="py-0.5">
                • {player.name}
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete Players"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
