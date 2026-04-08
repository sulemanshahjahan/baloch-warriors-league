export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { getPlayersPaginated } from "@/lib/actions/player";
import { PlayersTable } from "./players-table";
import { Pagination } from "@/components/admin/pagination";

export const metadata = { title: "Players" };

const ITEMS_PER_PAGE = 25;

interface PlayersPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  await requireRole("EDITOR");
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  
  const { players, total, totalPages } = await getPlayersPaginated({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    search,
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Players"
        description={`${total} registered player${total !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <PlayersTable 
          players={players} 
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          itemsPerPage={ITEMS_PER_PAGE}
          search={search}
        />
      </main>
    </div>
  );
}
