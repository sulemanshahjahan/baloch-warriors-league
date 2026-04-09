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
}

/**
 * SmartAvatar — uses photoUrl directly when provided (no API call),
 * falls back to /api/image with per-minute cache busting.
 */
export function SmartAvatar({
  type,
  id,
  name,
  className,
  fallbackClassName,
  primaryColor,
  photoUrl,
}: SmartAvatarProps) {
  // Direct Cloudinary/external URL — bypass API entirely
  // API fallback with cache buster that changes every minute
  const imageUrl = photoUrl || `/api/image?type=${type}&id=${id}&_=${Math.floor(Date.now() / 60000)}`;

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
