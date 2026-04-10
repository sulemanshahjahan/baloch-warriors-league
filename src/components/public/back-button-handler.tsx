"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Handles the Android hardware back button in Capacitor.
 * Goes back in browser history instead of exiting the app.
 * Only exits when there's no more history (user is on first page).
 */
export function BackButtonHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("Capacitor" in window)) return;

    import("@capacitor/app").then(({ App }) => {
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    }).catch(() => {});
  }, [router]);

  return null;
}
