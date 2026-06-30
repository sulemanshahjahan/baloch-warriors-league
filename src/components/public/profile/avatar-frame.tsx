import { cn } from "@/lib/utils";

/**
 * Wraps an avatar in a metallic BWL frame. When no frame is equipped it just
 * renders the avatar (sized by `sizeClassName`) so unequipped profiles stay clean.
 */
export function AvatarFrame({
  frameClassName,
  sizeClassName,
  children,
}: {
  frameClassName?: string | null;
  sizeClassName: string;
  children: React.ReactNode;
}) {
  if (!frameClassName) {
    return <div className={cn("shrink-0", sizeClassName)}>{children}</div>;
  }
  return (
    <div className={cn("bwl-frame shrink-0", frameClassName, sizeClassName)}>
      <div className="bwl-frame__inner">{children}</div>
    </div>
  );
}
