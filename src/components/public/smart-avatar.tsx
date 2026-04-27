"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface SmartAvatarProps {
  type: "player" | "team";
  id: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
  primaryColor?: string | null;
  photoUrl?: string | null;
  /** Hint for the API to serve a thumbnail. Snapped to {32,64,128,256,512}. */
  size?: 32 | 64 | 128 | 256 | 512;
}

/**
 * SmartAvatar — uses photoUrl directly when provided (no API call),
 * falls back to /api/image with a stable URL so browser/CDN caches long-term.
 * Bust the cache via `?v=<player.updatedAt>` from the parent when the photo changes.
 */
export function SmartAvatar({
  type,
  id,
  name,
  className,
  fallbackClassName,
  primaryColor,
  photoUrl,
  size = 128,
}: SmartAvatarProps) {
  // Direct Cloudinary/external URL — bypass API entirely.
  // Otherwise, stable API URL — no per-minute cache buster.
  const imageUrl = photoUrl || `/api/image?type=${type}&id=${id}&size=${size}`;

  return (
    <Avatar className={className}>
      <AvatarImage src={imageUrl} alt={name} loading="lazy" />
      <AvatarFallback
        className={fallbackClassName}
        delayMs={100}
        style={primaryColor ? { backgroundColor: primaryColor + "33", color: primaryColor, borderColor: primaryColor + "66" } : undefined}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

interface TournamentAvatarProps {
  gameCategory: string;
  name: string;
  className?: string;
}

/**
 * TournamentAvatar - Shows game icon or first letter for tournaments
 */
export function TournamentAvatar({
  gameCategory,
  name,
  className,
}: TournamentAvatarProps) {
  const gameIcons: Record<string, string> = {
    FOOTBALL: "⚽",
    EFOOTBALL: "🎮",
    PUBG: "🔫",
    SNOOKER: "🎱",
    CHECKERS: "🔴",
  };

  const icon = gameIcons[gameCategory] || name.charAt(0).toUpperCase();

  return (
    <Avatar className={className}>
      <AvatarFallback className="text-lg bg-primary/10 text-primary">
        {icon}
      </AvatarFallback>
    </Avatar>
  );
}
