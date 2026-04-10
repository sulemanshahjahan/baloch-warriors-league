"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * LiveRefresh — auto-refreshes the page when ANY admin change happens.
 *
 * Polls /api/last-updated every `interval` ms. When the latest
 * activity log ID changes, calls router.refresh() to re-fetch
 * all server components without a full page reload.
 *
 * Optimizations:
 * - Pauses polling when the tab/app is not visible (saves battery on mobile)
 * - Server caches the DB query for 5s (prevents DB hammering)
 * - Default interval is 30s (100 users = ~200 req/min to endpoint, ~12 DB queries/min)
 */
export function LiveRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();
  const lastIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const visibleRef = useRef(true);

  const poll = useCallback(async () => {
    if (!visibleRef.current) return;

    try {
      const res = await fetch("/api/last-updated");
      const data = await res.json();
      const currentId = data.id;

      if (!initializedRef.current) {
        lastIdRef.current = currentId;
        initializedRef.current = true;
        return;
      }

      if (currentId && currentId !== lastIdRef.current) {
        lastIdRef.current = currentId;
        router.refresh();
      }
    } catch {
      // Silent fail — will retry on next interval
    }
  }, [router]);

  useEffect(() => {
    const onVisibilityChange = () => {
      visibleRef.current = document.visibilityState === "visible";
      // Poll immediately when tab becomes visible again
      if (visibleRef.current && initializedRef.current) poll();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const initial = setTimeout(poll, 2000);
    const timer = setInterval(poll, interval);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [interval, poll]);

  return null;
}
