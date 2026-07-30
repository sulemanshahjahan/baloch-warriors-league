import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from "./icons";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.bwl.league";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "League",
    links: [
      { href: "/tournaments", label: "Tournaments" },
      { href: "/matches", label: "Matches" },
      { href: "/players", label: "Players" },
      { href: "/teams", label: "Teams" },
      { href: "/rankings", label: "Rankings" },
      { href: "/stats", label: "Stats" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/legacy", label: "Legacy" },
      { href: "/store", label: "Store" },
      { href: "/raffles", label: "Raffles" },
      { href: "/news", label: "News" },
      { href: "/wall", label: "Wall" },
    ],
  },
];

const colHeading: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
};
const colLink: React.CSSProperties = {
  color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
};
const socialBtn: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--color-divider)",
  color: "color-mix(in srgb, var(--color-text) 74%, transparent)",
  transition: "border-color .3s ease, color .3s ease, transform .3s cubic-bezier(.2,.7,.2,1)",
};

export function SiteFooter() {
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        borderTop: "1px solid color-mix(in srgb, var(--color-accent-700) 62%, transparent)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-accent-900) 46%, transparent), transparent 34%), var(--color-bg)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -1,
          left: 0,
          right: 0,
          height: 130,
          pointerEvents: "none",
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 72%)",
        }}
      />
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={475}
        style={{
          position: "absolute",
          bottom: "-16%",
          right: "2%",
          width: "min(400px,44%)",
          height: "auto",
          pointerEvents: "none",
          opacity: 0.05,
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(48px,5.5vw,76px) clamp(20px,4vw,56px) 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))",
          gap: "clamp(28px,3.4vw,56px)",
        }}
      >
        <div style={{ gridColumn: "span 2", minWidth: 0, maxWidth: 400 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 13, color: "inherit" }}>
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={38}
              style={{ width: 32, height: 38, objectFit: "contain" }}
            />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 21,
                  letterSpacing: ".07em",
                  color: "var(--color-accent)",
                }}
              >
                BWL
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  letterSpacing: ".19em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
                }}
              >
                Baloch Warriors League
              </span>
            </span>
          </Link>
          <p
            style={{
              fontSize: 15,
              lineHeight: "26px",
              margin: "20px 0 0",
              color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
            }}
          >
            The official digital home of the Baloch Warriors League — tournaments, matches, rankings
            and records across five competitive titles.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <Link href="/news" aria-label="BWL news and announcements" data-hv="social" style={socialBtn}>
              <WhatsAppIcon size={17} />
            </Link>
            <Link href="/wall" aria-label="BWL community wall" data-hv="social" style={socialBtn}>
              <YouTubeIcon size={17} />
            </Link>
            <Link href="/legacy" aria-label="BWL legacy" data-hv="social" style={socialBtn}>
              <InstagramIcon size={17} />
            </Link>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <nav
            key={col.heading}
            aria-label={col.heading}
            style={{ display: "flex", flexDirection: "column", gap: 13, fontSize: 15.5 }}
          >
            <span style={colHeading}>{col.heading}</span>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} data-hv="foot-link" style={colLink}>
                {l.label}
              </Link>
            ))}
          </nav>
        ))}

        <nav
          aria-label="App"
          style={{ display: "flex", flexDirection: "column", gap: 13, fontSize: 15.5 }}
        >
          <span style={colHeading}>App</span>
          <a
            data-arrow-host="1"
            data-hv="foot-link"
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...colLink, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Google Play
            <ArrowRightIcon
              size={13}
              style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
            />
          </a>
          <Link href="/matches" data-hv="foot-link" style={colLink}>
            Match alerts
          </Link>
          <Link href="/players" data-hv="foot-link" style={colLink}>
            Player profiles
          </Link>
          <Link href="/privacy" data-hv="foot-link" style={colLink}>
            Privacy
          </Link>
        </nav>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 clamp(20px,4vw,56px)",
        }}
      >
        <div
          style={{
            height: 1,
            marginTop: "clamp(38px,4vw,56px)",
            background:
              "linear-gradient(to right,transparent,var(--color-divider) 48px,var(--color-divider) calc(100% - 48px),transparent)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: "22px 0 30px",
            fontSize: 14,
            color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
          }}
        >
          <span style={{ fontFeatureSettings: "'tnum' 1" }}>
            © {new Date().getFullYear()} Baloch Warriors League
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--color-accent) 82%, transparent)",
            }}
          >
            Built for the warriors
          </span>
        </div>
      </div>
    </footer>
  );
}
