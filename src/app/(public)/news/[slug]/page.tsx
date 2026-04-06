export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface NewsPostPageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  return prisma.newsPost.findUnique({
    where: { slug, isPublished: true },
  });
}

export default async function NewsPostPage({ params }: NewsPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  return (
    <div className="min-h-screen">
      {post.coverUrl && (
        <div className="h-64 sm:h-80 overflow-hidden">
          <img src={post.coverUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All News
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5" />
          {post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-6">{post.title}</h1>

        {post.excerpt && (
          <p className="text-lg text-muted-foreground mb-8 border-l-2 border-primary pl-4">
            {post.excerpt}
          </p>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {post.content}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
