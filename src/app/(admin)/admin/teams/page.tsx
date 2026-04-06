export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getTeamsPaginated } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Users, Edit, Eye } from "lucide-react";
import { DeleteTeamButton } from "./delete-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Pagination } from "@/components/admin/pagination";
import { TeamsSearch } from "./teams-search";

export const metadata = { title: "Teams" };

const ITEMS_PER_PAGE = 25;

interface TeamsPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  
  const { teams, total, totalPages } = await getTeamsPaginated({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    search,
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Teams"
        description={`${total} active team${total !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TeamsSearch initialSearch={search} />
          
          <Button asChild>
            <Link href="/admin/teams/new">
              <Plus className="w-4 h-4" />
              New Team
            </Link>
          </Button>
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No teams yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add the first team to your league.
            </p>
            <Button asChild>
              <Link href="/admin/teams/new">
                <Plus className="w-4 h-4" />
                New Team
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Team</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>Captain</TableHead>
                    <TableHead className="text-center">Players</TableHead>
                    <TableHead className="text-center">Tournaments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={team.logoUrl ?? undefined} />
                            <AvatarFallback
                              className="text-xs"
                              style={{
                                backgroundColor: team.primaryColor
                                  ? `${team.primaryColor}33`
                                  : undefined,
                              }}
                            >
                              {getInitials(team.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {team.shortName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {team.captain?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {team._count.players}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {team._count.tournaments}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/admin/teams/${team.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/admin/teams/${team.id}/edit`}>
                              <Edit className="w-4 h-4" />
                            </Link>
                          </Button>
                          <DeleteTeamButton id={team.id} name={team.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              itemsPerPage={ITEMS_PER_PAGE}
              basePath="/admin/teams"
              searchParams={search ? { search } : {}}
            />
          </>
        )}
      </main>
    </div>
  );
}
