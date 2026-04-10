"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { useCallback } from "react";

/**
 * Tabs wrapper that syncs the active tab with the URL search param `tab`.
 * Preserves tab selection across page reloads and enables shareable tab links.
 */
export function UrlTabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") ?? defaultValue;

  const onValueChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname, defaultValue]
  );

  return (
    <Tabs value={activeTab} onValueChange={onValueChange} className={className}>
      {children}
    </Tabs>
  );
}
