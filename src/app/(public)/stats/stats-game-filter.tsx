"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface StatsGameFilterProps {
  categories: { value: string; label: string }[];
  current: string;
  paramName?: string;
}

export function StatsGameFilter({ categories, current, paramName = "game" }: StatsGameFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    router.push(`/stats?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => handleSelect(cat.value)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
            current === cat.value
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
