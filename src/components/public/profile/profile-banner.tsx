import { cn } from "@/lib/utils";

/**
 * Hero background wrapper. Applies the equipped banner skin (or a clean default)
 * and exposes the cohesive accent colour to descendants via --bwl-accent.
 */
export function ProfileBanner({
  bannerClassName,
  accent,
  children,
}: {
  bannerClassName?: string | null;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("bwl-banner border-b border-border/50", bannerClassName || "bwl-banner--default")}
      style={accent ? ({ "--bwl-accent": accent } as React.CSSProperties) : undefined}
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8">{children}</div>
    </section>
  );
}
