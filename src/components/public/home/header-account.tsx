"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Me {
  id: string;
  name: string;
  slug: string;
  coins: number;
  legacyLevel: number;
}

const CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  padding: "4px 10px 4px 4px",
  borderRadius: 999,
  color: "inherit",
  fontSize: 14.5,
  whiteSpace: "nowrap",
  border: "1px solid transparent",
  transition: "border-color .3s ease, background .3s ease",
};

/**
 * Points balance + profile chip in the landing header.
 *
 * Read on the client from /api/me so the landing page itself stays statically
 * revalidated (touching cookies server-side would force it dynamic).
 * `variant="drawer"` renders the same data laid out for the slide-in panel.
 */
export function HeaderAccount({ variant = "header" }: { variant?: "header" | "drawer" }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => alive && setMe(d.player ?? null))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, []);

  // Loading — hold the row's height so the header doesn't jump when it lands.
  if (me === undefined) {
    return <span aria-hidden="true" style={{ display: "inline-block", height: 38 }} />;
  }

  const headerOnly = variant === "header" ? "1" : undefined;

  if (!me) {
    return (
      <Link
        href="/player/login"
        data-hv="profile-chip"
        data-header-collapse={headerOnly}
        style={{ ...CHIP, padding: "8px 15px", border: "1px solid var(--color-divider)" }}
      >
        Sign in
      </Link>
    );
  }

  const points = (
    <span
      data-header-collapse={headerOnly}
      title="BWL points balance"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 13px",
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--gold) 32%, transparent)",
        background: "color-mix(in srgb, var(--gold) 7%, transparent)",
        fontSize: 14.5,
        fontFeatureSettings: "'tnum' 1",
        whiteSpace: "nowrap",
        color: "var(--color-text)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--gold)",
          boxShadow: "0 0 9px var(--gold)",
        }}
      />
      {me.coins.toLocaleString("en-US")}
    </span>
  );

  const profile = (
    <Link
      href="/player/account"
      data-hv="profile-chip"
      data-header-collapse={headerOnly}
      style={CHIP}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/image?type=player&id=${me.id}&size=64`}
        alt=""
        width={30}
        height={30}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid var(--color-accent-600)",
        }}
      />
      <span>{me.name}</span>
    </Link>
  );

  return (
    <>
      {points}
      {profile}
    </>
  );
}
