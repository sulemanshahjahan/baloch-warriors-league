"use client";

import { useEffect, useState } from "react";
import { Download, ChevronRight } from "lucide-react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.bwl.league";

export function DownloadAppButton({
  variant,
}: {
  variant: "navbar-desktop" | "navbar-mobile" | "hero" | "landing";
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Hide inside the BWL Android app — the user already has it.
    const inCapacitor = typeof window !== "undefined" && "Capacitor" in window;
    if (!inCapacitor) setShow(true);
  }, []);

  if (!show) return null;

  // v2 landing "Get app" band — styled by the landing design system, so it only
  // carries layout here and inherits colour from the surrounding `.bwl2` scope.
  if (variant === "landing") {
    return (
      <a
        data-shine="1"
        data-hv="app-cta"
        className="btn btn-primary"
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: 30,
          padding: "16px 26px",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: ".11em",
          textTransform: "uppercase",
          color: "var(--color-text)",
          borderColor: "color-mix(in srgb, var(--color-text) 52%, transparent)",
          transition:
            "transform .34s cubic-bezier(.2,.7,.2,1), border-color .34s ease, box-shadow .34s ease, background .34s ease",
        }}
      >
        <svg
          viewBox="0 0 256 256"
          fill="none"
          stroke="currentColor"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: 17, height: 17 }}
        >
          <path d="M128 32v120M84 108l44 44 44-44M40 200h176" />
        </svg>
        Get on Google Play
      </a>
    );
  }

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
    <div className="mt-8 inline-flex w-full sm:w-auto flex-col sm:flex-row sm:items-center gap-3 p-3 sm:pr-4 rounded-2xl bg-gradient-to-r from-primary/12 via-card/60 to-card/40 border border-primary/20 shadow-lg shadow-primary/5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-primary/15 border border-primary/25">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm font-bold">Get the BWL Android App</p>
          <p className="text-xs text-muted-foreground">Tournaments, matches &amp; stats on the go</p>
        </div>
      </div>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors sm:ml-2 whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        Google Play
        <ChevronRight className="w-4 h-4 -ml-0.5" />
      </a>
    </div>
  );
}
