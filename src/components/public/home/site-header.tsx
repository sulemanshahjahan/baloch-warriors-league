"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchDialog } from "@/components/public/search-dialog";
import { PushNotificationButton } from "@/components/public/push-notification-button";
import { HeaderAccount } from "./header-account";
import { ArrowRightIcon, CloseIcon, DownloadIcon, SearchIcon } from "./icons";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.bwl.league";

/** Same destinations as the shared public navbar, grouped the way v2 presents them. */
const LEAGUE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/matches", label: "Matches" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/rankings", label: "Rankings" },
  { href: "/stats", label: "Stats" },
];
const COMMUNITY_LINKS = [
  { href: "/legacy", label: "Legacy" },
  { href: "/store", label: "Store" },
  { href: "/raffles", label: "Raffles" },
  { href: "/news", label: "News" },
  { href: "/wall", label: "Wall" },
];

const DRAWER_LINKS = [...LEAGUE_LINKS, ...COMMUNITY_LINKS];

const iconBtn: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  borderRadius: 9,
  cursor: "pointer",
  border: "1px solid var(--color-divider)",
  background: "color-mix(in srgb, var(--color-surface) 50%, transparent)",
  color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
  transition: "border-color .3s ease, color .3s ease, background .3s ease",
};

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 15, margin: "0 0 4px" }}>
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 1,
          flex: "none",
          background: "linear-gradient(to right,var(--color-accent),transparent)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 11.5,
          letterSpacing: ".26em",
          textTransform: "uppercase",
          color: "var(--color-accent)",
        }}
      >
        {children}
      </span>
    </span>
  );
}

function DrawerLink({
  href,
  label,
  index,
  open,
  onNavigate,
}: {
  href: string;
  label: string;
  index: number;
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      data-drawer-link="1"
      onClick={onNavigate}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "clamp(16px,2.6vw,26px)",
        padding: "15px 2px",
        overflow: "hidden",
        color: "inherit",
        borderBottom: "1px solid color-mix(in srgb, var(--color-divider) 52%, transparent)",
        opacity: open ? 1 : 0,
        transform: open ? "none" : "translateX(30px)",
        transition: "opacity .5s ease, transform .62s cubic-bezier(.16,.84,.24,1)",
        transitionDelay: open ? `${130 + index * 42}ms` : "0ms",
      }}
    >
      <span
        data-link-sweep="1"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0,
          transform: "translateX(-14%)",
          transition: "opacity .44s ease, transform .52s cubic-bezier(.2,.7,.2,1)",
          background:
            "linear-gradient(96deg, color-mix(in srgb, var(--color-accent-900) 82%, transparent), color-mix(in srgb, var(--crimson-deep) 34%, transparent) 52%, transparent 88%)",
        }}
      />
      <span
        data-link-edge="1"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: "10%",
          bottom: "10%",
          width: 2,
          borderRadius: 2,
          transform: "scaleY(0)",
          transformOrigin: "center",
          transition: "transform .44s cubic-bezier(.2,.7,.2,1)",
          background: "linear-gradient(to bottom,var(--crimson),var(--color-accent),var(--flame))",
          boxShadow: "0 0 14px color-mix(in srgb, var(--color-accent) 70%, transparent)",
        }}
      />
      <span
        data-link-num="1"
        aria-hidden="true"
        style={{
          position: "relative",
          flex: "none",
          width: 28,
          fontSize: 11.5,
          letterSpacing: ".18em",
          fontFeatureSettings: "'tnum' 1",
          transition: "color .36s ease",
          color: "color-mix(in srgb, var(--color-text) 42%, transparent)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        data-link-text="1"
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "clamp(26px,4.6vw,46px)",
          lineHeight: 1,
          letterSpacing: ".012em",
          textTransform: "uppercase",
          transition: "transform .46s cubic-bezier(.2,.7,.2,1), color .36s ease",
          color: "color-mix(in srgb, var(--color-text) 94%, transparent)",
        }}
      >
        {label}
      </span>
      <span
        data-link-arrow="1"
        aria-hidden="true"
        style={{
          position: "relative",
          marginLeft: "auto",
          display: "flex",
          color: "var(--color-accent)",
          opacity: 0,
          transform: "translateX(-14px)",
          transition: "opacity .4s ease, transform .46s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <ArrowRightIcon size={19} />
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // keeps the panel in the DOM while it slides out
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount first, flip `open` on the next frame so the panel actually transitions
  // in from its off-screen transform; unmount only once the slide-out finishes.
  const openDrawer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setMounted(true);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setMounted(false), 700);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Scroll lock + focus handling while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 220);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>("a[href], button"),
      ].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      html.style.overflow = prev;
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const bar: React.CSSProperties = {
    position: "absolute",
    left: 0,
    height: 1.6,
    borderRadius: 2,
    background: "currentColor",
    transition:
      "transform .46s cubic-bezier(.2,.7,.2,1), opacity .3s ease, width .46s cubic-bezier(.2,.7,.2,1)",
  };

  return (
    <>
      <header
        data-header="1"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 70,
          transition: "background .4s ease, box-shadow .4s ease, border-color .4s ease",
          background: "color-mix(in srgb, var(--color-bg) 62%, transparent)",
          backdropFilter: "blur(22px) saturate(1.35)",
          WebkitBackdropFilter: "blur(22px) saturate(1.35)",
          borderBottom: "1px solid color-mix(in srgb, var(--color-divider) 60%, transparent)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background:
              "linear-gradient(to right,transparent,color-mix(in srgb, var(--crimson) 70%, transparent) 14%,var(--color-accent) 44%,var(--flame) 56%,color-mix(in srgb, var(--crimson) 70%, transparent) 86%,transparent)",
          }}
        />
        <div
          data-headrow="1"
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "14px clamp(20px,4vw,56px)",
            display: "flex",
            alignItems: "center",
            gap: "clamp(16px,3vw,32px)",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 13, color: "inherit", flex: "none" }}
          >
            <Image
              src="/logo.png"
              alt="Baloch Warriors League"
              width={34}
              height={40}
              priority
              style={{ width: 34, height: 40, objectFit: "contain", flex: "none" }}
            />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: ".07em",
                  color: "var(--color-accent)",
                }}
              >
                BWL
              </span>
              <span
                data-brand-sub="1"
                style={{
                  fontSize: 11.5,
                  letterSpacing: ".19em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color: "color-mix(in srgb, var(--color-text) 62%, transparent)",
                }}
              >
                Baloch Warriors League
              </span>
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <SearchDialog
              renderTrigger={(openSearch) => (
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label="Search players, teams and tournaments"
                  data-hv="icon-btn"
                  style={iconBtn}
                >
                  <SearchIcon size={16} />
                </button>
              )}
            />
            <PushNotificationButton className="bwl2-icon-btn" iconClassName="w-4 h-4" />

            <HeaderAccount />

            <a
              data-shine="1"
              data-hv="cta"
              className="btn btn-primary"
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "9px 17px",
                fontSize: 14.5,
                letterSpacing: ".03em",
                whiteSpace: "nowrap",
                transition:
                  "transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .3s ease, background .3s ease",
              }}
            >
              <DownloadIcon size={14} />
              <span data-cta-label="1">Get App</span>
            </a>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => (open ? close() : openDrawer())}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="bwl2-drawer"
              data-hv="menu"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                height: 40,
                padding: "0 17px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: "var(--color-text)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)",
                background:
                  "linear-gradient(150deg, color-mix(in srgb, var(--color-accent-900) 72%, transparent), transparent 84%)",
                boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--flame) 16%, transparent)",
                transition:
                  "transform .34s cubic-bezier(.2,.7,.2,1), border-color .34s ease, box-shadow .34s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{ position: "relative", display: "block", width: 18, height: 12, flex: "none" }}
              >
                <span
                  style={{
                    ...bar,
                    top: 0,
                    width: "100%",
                    transform: open ? "translateY(5.2px) rotate(45deg)" : undefined,
                  }}
                />
                <span
                  style={{
                    ...bar,
                    top: "50%",
                    marginTop: -0.8,
                    width: open ? "0%" : "64%",
                    opacity: open ? 0 : 1,
                  }}
                />
                <span
                  style={{
                    ...bar,
                    bottom: 0,
                    width: "100%",
                    transform: open ? "translateY(-5.2px) rotate(-45deg)" : undefined,
                  }}
                />
              </span>
              <span data-menu-label="1">Menu</span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="bwl2-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="BWL navigation"
        style={{ position: "fixed", inset: 0, zIndex: 90, display: mounted ? "block" : "none" }}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
          style={{
            position: "absolute",
            inset: 0,
            border: 0,
            padding: 0,
            cursor: "default",
            opacity: open ? 1 : 0,
            transition: "opacity .55s ease",
            background:
              "radial-gradient(1000px 700px at 84% 8%, color-mix(in srgb, var(--crimson-deep) 46%, transparent), transparent 62%), color-mix(in srgb, oklch(0.08 0.016 264) 76%, transparent)",
            backdropFilter: "blur(9px) saturate(1.15)",
            WebkitBackdropFilter: "blur(9px) saturate(1.15)",
          }}
        />

        <div
          ref={panelRef}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(640px,100%)",
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
            overflowY: "auto",
            transform: open ? "none" : "translateX(101%)",
            transition: "transform .66s cubic-bezier(.16,.84,.24,1)",
            background:
              "linear-gradient(198deg, oklch(0.222 0.058 22) 0%, oklch(0.163 0.032 262) 44%, oklch(0.128 0.022 264) 100%)",
            boxShadow: "-40px 0 120px rgba(0,0,0,.72)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 1,
              background:
                "linear-gradient(to bottom,transparent,var(--crimson) 12%,var(--color-accent) 42%,var(--flame) 58%,var(--crimson) 86%,transparent)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-14%",
              right: "-18%",
              width: "76%",
              aspectRatio: "1",
              pointerEvents: "none",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 26%, transparent), transparent 64%)",
              filter: "blur(30px)",
              animation: "bwl-drawer-glow 13s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.1,
              backgroundImage:
                "linear-gradient(to right, color-mix(in srgb, var(--color-text) 30%, transparent) 1px, transparent 1px),linear-gradient(to bottom, color-mix(in srgb, var(--color-text) 30%, transparent) 1px, transparent 1px)",
              backgroundSize: "58px 58px",
              mask: "radial-gradient(120% 80% at 100% 0%, black, transparent 72%)",
              WebkitMask: "radial-gradient(120% 80% at 100% 0%, black, transparent 72%)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "44%",
              left: "-4%",
              pointerEvents: "none",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "min(30vw,220px)",
              lineHeight: 0.8,
              letterSpacing: "-.02em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--color-text) 3.4%, transparent)",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            BWL
          </span>

          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: "100%",
              padding: "clamp(22px,3vw,32px) clamp(24px,4vw,52px) clamp(26px,3vw,36px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                paddingBottom: "clamp(24px,3vw,34px)",
              }}
            >
              <Image
                src="/logo.png"
                alt=""
                width={30}
                height={36}
                style={{ width: 30, height: 36, objectFit: "contain", flex: "none" }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.1 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 19,
                    letterSpacing: ".07em",
                    color: "var(--color-accent)",
                  }}
                >
                  BWL
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    letterSpacing: ".22em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-text) 56%, transparent)",
                  }}
                >
                  Baloch Warriors League
                </span>
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close menu"
                data-hv="drawer-close"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 11,
                  marginLeft: "auto",
                  height: 40,
                  padding: "0 15px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 82%, transparent)",
                  border: "1px solid var(--color-divider)",
                  background: "color-mix(in srgb, var(--color-surface) 42%, transparent)",
                  transition:
                    "border-color .3s ease, color .3s ease, transform .3s cubic-bezier(.2,.7,.2,1)",
                }}
              >
                <CloseIcon size={13} />
                Close
              </button>
            </div>

            <GroupLabel>League</GroupLabel>
            <nav
              aria-label="League"
              style={{ display: "flex", flexDirection: "column", margin: "0 0 34px" }}
            >
              {LEAGUE_LINKS.map((l) => (
                <DrawerLink
                  key={l.href}
                  {...l}
                  index={DRAWER_LINKS.findIndex((d) => d.href === l.href)}
                  open={open}
                  onNavigate={close}
                />
              ))}
            </nav>

            <GroupLabel>Community</GroupLabel>
            <nav
              aria-label="Community"
              style={{ display: "flex", flexDirection: "column", margin: "0 0 34px" }}
            >
              {COMMUNITY_LINKS.map((l) => (
                <DrawerLink
                  key={l.href}
                  {...l}
                  index={DRAWER_LINKS.findIndex((d) => d.href === l.href)}
                  open={open}
                  onNavigate={close}
                />
              ))}
            </nav>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(to right,transparent,var(--color-divider) 12%,var(--color-divider) 88%,transparent)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <HeaderAccount variant="drawer" />
                <a
                  data-shine="1"
                  data-hv="drawer-cta"
                  className="btn btn-primary"
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    marginLeft: "auto",
                    padding: "12px 20px",
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 13.5,
                    letterSpacing: ".13em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    borderColor: "var(--color-accent-600)",
                    transition: "transform .32s cubic-bezier(.2,.7,.2,1), box-shadow .32s ease",
                  }}
                >
                  <DownloadIcon size={15} />
                  Get the app
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 11.5,
                    letterSpacing: ".22em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-accent) 86%, transparent)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 26, height: 1, background: "var(--color-accent)" }}
                  />
                  Compete · Conquer · Become legend
                </span>
                <Link
                  href="/admin"
                  onClick={close}
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  }}
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
