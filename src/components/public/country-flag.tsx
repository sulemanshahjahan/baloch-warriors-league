import { resolveCountry } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * Renders a country flag for a free-text nationality. Shows flag (+ optional
 * name); falls back to the raw text when the country can't be resolved.
 */
export function CountryFlag({
  value,
  showName = false,
  className,
}: {
  value: string | null | undefined;
  showName?: boolean;
  className?: string;
}) {
  if (!value) return null;
  const c = resolveCountry(value);
  if (!c) {
    // Unknown / junk input — show the raw text so no info is lost.
    return <span className={cn("text-muted-foreground", className)}>{value}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={c.name}>
      <span className="leading-none" aria-label={c.name}>{c.flag}</span>
      {showName && <span>{c.name}</span>}
    </span>
  );
}
