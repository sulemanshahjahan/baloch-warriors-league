import Link from "next/link";
import Image from "next/image";
import { avatarSrc, type ManagerCard } from "../data";
import { BandRule, Kicker } from "../section-heading";
import { ArrowRightIcon } from "../icons";

const statNum: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 18,
  fontFeatureSettings: "'tnum' 1",
};
const statCap: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: ".15em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
};

export function Managers({ managers }: { managers: ManagerCard[] }) {
  if (managers.length === 0) return null;

  return (
    <section
      id="managers"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        padding: "clamp(40px,4.5vw,64px) clamp(20px,4vw,56px)",
      }}
    >
      <BandRule />
      <div style={{ marginTop: "clamp(38px,4.4vw,60px)" }}>
        <Kicker>The men behind the league</Kicker>
        <h2
          data-reveal="1"
          data-delay="60"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(34px,4.4vw,64px)",
            letterSpacing: "-.008em",
            lineHeight: 1.02,
            textTransform: "uppercase",
            margin: "20px 0 0 -.025em",
          }}
        >
          BWL Managers
        </h2>
      </div>

      <div
        data-mgr-rail="1"
        style={{
          marginTop: "clamp(30px,3.4vw,44px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,318px),1fr))",
          gap: "clamp(16px,2vw,24px)",
        }}
      >
        {managers.map((m, i) => (
          <div
            key={m.id}
            data-reveal="1"
            data-delay={i === 0 ? undefined : String(i * 80)}
            data-lift="1"
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "26px 22px",
              borderRadius: 15,
              border: "1px solid var(--color-divider)",
              background:
                "linear-gradient(166deg, color-mix(in srgb, var(--color-surface) 74%, transparent), transparent 90%)",
              transition:
                "transform .4s cubic-bezier(.2,.7,.2,1), box-shadow .4s ease, border-color .4s ease",
            }}
          >
            <Image
              src="/logo.png"
              alt=""
              aria-hidden="true"
              width={178}
              height={210}
              style={{
                position: "absolute",
                top: "-14%",
                right: "-8%",
                width: 178,
                height: "auto",
                pointerEvents: "none",
                opacity: 0.075,
              }}
            />
            <span style={{ position: "relative", flex: "none" }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -7,
                  borderRadius: "50%",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 48%, transparent)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc("player", m.id, 128)}
                alt=""
                loading="lazy"
                decoding="async"
                width={82}
                height={82}
                style={{
                  display: "block",
                  width: 82,
                  height: 82,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            </span>

            <span
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 9,
                minWidth: 0,
                flex: "1 1 0",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: ".01em",
                  textTransform: "uppercase",
                  overflowWrap: "anywhere",
                }}
              >
                {m.name}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <span
                  style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}
                >
                  <span
                    className="tag tag-outline"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: ".16em",
                      borderColor: "color-mix(in srgb, var(--color-accent) 42%, transparent)",
                      color: "var(--color-accent-300)",
                    }}
                  >
                    {m.role}
                  </span>
                </span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 7,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={statNum}>{m.tournaments}</span>
                    <span style={statCap}>Tours</span>
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 7,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={statNum}>{m.matches}</span>
                    <span style={statCap}>Matches</span>
                  </span>
                </span>
              </span>
              <Link
                data-arrow-host="1"
                href={`/players/${m.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 2,
                  fontSize: 13,
                  letterSpacing: ".13em",
                  textTransform: "uppercase",
                }}
              >
                Profile
                <ArrowRightIcon
                  size={13}
                  style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
                />
              </Link>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
