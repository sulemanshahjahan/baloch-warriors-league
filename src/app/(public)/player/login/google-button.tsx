"use client";

import { useEffect, useRef, useState } from "react";

// On the website this is just a link to the OAuth start route. Inside the
// Capacitor app the OAuth flow happens in the EXTERNAL browser, whose cookie jar
// the webview can't read — so we generate a link token, open Google in the
// browser, then poll the server until the browser side records a successful
// login, at which point the poll response sets the session cookie HERE (in the
// webview's jar). No native rebuild required.
function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function GoogleLoginButton({ onError }: { onError?: (msg: string) => void }) {
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function startNative() {
    const lt = (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    const origin = window.location.origin;
    // Open Google in the system browser (Capacitor routes _blank externally).
    window.open(`${origin}/api/player/oauth/google?lt=${encodeURIComponent(lt)}`, "_blank");

    setWaiting(true);
    const startedAt = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        if (timer.current) clearInterval(timer.current);
        setWaiting(false);
        onError?.("Timed out waiting for Google. Please try again.");
        return;
      }
      try {
        const r = await fetch(`${origin}/api/player/oauth/poll?lt=${encodeURIComponent(lt)}`, { cache: "no-store" });
        const d = (await r.json()) as { ok?: boolean; slug?: string | null };
        if (d.ok) {
          if (timer.current) clearInterval(timer.current);
          window.location.href = d.slug ? `/players/${d.slug}` : "/";
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
  }

  function onClick(e: React.MouseEvent) {
    if (isNativeApp()) {
      e.preventDefault();
      if (!waiting) startNative();
    }
    // On the web, let the <a href> navigate normally.
  }

  return (
    <a
      href="/api/player/oauth/google"
      onClick={onClick}
      className="flex items-center justify-center gap-2 w-full border border-border rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors mb-3 aria-disabled:opacity-60"
      aria-disabled={waiting}
    >
      {waiting ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      {waiting ? "Waiting for Google… return to the app" : "Continue with Google"}
    </a>
  );
}
