import Link from "next/link";
import { ArrowRightIcon } from "./icons";

/** Thin rule + eyebrow used above every band title. */
export function Kicker({
  children,
  color = "var(--color-accent)",
  as: As = "span",
  id,
}: {
  children: React.ReactNode;
  color?: string;
  as?: "span" | "h3";
  id?: string;
}) {
  return (
    <As
      id={id}
      data-reveal="1"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 15,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: 13.5,
        letterSpacing: ".24em",
        textTransform: "uppercase",
        margin: 0,
        color,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 52,
          height: 1,
          flex: "none",
          background: `linear-gradient(to right,transparent,${color})`,
        }}
      />
      {children}
    </As>
  );
}

/** Band header: eyebrow + display title, with an optional "view all" link. */
export function SectionHeading({
  kicker,
  title,
  href,
  linkLabel,
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 26,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Kicker>{kicker}</Kicker>
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
          {title}
        </h2>
      </div>
      {href && (
        <Link
          data-arrow-host="1"
          className="btn btn-ghost"
          href={href}
          data-reveal="1"
          data-delay="100"
          style={{
            padding: "8px 4px",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          {linkLabel ?? "View all"}
          <ArrowRightIcon
            size={14}
            style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
          />
        </Link>
      )}
    </div>
  );
}

/** Fading hairline the design uses to separate bands. */
export function BandRule({ marginTop = 0 }: { marginTop?: number | string }) {
  return (
    <div
      style={{
        height: 1,
        marginTop,
        background:
          "linear-gradient(to right,transparent,var(--color-divider) 48px,var(--color-divider) calc(100% - 48px),transparent)",
      }}
    />
  );
}

/** Consistent "nothing here yet" block, styled in the band's own language. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-reveal="1"
      style={{
        padding: "34px 24px",
        borderRadius: 15,
        border: "1px dashed var(--color-divider)",
        background: "color-mix(in srgb, var(--color-surface) 34%, transparent)",
        fontSize: 15,
        textAlign: "center",
        color: "color-mix(in srgb, var(--color-text) 62%, transparent)",
      }}
    >
      {children}
    </p>
  );
}
