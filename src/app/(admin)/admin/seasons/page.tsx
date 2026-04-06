export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getSeasons } from "@/lib/actions/season";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, Edit } from "lucide-react";
import { DeleteSeasonButton } from "./delete-button";
import { formatDate } from "@/lib/utils";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Seasons" };

export default async function SeasonsPage() {
  await requireRole("ADMIN");
  const seasons = await getSeasons();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Seasons"
        description={`${seasons.length} season${seasons.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/seasons/new">
              <Plus className="w-4 h-4" />
              New Season
            </Link>
          </Button>
        </div>

        {seasons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No seasons yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create seasons to group tournaments together.
            </p>
            <Button asChild>
              <Link href="/admin/seasons/new">
                <Plus className="w-4 h-4" />
                Create Season
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-center">Tournaments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((season) => (
                  <TableRow key={season.id}>
                    <TableCell className="font-medium">{season.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {season.startDate ? formatDate(season.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {season.endDate ? formatDate(season.endDate) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {season._count.tournaments}
                    </TableCell>
                    <TableCell>
                      {season.isActive ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/seasons/${season.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DeleteSeasonButton
                          id={season.id}
                          name={season.name}
                          tournamentCount={season._count.tournaments}
                        />
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
