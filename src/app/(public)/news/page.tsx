export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Calendar, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

async function getPublishedPosts() {
  return prisma.newsPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
  });
}

export default async function NewsPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Newspaper className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              News
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Latest News</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Updates, match reports, and announcements from the Baloch Warriors League.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No news posts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`}>
                <Card className="hover:border-primary/50 transition-all cursor-pointer group">
                  <CardContent className="p-0">
                    {post.coverUrl && (
                      <div className="h-48 overflow-hidden rounded-t-lg">
                        <img
                          src={post.coverUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}
                      </div>
                      <h2 className="text-xl font-bold group-hover:text-primary transition-colors mb-2">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-muted-foreground text-sm line-clamp-2">{post.excerpt}</p>
                      )}
                      <div className="flex items-center gap-1 text-sm text-primary mt-3">
                        Read more
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
