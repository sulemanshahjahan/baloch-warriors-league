"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { logActivity } from "./activity-log";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  return (ROLE_LEVELS[getUserRole(session)] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

const newsSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().min(10, "Content is required"),
  excerpt: z.string().optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
});

export async function createNewsPost(formData: FormData): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

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

  await logActivity({
    action: "CREATE",
    entityType: "NEWS",
    entityId: post.id,
    details: { title: data.title, isPublished: data.isPublished },
  });

  revalidatePath("/admin/news");
  revalidatePath("/news");

  return { success: true, data: { id: post.id, slug: post.slug } };
}

export async function updateNewsPost(id: string, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

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

  await logActivity({
    action: "UPDATE",
    entityType: "NEWS",
    entityId: id,
    details: { title: data.title, isPublished: data.isPublished },
  });

  revalidatePath("/admin/news");
  revalidatePath(`/admin/news/${id}`);
  revalidatePath("/news");

  return { success: true, data: undefined };
}

export async function deleteNewsPost(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };

  await prisma.newsPost.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "NEWS",
    entityId: id,
  });

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

export async function getNewsPostsPaginated(options?: {
  page?: number;
  limit?: number;
  published?: boolean;
  search?: string;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25));
  const skip = (page - 1) * limit;

  const where = {
    ...(options?.published !== undefined && { isPublished: options.published }),
    ...(options?.search && {
      title: { contains: options.search, mode: "insensitive" as const },
    }),
  };

  const [posts, total] = await Promise.all([
    prisma.newsPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.newsPost.count({ where }),
  ]);

  return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getNewsPostById(id: string) {
  return prisma.newsPost.findUnique({ where: { id } });
}
