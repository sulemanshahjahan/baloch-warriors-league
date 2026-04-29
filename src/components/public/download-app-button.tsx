"use client";

import { useEffect, useState } from "react";
import { Download, ChevronRight } from "lucide-react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.bwl.league";

export function DownloadAppButton({ variant }: { variant: "navbar-desktop" | "navbar-mobile" | "hero" }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Hide inside the BWL Android app — the user already has it.
    const inCapacitor = typeof window !== "undefined" && "Capacitor" in window;
    if (!inCapacitor) setShow(true);
  }, []);

  if (!show) return null;

  if (variant === "navbar-desktop") {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Download className="w-4 h-4" />
        Get App
      </a>
    );
  }

  if (variant === "navbar-mobile") {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2.5 mt-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Download className="w-4 h-4" />
        Get on Google Play
      </a>
    );
  }

  // hero
  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl bg-card/50 border border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">Get the BWL Android App</p>
          <p className="text-xs text-muted-foreground">Available on Google Play</p>
        </div>
      </div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors sm:ml-auto"
      >
        Get on Google Play
        <ChevronRight className="w-4 h-4" />
      </a>
    </div>
  );
}
