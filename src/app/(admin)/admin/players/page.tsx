export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getPlayers } from "@/lib/actions/player";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, User, Edit, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Players"
        description={`${players.length} registered player${players.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/players/new">
              <Plus className="w-4 h-4" />
              New Player
            </Link>
          </Button>
        </div>

        {players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <User className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No players yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add players to your league roster.
            </p>
            <Button asChild>
              <Link href="/admin/players/new">
                <Plus className="w-4 h-4" />
                New Player
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Player</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Current Team</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead className="text-center">Events</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
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
      </main>
    </div>
  );
}
