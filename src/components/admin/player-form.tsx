"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { updatePlayer, deletePlayer } from "@/lib/actions/player";
import { uploadPlayerImage } from "@/lib/actions/upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface PlayerFormProps {
  player: {
    id: string;
    name: string;
    nickname: string | null;
    photoUrl: string | null;
    position: string | null;
    nationality: string | null;
    skillLevel: number | null;
    bio: string | null;
    dateOfBirth: Date | null;
    isActive: boolean;
    suspendedUntil: Date | null;
    suspensionReason: string | null;
  };
}

export function PlayerForm({ player }: PlayerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updatePlayer(player.id, formData);
      if (result.success) {
        router.push(`/admin/players/${player.id}`);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update player");
      }
    });
  }

  function handleDelete() {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await deletePlayer(player.id);
      if (result.success) {
        router.push("/admin/players");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to delete player");
        setIsDeleting(false);
        setDeleteDialogOpen(false);
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={player.name}
                placeholder="e.g. Ahmed Khan"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  name="nickname"
                  defaultValue={player.nickname ?? ""}
                  placeholder="e.g. Hawk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  defaultValue={player.position ?? ""}
                  placeholder="e.g. FWD, MID, DEF"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  name="nationality"
                  defaultValue={player.nationality ?? ""}
                  placeholder="e.g. Pakistani"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={
                    player.dateOfBirth
                      ? new Date(player.dateOfBirth).toISOString().split("T")[0]
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillLevel">Skill Level (0-99)</Label>
                <Input
                  id="skillLevel"
                  name="skillLevel"
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={player.skillLevel ?? 50}
                  placeholder="50"
                />
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="space-y-3">
              <Label>Player Avatar</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={photoUrl || undefined} />
                  <AvatarFallback className="text-xl">
                    {getInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <input
                    type="hidden"
                    name="photoUrl"
                    value={photoUrl}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      Upload Image
                    </Button>
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPhotoUrl("")}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Validate before upload
                      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
                      if (!allowedTypes.includes(file.type)) {
                        setError(`Invalid file type: ${file.type}. Please use JPG, PNG, WebP, or GIF.`);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        return;
                      }
                      
                      if (file.size > 10 * 1024 * 1024) {
                        setError("File too large. Max 10MB for avatar images.");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        return;
                      }
                      
                      setIsUploading(true);
                      setError("");
                      
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        
                        const result = await uploadPlayerImage(formData);
                        console.log("Upload result:", result);
                        
                        if (result.success && result.url) {
                          setPhotoUrl(result.url);
                        } else {
                          setError(result.error || "Upload failed");
                        }
                      } catch (err: any) {
                        console.error("Upload error:", err);
                        setError(`Upload error: ${err.message || "Unknown error"}`);
                      } finally {
                        setIsUploading(false);
                        // Reset file input
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP, or GIF. Max 2MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={player.bio ?? ""}
                placeholder="Player biography..."
                rows={4}
              />
            </div>

            {/* Suspension */}
            <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                🚫 Suspension
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="suspendedUntil">Suspended Until</Label>
                  <Input
                    id="suspendedUntil"
                    name="suspendedUntil"
                    type="date"
                    defaultValue={
                      player.suspendedUntil
                        ? new Date(player.suspendedUntil).toISOString().split("T")[0]
                        : ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suspensionReason">Reason</Label>
                  <Input
                    id="suspensionReason"
                    name="suspensionReason"
                    defaultValue={player.suspensionReason ?? ""}
                    placeholder="e.g. Red card accumulation"
                  />
                </div>
              </div>
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Player</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{player.name}</strong>?
              This will mark the player as inactive. Their match history will
              be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
