"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ActivityPaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
}

export function ActivityPagination({
  currentPage,
  totalPages,
  total,
  itemsPerPage,
}: ActivityPaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {total} entries
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage <= 1}
        >
          <Link 
            href={`/admin/activity?page=${currentPage - 1}`}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Link>
        </Button>

        <span className="text-sm text-muted-foreground px-2">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage >= totalPages}
        >
          <Link 
            href={`/admin/activity?page=${currentPage + 1}`}
            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
