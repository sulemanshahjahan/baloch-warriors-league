export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getNewsPosts } from "@/lib/actions/news";
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
import { formatDate } from "@/lib/utils";

export const metadata = { title: "News" };

export default async function NewsPage() {
  const posts = await getNewsPosts();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="News"
        description={`${posts.length} post${posts.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
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
