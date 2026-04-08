"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { updateTeam, deleteTeam } from "@/lib/actions/team";
import { uploadTeamLogo } from "@/lib/actions/upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface TeamFormProps {
  team: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    captainId: string | null;
    isActive: boolean;
  };
}

export function TeamForm({ team }: TeamFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState(team.logoUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateTeam(team.id, formData);
      if (result.success) {
        router.push(`/admin/teams/${team.id}`);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update team");
      }
    });
  }

  function handleDelete() {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteTeam(team.id);
      if (result.success) {
        router.push("/admin/teams");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to delete team");
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
            <CardTitle className="text-base">Team Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={team.name}
                placeholder="e.g. Baloch Warriors FC"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shortName">Short Name</Label>
                <Input
                  id="shortName"
                  name="shortName"
                  defaultValue={team.shortName ?? ""}
                  placeholder="e.g. BWL FC"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    defaultValue={team.primaryColor ?? "#dc2626"}
                    className="h-9 w-16 px-1 py-1 cursor-pointer"
                  />
                  <Input
                    name="primaryColorText"
                    defaultValue={team.primaryColor ?? ""}
                    placeholder="#dc2626"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>Team Logo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={logoUrl || undefined} />
                  <AvatarFallback className="text-xl">
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <input
                    type="hidden"
                    name="logoUrl"
                    value={logoUrl}
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
                      Upload Logo
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl("")}
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
                      
                      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
                      if (!allowedTypes.includes(file.type)) {
                        setError(`Invalid file type: ${file.type}. Please use JPG, PNG, WebP, or GIF.`);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        return;
                      }
                      
                      if (file.size > 10 * 1024 * 1024) {
                        setError("File too large. Max 10MB for logo images.");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        return;
                      }
                      
                      setIsUploading(true);
                      setError("");
                      
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        
                        const result = await uploadTeamLogo(formData);
                        
                        if (result.success && result.url) {
                          setLogoUrl(result.url);
                        } else {
                          setError(result.error || "Upload failed");
                        }
                      } catch (err: any) {
                        setError(`Upload error: ${err.message || "Unknown error"}`);
                      } finally {
                        setIsUploading(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP, or GIF. Max 10MB. Auto-resized to 400x400.
                  </p>
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
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{team.name}</strong>?
              This action cannot be undone. Players will remain in the system
              but will be unlinked from this team.
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
              Delete Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
