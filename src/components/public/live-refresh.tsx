"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * LiveRefresh — auto-refreshes the page when ANY admin change happens.
 *
 * Polls /api/last-updated every `interval` ms. When the latest
 * activity log ID changes, calls router.refresh() to re-fetch
 * all server components without a full page reload.
 *
 * Detects: player edits, tournament changes, match results,
 * enrollments, schedule generation — anything that writes to ActivityLog.
 */
export function LiveRefresh({ interval = 10000 }: { interval?: number }) {
  const router = useRouter();
  const lastIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;

      try {
        const res = await fetch("/api/last-updated");
        const data = await res.json();
        const currentId = data.id;

        if (!initializedRef.current) {
          // First poll — just record the current state
          lastIdRef.current = currentId;
          initializedRef.current = true;
          return;
        }

        if (currentId && currentId !== lastIdRef.current) {
          lastIdRef.current = currentId;
          router.refresh();
        }
      } catch {
        // Silent fail
      }
    };

    // First check after 2 seconds, then every `interval`
    const initial = setTimeout(poll, 2000);
    const timer = setInterval(poll, interval);

    return () => {
      mounted = false;
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [interval, router]);

  return null;
}
