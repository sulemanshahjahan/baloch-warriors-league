import { cn } from "@/lib/utils";

function Crown() {
  return (
    <svg className="bwl-crown" width="34" height="20" viewBox="0 0 34 20" fill="none" aria-hidden>
      <path
        d="M2 6l6 5 9-9 9 9 6-5-3 12H5L2 6z"
        fill="url(#bwlCrownG)"
        stroke="#b45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="6" r="2" fill="#fde68a" />
      <circle cx="32" cy="6" r="2" fill="#fde68a" />
      <circle cx="17" cy="2" r="2" fill="#fde68a" />
      <defs>
        <linearGradient id="bwlCrownG" x1="0" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff0b8" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Premium framed avatar with attached identity badges. Renders a metallic ring
 * when a frame is equipped, else a clean default ring — both with the player's
 * rank + position badges (and a crown for high card ranks).
 */
export function AvatarFrame({
  frameClassName,
  sizeClassName,
  rank,
  position,
  showCrown,
  children,
}: {
  frameClassName?: string | null;
  sizeClassName: string;
  rank?: number;
  position?: string | null;
  showCrown?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bwl-frame shrink-0", frameClassName || "bwl-frame--default", sizeClassName)}>
      {showCrown && <Crown />}
      <div className="bwl-frame__inner">{children}</div>
      {position && <span className="bwl-pos-badge">{position}</span>}
      {typeof rank === "number" && <span className="bwl-rank-badge">{rank}</span>}
    </div>
  );
}
