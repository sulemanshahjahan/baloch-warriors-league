"use client";

import { usePathname } from "next/navigation";
import { PublicNavbar } from "./navbar";
import { PublicFooter } from "./footer";

/**
 * Public chrome.
 *
 * Every public route gets the shared navbar + footer around a `<main>` landmark.
 * The landing page (`/`) is the exception: it ships its own header, drawer and
 * footer as part of the v2 design, so the shared chrome steps aside there and
 * the page supplies its own landmarks. Everything else in the public layout
 * (mobile tab bar, live refresh, presence, push prompts) is unaffected.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const isLanding = usePathname() === "/";

  if (isLanding) {
    return <div className="flex-1 pb-16 md:pb-0">{children}</div>;
  }

  return (
    <>
      <PublicNavbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <PublicFooter />
    </>
  );
}
