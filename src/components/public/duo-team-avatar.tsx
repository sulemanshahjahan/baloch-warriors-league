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
  /** When true (and members provided), renders both member faces side by side. */
  isDuo?: boolean | null;
  members?: Member[];
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  /**
   * Per-member size for duos. Defaults to className. Pass a smaller size at
   * call sites with large avatars so the side-by-side pair doesn't overflow.
   */
  memberClassName?: string;
}

/**
 * Renders a team avatar — but for a 2v2 duo (isDuo + 2 members) it shows BOTH
 * members' faces side by side (no overlap, so neither is clipped). Falls back to
 * a single team avatar for normal teams.
 */
export function DuoTeamAvatar({
  id,
  name,
  isDuo,
  members,
  photoUrl,
  className = "h-7 w-7",
  fallbackClassName = "text-[10px]",
  memberClassName,
}: DuoTeamAvatarProps) {
  if (isDuo && members && members.length >= 2) {
    const memberCls = memberClassName ?? className;
    return (
      <div className="flex items-center gap-0.5 shrink-0">
        {members.slice(0, 2).map((m) => (
          <SmartAvatar
            key={m.id}
            type="player"
            id={m.id}
            name={m.name}
            photoUrl={m.photoUrl}
            className={memberCls}
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
