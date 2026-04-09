export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getMatchesPaginated } from "@/lib/actions/match";
import { Button } from "@/components/ui/button";
import { Plus, Swords } from "lucide-react";
import { MatchesFilter } from "./matches-filter";
import { Pagination } from "@/components/admin/pagination";

export const metadata = { title: "Matches" };

const ITEMS_PER_PAGE = 25;

interface MatchesPageProps {
  searchParams: Promise<{ page?: string; status?: string; tournamentId?: string }>;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  await requireRole("EDITOR");
  const { page, status, tournamentId } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  
  const { matches, total, totalPages } = await getMatchesPaginated({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    status,
    tournamentId,
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Matches"
        description={`${total} match${total !== 1 ? "es" : ""} total`}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/matches/bulk">
              Bulk Entry
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/matches/new">
              <Plus className="w-4 h-4" />
              New Match
            </Link>
          </Button>
        </div>

        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Swords className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No matches yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule the first match for your tournaments.
            </p>
            <Button asChild>
              <Link href="/admin/matches/new">
                <Plus className="w-4 h-4" />
                New Match
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <MatchesFilter 
              matches={matches} 
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </main>
    </div>
  );
}
