import Image from "next/image";
import { cn } from "@/lib/utils";

function Crown() {
  return (
    <Image
      src="/profile-assets/avatar-crown-gold-trim.png"
      alt=""
      width={44}
      height={22}
      className="bwl-crown"
      aria-hidden
    />
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
