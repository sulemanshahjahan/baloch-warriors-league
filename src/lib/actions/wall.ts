"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
async function requireEditor(): Promise<boolean> {
  const session = await auth();
  if (!session) return false;
  return (ROLE_LEVELS[getUserRole(session)] ?? 0) >= ROLE_LEVELS.EDITOR;
}

function revalidate() {
  revalidatePath("/wall");
  revalidatePath("/admin/wall");
}

export async function getWallPosts() {
  return prisma.wallPost.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createWallPost(input: {
  imageUrl: string;
  title?: string;
  caption?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!(await requireEditor())) return { success: false, error: "Admin access required." };
  if (!input.imageUrl) return { success: false, error: "An image is required." };
  const post = await prisma.wallPost.create({
    data: { imageUrl: input.imageUrl, title: input.title?.trim() || null, caption: input.caption?.trim() || null },
  });
  revalidate();
  return { success: true, data: { id: post.id } };
}

export async function updateWallPost(
  id: string,
  input: { title?: string; caption?: string }
): Promise<ActionResult> {
  if (!(await requireEditor())) return { success: false, error: "Admin access required." };
  await prisma.wallPost.update({
    where: { id },
    data: { title: input.title?.trim() || null, caption: input.caption?.trim() || null },
  });
  revalidate();
  return { success: true, data: undefined };
}

export async function deleteWallPost(id: string): Promise<ActionResult> {
  if (!(await requireEditor())) return { success: false, error: "Admin access required." };
  const post = await prisma.wallPost.findUnique({ where: { id }, select: { imageUrl: true } });
  await prisma.wallPost.delete({ where: { id } });
  if (post?.imageUrl) {
    try {
      const { deleteImageFromCloudinary } = await import("./upload");
      await deleteImageFromCloudinary(post.imageUrl);
    } catch {
      /* best-effort */
    }
  }
  revalidate();
  return { success: true, data: undefined };
}
