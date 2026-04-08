export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getNewsPostsPaginated } from "@/lib/actions/news";
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
import { Plus, Newspaper, Edit, Eye } from "lucide-react";
import { DeleteNewsButton } from "./delete-button";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/admin/pagination";
import { NewsSearch } from "./news-search";

export const metadata = { title: "News" };

const ITEMS_PER_PAGE = 25;

interface NewsPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  await requireRole("EDITOR");
  const { page, search } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  
  const { posts, total, totalPages } = await getNewsPostsPaginated({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    search,
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="News"
        description={`${total} post${total !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <NewsSearch initialSearch={search} />
          
          <Button asChild>
            <Link href="/admin/news/new">
              <Plus className="w-4 h-4" />
              New Post
            </Link>
          </Button>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Newspaper className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Write your first news post.
            </p>
            <Button asChild>
              <Link href="/admin/news/new">
                <Plus className="w-4 h-4" />
                New Post
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell>
                        <Badge variant={post.isPublished ? "default" : "secondary"}>
                          {post.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.publishedAt ? formatDate(post.publishedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(post.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {post.isPublished && (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/news/${post.slug}`} target="_blank">
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/admin/news/${post.id}/edit`}>
                              <Edit className="w-4 h-4" />
                            </Link>
                          </Button>
                          <DeleteNewsButton id={post.id} title={post.title} />
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
              basePath="/admin/news"
              searchParams={search ? { search } : {}}
            />
          </>
        )}
      </main>
    </div>
  );
}
