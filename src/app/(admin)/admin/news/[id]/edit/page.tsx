"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateNewsPost, deleteNewsPost, getNewsPostById } from "@/lib/actions/news";
import { use } from "react";

export default function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [post, setPost] = useState<{
    id: string;
    title: string;
    content: string;
    excerpt: string | null;
    coverUrl: string | null;
    isPublished: boolean;
  } | null>(null);

  useEffect(() => {
    getNewsPostById(id).then((p) => {
      if (p) setPost(p);
      else router.push("/admin/news");
    });
  }, [id, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!post) return;
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateNewsPost(id, formData);
      if (result.success) {
        router.push("/admin/news");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update post");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteNewsPost(id);
      if (result.success) {
        router.push("/admin/news");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to delete post");
        setDeleteDialogOpen(false);
      }
    });
  }

  if (!post) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1">
        <AdminHeader title="Edit Post" description={post.title} />
        <main className="flex-1 p-6">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Post Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" name="title" defaultValue={post.title} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    name="excerpt"
                    defaultValue={post.excerpt ?? ""}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverUrl">Cover Image URL</Label>
                  <Input
                    id="coverUrl"
                    name="coverUrl"
                    type="url"
                    defaultValue={post.coverUrl ?? ""}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    name="content"
                    defaultValue={post.content}
                    rows={12}
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublished"
                    name="isPublished"
                    value="true"
                    defaultChecked={post.isPublished}
                    className="rounded border-border"
                  />
                  <Label htmlFor="isPublished" className="cursor-pointer">
                    Published
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isPending}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </form>
        </main>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{post.title}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
