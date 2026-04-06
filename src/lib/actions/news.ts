"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "@/lib/utils";

const newsSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().min(10, "Content is required"),
  excerpt: z.string().optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return { session };
}

export async function createNewsPost(formData: FormData): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse({
    ...raw,
    isPublished: raw.isPublished === "on" || raw.isPublished === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;
  const slug = slugify(data.title);
  const existing = await prisma.newsPost.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const post = await prisma.newsPost.create({
    data: {
      title: data.title,
      slug: finalSlug,
      content: data.content,
      excerpt: data.excerpt || null,
      coverUrl: data.coverUrl || null,
      isPublished: data.isPublished ?? false,
      publishedAt: data.isPublished ? new Date() : null,
    },
  });

  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { success: true, data: { id: post.id, slug: post.slug } };
}

export async function updateNewsPost(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse({
    ...raw,
    isPublished: raw.isPublished === "on" || raw.isPublished === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;
  const existing = await prisma.newsPost.findUnique({ where: { id } });

  await prisma.newsPost.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || null,
      coverUrl: data.coverUrl || null,
      isPublished: data.isPublished ?? false,
      publishedAt:
        data.isPublished && !existing?.publishedAt ? new Date() : existing?.publishedAt ?? null,
    },
  });

  revalidatePath("/admin/news");
  revalidatePath(`/admin/news/${id}`);
  revalidatePath("/news");

  return { success: true, data: undefined };
}

export async function deleteNewsPost(id: string): Promise<ActionResult> {
  await requireAdmin();

  await prisma.newsPost.delete({ where: { id } });

  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { success: true, data: undefined };
}

export async function getNewsPosts(params?: { published?: boolean }) {
  return prisma.newsPost.findMany({
    where: {
      ...(params?.published !== undefined && { isPublished: params.published }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNewsPostById(id: string) {
  return prisma.newsPost.findUnique({ where: { id } });
}
