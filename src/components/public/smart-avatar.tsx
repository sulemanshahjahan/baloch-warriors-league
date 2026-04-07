"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface SmartAvatarProps {
  type: "player" | "team";
  id: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * SmartAvatar - Loads images via API endpoint instead of embedding base64
 * HTML stays small (~50 bytes for the URL), image loads separately with caching
 */
export function SmartAvatar({
  type,
  id,
  name,
  className,
  fallbackClassName,
}: SmartAvatarProps) {
  // Use the image API endpoint
  const imageUrl = `/api/image?type=${type}&id=${id}`;

  return (
    <Avatar className={className}>
      <AvatarImage 
        src={imageUrl} 
        alt={name}
        loading="lazy"
      />
      <AvatarFallback className={fallbackClassName} delayMs={100}>
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
