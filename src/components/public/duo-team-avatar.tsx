"use client";

import { SmartAvatar } from "@/components/public/smart-avatar";

interface Member {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface DuoTeamAvatarProps {
  id: string;
  name: string;
  /** When true (and members provided), renders both member faces stacked. */
  isDuo?: boolean | null;
  members?: Member[];
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders a team avatar — but for a 2v2 duo (isDuo + 2 members) it shows BOTH
 * members' faces stacked, matching how duos are shown in the admin/draw UIs.
 * Falls back to a single team avatar for normal teams.
 */
export function DuoTeamAvatar({
  id,
  name,
  isDuo,
  members,
  photoUrl,
  className = "h-7 w-7",
  fallbackClassName = "text-[10px]",
}: DuoTeamAvatarProps) {
  if (isDuo && members && members.length >= 2) {
    return (
      <div className="flex -space-x-2 shrink-0">
        {members.slice(0, 2).map((m) => (
          <SmartAvatar
            key={m.id}
            type="player"
            id={m.id}
            name={m.name}
            photoUrl={m.photoUrl}
            className={`${className} border-2 border-background`}
            fallbackClassName={fallbackClassName}
          />
        ))}
      </div>
    );
  }
  return (
    <SmartAvatar
      type="team"
      id={id}
      name={name}
      photoUrl={photoUrl}
      className={className}
      fallbackClassName={fallbackClassName}
    />
  );
}
