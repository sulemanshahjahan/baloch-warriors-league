import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import type { NewsCard } from "../data";
import { EmptyState, SectionHeading } from "../section-heading";
import { ArrowRightIcon } from "../icons";

const dateStyle: React.CSSProperties = {
  fontSize: 12.5,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  fontFeatureSettings: "'tnum' 1",
  color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
};

function HeroPost({ post }: { post: NewsCard }) {
  return (
    <Link
      data-reveal="1"
      data-lift="1"
      href={`/news/${post.slug}`}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        minHeight: 420,
        padding: 30,
        borderRadius: 16,
        border: "1px solid color-mix(in srgb, var(--color-accent-700) 76%, transparent)",
        color: "inherit",
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--color-surface) 72%, transparent), transparent 90%)",
        transition:
          "transform .42s cubic-bezier(.2,.7,.2,1), box-shadow .42s ease, border-color .42s ease",
      }}
    >
      {post.coverUrl && (
        // Covers may be data URLs or CDN-hosted — plain <img> handles both.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to top, oklch(0.1 0.028 265) 2%, color-mix(in srgb, var(--color-bg) 88%, transparent) 38%, color-mix(in srgb, var(--color-bg) 46%, transparent) 62%, color-mix(in srgb, var(--crimson-deep) 34%, transparent) 96%)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 80% at 50% 108%, color-mix(in srgb, var(--crimson) 26%, transparent), transparent 62%)",
        }}
      />
      {post.publishedAt && (
        <span style={{ position: "relative", ...dateStyle }}>{formatDate(post.publishedAt)}</span>
      )}
      <h3
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "clamp(26px,3vw,42px)",
          lineHeight: 1.06,
          letterSpacing: "-.004em",
          textTransform: "uppercase",
          marginTop: 16,
          overflowWrap: "anywhere",
        }}
      >
        {post.title}
      </h3>
      {post.excerpt && (
        <span
          style={{
            position: "relative",
            display: "block",
            fontSize: 15.5,
            lineHeight: "27px",
            marginTop: 14,
            maxWidth: "52ch",
            color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
          }}
        >
          {post.excerpt}
        </span>
      )}
      <span
        data-arrow-host="1"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          marginTop: 20,
          fontSize: 13.5,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--color-accent)",
        }}
      >
        Read article
        <ArrowRightIcon size={14} style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }} />
      </span>
    </Link>
  );
}

function SidePost({ post, index }: { post: NewsCard; index: number }) {
  const accent = index === 0 ? "var(--color-accent)" : "var(--flame)";
  return (
    <Link
      data-reveal="1"
      data-delay={String(80 + index * 80)}
      data-lift="1"
      href={`/news/${post.slug}`}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        padding: "22px 22px 26px",
        borderRadius: 16,
        border: "1px solid var(--color-divider)",
        color: "inherit",
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--color-surface) 72%, transparent), transparent 90%)",
        transition:
          "transform .42s cubic-bezier(.2,.7,.2,1), box-shadow .42s ease, border-color .42s ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 22,
          right: 22,
          height: 1,
          background: "linear-gradient(to right,var(--color-accent-700),transparent)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: 108,
          marginBottom: 18,
          borderRadius: 11,
          overflow: "hidden",
          background: `linear-gradient(120deg, color-mix(in srgb, ${accent} 34%, transparent), color-mix(in srgb, var(--color-surface) 82%, transparent) 62%, transparent)`,
        }}
      >
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.55,
            }}
          />
        ) : (
          <Image
            src="/logo.png"
            alt=""
            width={160}
            height={190}
            style={{
              position: "absolute",
              top: "50%",
              right: 14,
              transform: "translateY(-50%)",
              height: "132%",
              width: "auto",
              opacity: 0.5,
            }}
          />
        )}
        <span
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(100deg, color-mix(in srgb, var(--color-bg) 76%, transparent), transparent 78%)",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.34,
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--color-text) 20%, transparent) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            mask: "linear-gradient(to right, black, transparent 72%)",
            WebkitMask: "linear-gradient(to right, black, transparent 72%)",
          }}
        />
      </span>
      {post.publishedAt && (
        <span
          style={{
            ...dateStyle,
            color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
          }}
        >
          {formatDate(post.publishedAt)}
        </span>
      )}
      <h3
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 25,
          lineHeight: 1.14,
          textTransform: "uppercase",
          marginTop: 14,
          overflowWrap: "anywhere",
        }}
      >
        {post.title}
      </h3>
      {post.excerpt && (
        <span
          style={{
            display: "block",
            fontSize: 15,
            lineHeight: "26px",
            marginTop: 11,
            color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
          }}
        >
          {post.excerpt}
        </span>
      )}
    </Link>
  );
}

export function LatestNews({ news }: { news: NewsCard[] }) {
  const [hero, ...rest] = news;

  return (
    <section
      id="news"
      data-band="1"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        background:
          "radial-gradient(860px 480px at 16% 98%, color-mix(in srgb, var(--color-accent-900) 40%, transparent), transparent 64%)",
        padding: "clamp(48px,5.5vw,80px) clamp(20px,4vw,56px)",
      }}
    >
      <SectionHeading kicker="From the league" title="Latest news" href="/news" linkLabel="All news" />

      <div style={{ marginTop: "clamp(30px,3.4vw,44px)" }}>
        {!hero ? (
          <EmptyState>No announcements published yet.</EmptyState>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: rest.length
                ? "repeat(auto-fit,minmax(min(100%,340px),1fr))"
                : "minmax(0,1fr)",
              gap: "clamp(18px,2.4vw,28px)",
              alignItems: "stretch",
            }}
          >
            <HeroPost post={hero} />
            {rest.length > 0 && (
              <div style={{ display: "grid", gap: "clamp(18px,2.4vw,28px)", alignContent: "stretch" }}>
                {rest.map((p, i) => (
                  <SidePost key={p.id} post={p} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
