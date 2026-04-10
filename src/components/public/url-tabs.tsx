"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

/**
 * Tabs wrapper that syncs the active tab with the URL search param `tab`.
 * Uses history.replaceState for instant tab switching (no server round-trip).
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
  const initialTab = searchParams.get("tab") ?? defaultValue;
  const [activeTab, setActiveTab] = useState(initialTab);

  function onValueChange(value: string) {
    setActiveTab(value);

    // Update URL without triggering navigation
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={activeTab} onValueChange={onValueChange} className={className}>
      {children}
    </Tabs>
  );
}
