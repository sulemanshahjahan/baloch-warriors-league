"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * LiveRefresh — polls /api/notifications for new activity and
 * auto-refreshes the page when something changes.
 *
 * Drop this component into any page that should stay live.
 * It polls every `interval` ms (default 15s) and calls
 * router.refresh() when new notifications are detected.
 * This re-fetches server components without a full page reload.
 *
 * Usage: <LiveRefresh interval={15000} />
 */
export function LiveRefresh({ interval = 15000 }: { interval?: number }) {
  const router = useRouter();
  const lastIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Get initial latest notification ID
    fetch("/api/notifications?since=&limit=1")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          lastIdRef.current = data[0].id;
        }
      })
      .catch(() => {});

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const res = await fetch("/api/notifications?limit=1");
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) return;

        const latestId = data[0].id;

        // If we have a previous ID and it changed, something new happened
        if (lastIdRef.current && latestId !== lastIdRef.current) {
          lastIdRef.current = latestId;
          // Refresh server components (re-fetches data without full reload)
          router.refresh();
        } else if (!lastIdRef.current) {
          lastIdRef.current = latestId;
        }
      } catch {
        // Silent fail — network issues shouldn't break the page
      }
    };

    const timer = setInterval(poll, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [interval, router]);

  // Renders nothing — invisible component
  return null;
}
