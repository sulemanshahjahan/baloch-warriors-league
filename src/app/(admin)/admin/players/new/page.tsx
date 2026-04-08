"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Upload, X } from "lucide-react";
import { createPlayer } from "@/lib/actions/player";
import { uploadPlayerImage } from "@/lib/actions/upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const POSITIONS = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
  { value: "IGL", label: "In-Game Leader (PUBG)" },
  { value: "FRAGGER", label: "Fragger (PUBG)" },
  { value: "SUPPORT", label: "Support (PUBG)" },
  { value: "OTHER", label: "Other / Universal" },
];

export default function NewPlayerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [position, setPosition] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    if (position) formData.set("position", position);

    startTransition(async () => {
      const result = await createPlayer(formData);
      if (result.success) {
        router.push("/admin/players");
        router.refresh();
      } else {
        setError((result as any).error ?? '');
      }
    });
  }

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="New Player" description="Register a new player" />
      <main className="flex-1 p-6">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="e.g. Ali Hassan" 
                    required 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname / Gaming Tag</Label>
                  <Input id="nickname" name="nickname" placeholder='e.g. "Bullet"' />
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="space-y-3">
                <Label>Player Avatar</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={photoUrl || undefined} />
                    <AvatarFallback className="text-xl">
                      {getInitials(playerName || "Player")}
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
                          setError("File too large. Max 10MB.");
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
                      JPG, PNG, WebP, or GIF. Max 10MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position / Role</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input id="nationality" name="nationality" placeholder="e.g. Pakistani" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Skill Level (0-99)</Label>
                  <Input
                    id="skillLevel"
                    name="skillLevel"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={50}
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Brief player biography..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Create Player
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
        </form>
      </main>
    </div>
  );
}
