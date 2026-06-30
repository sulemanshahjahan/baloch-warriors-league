"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Pings /api/presence on navigation + every 60s while the tab is visible.
 * The endpoint records presence only for logged-in players; anonymous pings are
 * a cheap no-op. Mounted once in the public layout.
 */
export function PresenceHeartbeat() {
  const pathname = usePathname();
  const lastPing = useRef(0);

  useEffect(() => {
    const ping = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      lastPing.current = Date.now();
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    };

    ping();
    const iv = setInterval(ping, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPing.current > 30_000) ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
