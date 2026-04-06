"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  itemsPerPage,
  basePath,
  searchParams = {},
}: PaginationProps) {
  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `${basePath}?${params.toString()}`;
  }

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;
    
    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {total} entries
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {total} entries
      </p>

      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden sm:flex"
          asChild
          disabled={currentPage <= 1}
        >
          <Link 
            href={buildHref(1)}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* Previous */}
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage <= 1}
        >
          <Link 
            href={buildHref(currentPage - 1)}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Previous</span>
          </Link>
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((page, idx) => (
            page === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <Link href={buildHref(page as number)}>
                  {page}
                </Link>
              </Button>
            )
          ))}
        </div>

        {/* Next */}
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={currentPage >= totalPages}
        >
          <Link 
            href={buildHref(currentPage + 1)}
            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>

        {/* Last page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden sm:flex"
          asChild
          disabled={currentPage >= totalPages}
        >
          <Link 
            href={buildHref(totalPages)}
            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
