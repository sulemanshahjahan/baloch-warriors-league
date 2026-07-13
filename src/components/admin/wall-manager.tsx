"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Trash2, Save, Plus, Skull } from "lucide-react";
import { uploadWallImage } from "@/lib/actions/upload";
import { createWallPost, updateWallPost, deleteWallPost } from "@/lib/actions/wall";
import type { WallPost } from "@prisma/client";

export function WallManager({ posts }: { posts: WallPost[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Add form state ──
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10MB.");
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadWallImage(fd);
      if (result.success && result.url) setImageUrl(result.url);
      else setError(result.error ?? "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleAdd() {
    if (!imageUrl) {
      setError("Upload an image first.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createWallPost({ imageUrl, title, caption });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setImageUrl("");
      setTitle("");
      setCaption("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Add new meme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add to the Wall
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Meme Image</Label>
            {imageUrl ? (
              <div className="relative w-full max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full rounded-lg border border-border object-contain"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={() => setImageUrl("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                Upload image
              </Button>
            )}
            <Input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              JPG/PNG/WebP/GIF up to 10MB. Shown full — never cropped.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title (which tournament they exited)</Label>
              <Input
                id="title"
                placeholder="e.g. Knocked out in the group stage — BWL III"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                placeholder="Add a savage one-liner…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleAdd} disabled={isPending || isUploading || !imageUrl}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Post to Wall
          </Button>
        </CardContent>
      </Card>

      {/* Existing memes */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Skull className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">The wall is empty</h3>
          <p className="text-sm text-muted-foreground">Add the first early-exit meme above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <WallCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function WallCard({ post }: { post: WallPost }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(post.title ?? "");
  const [caption, setCaption] = useState(post.caption ?? "");
  const [error, setError] = useState("");

  const dirty = title !== (post.title ?? "") || caption !== (post.caption ?? "");

  function handleSave() {
    setError("");
    startTransition(async () => {
      const result = await updateWallPost(post.id, { title, caption });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Remove this meme from the wall? This cannot be undone.")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteWallPost(post.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.imageUrl} alt={post.title ?? "Meme"} className="w-full object-contain max-h-64" />
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Caption</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending || !dirty}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
