"use client";

import { useEffect } from "react";

/**
 * Behaviour layer for the v2 landing page — a direct port of the design's
 * runtime script. Everything here is progressive enhancement: the page is fully
 * readable and navigable with JS off, and every effect short-circuits under
 * `prefers-reduced-motion`.
 *
 * Design defaults: motion 8/10, atmosphere 7/10.
 */
const MOTION_LEVEL: number = 8;
const ATMOSPHERE: number = 7;
const EASE = "cubic-bezier(.2,.7,.2,1)";

export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById("bwl2");
    if (!root) return;

    const cleanups: (() => void)[] = [];
    const on = <K extends keyof WindowEventMap>(
      el: EventTarget,
      ev: K | string,
      fn: EventListenerOrEventListenerObject,
      opt?: AddEventListenerOptions,
    ) => {
      el.addEventListener(ev, fn, opt);
      cleanups.push(() => el.removeEventListener(ev, fn));
    };

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = reduce || MOTION_LEVEL === 0;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

    /* ---- atmosphere dial ---- */
    const grain = root.querySelector<HTMLElement>('[data-atmo="grain"]');
    if (grain) grain.style.opacity = String(0.062 * (ATMOSPHERE / 10));
    root
      .querySelectorAll<HTMLElement>('[data-atmo="ray"],[data-atmo="smoke"],[data-atmo="spot"]')
      .forEach((el) => {
        el.style.opacity = String(
          Math.max(
            0.06,
            (parseFloat(getComputedStyle(el).opacity) || 1) * (0.3 + 0.7 * (ATMOSPHERE / 10)),
          ),
        );
      });

    /* ---- drifting embers (count follows the atmosphere dial) ---- */
    const seedParticles = (host: HTMLElement, n: number, color: string, size: number) => {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const p = document.createElement("span");
        const d = size + Math.random() * size;
        p.style.cssText = `position:absolute;left:${8 + Math.random() * 84}%;bottom:${-6 + Math.random() * 34}%;width:${d}px;height:${d}px;border-radius:50%;background:${color};box-shadow:0 0 ${d * 3}px ${color};opacity:0;animation:bwl-drift ${11 + Math.random() * 13}s linear ${Math.random() * 12}s infinite`;
        frag.appendChild(p);
      }
      host.appendChild(frag);
      cleanups.push(() => {
        host.querySelectorAll("span").forEach((s) => s.remove());
      });
    };
    if (!still && ATMOSPHERE > 0) {
      const hero = root.querySelector<HTMLElement>('[data-particles="hero"]');
      const gold = root.querySelector<HTMLElement>('[data-particles="gold"]');
      if (hero) seedParticles(hero, Math.round(4 + ATMOSPHERE * 0.9), "var(--flame)", 1.6);
      if (gold) seedParticles(gold, Math.round(3 + ATMOSPHERE * 0.7), "var(--gold)", 1.4);
    }

    /* ---- header solidity + lighting parallax on scroll ---- */
    const header = root.querySelector<HTMLElement>("[data-header]");
    const lighting = root.querySelector<HTMLElement>("[data-scroll-lighting]");
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = scrollY;
        if (header) {
          const past = y > 8;
          header.style.background = `color-mix(in srgb, var(--color-bg) ${past ? 90 : 62}%, transparent)`;
          header.style.boxShadow = past ? "0 16px 44px rgba(0,0,0,.5)" : "none";
          header.style.borderBottomColor = past
            ? "var(--color-divider)"
            : "color-mix(in srgb, var(--color-divider) 60%, transparent)";
        }
        if (lighting && !still) {
          lighting.style.transform = `translate3d(${Math.sin(y / 1400) * 60}px, ${y * 0.045}px, 0)`;
          lighting.style.opacity = String(Math.max(0.25, 1 - y / 3600));
        }
      });
    };
    onScroll();
    on(window, "scroll", onScroll, { passive: true });

    /* ---- arrow nudge on links ---- */
    root.querySelectorAll<HTMLElement>("[data-arrow], [data-arrow-host]").forEach((host) => {
      const target = host.closest("a") ?? host;
      const svg = host.querySelector("svg");
      if (!svg) return;
      on(target, "pointerenter", () => {
        svg.style.transform = "translateX(5px)";
      });
      on(target, "pointerleave", () => {
        svg.style.transform = "";
      });
    });

    /* ---- button sheen ---- */
    if (!still) {
      root.querySelectorAll<HTMLElement>("[data-shine]").forEach((btn) => {
        const sheen = document.createElement("span");
        sheen.setAttribute("aria-hidden", "true");
        sheen.style.cssText =
          "position:absolute;top:0;bottom:0;left:0;width:38%;pointer-events:none;background:linear-gradient(100deg,transparent,color-mix(in srgb, var(--color-text) 26%, transparent),transparent);transform:translateX(-170%) skewX(-18deg);opacity:0";
        btn.appendChild(sheen);
        cleanups.push(() => sheen.remove());
        on(btn, "pointerenter", () => {
          sheen.style.opacity = "1";
          sheen.style.animation = "none";
          void sheen.offsetWidth;
          sheen.style.animation = "bwl-shine .95s cubic-bezier(.3,.6,.3,1) forwards";
        });
        on(btn, "pointerleave", () => {
          sheen.style.opacity = "0";
        });
      });
    }

    /* ---- card lift (+ pointer spotlight) ---- */
    root.querySelectorAll<HTMLElement>("[data-lift]").forEach((card) => {
      const glow = card.hasAttribute("data-spotlight");
      on(card, "pointerenter", () => {
        card.style.transform = "translateY(-4px)";
        card.style.boxShadow =
          "0 26px 60px rgba(0,0,0,.5), inset 0 1px 0 color-mix(in srgb, var(--color-text) 10%, transparent)";
        card.style.borderColor = "color-mix(in srgb, var(--color-accent) 52%, transparent)";
      });
      on(card, "pointerleave", () => {
        card.style.transform = "";
        card.style.boxShadow = "";
        card.style.borderColor = "";
      });
      if (glow && fine && !still) {
        const spot = document.createElement("span");
        spot.setAttribute("aria-hidden", "true");
        spot.style.cssText =
          "position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s ease;background:radial-gradient(320px 220px at var(--sx,50%) var(--sy,50%), color-mix(in srgb, var(--color-accent) 15%, transparent), transparent 72%)";
        card.appendChild(spot);
        cleanups.push(() => spot.remove());
        on(card, "pointermove", (e) => {
          const r = card.getBoundingClientRect();
          const pe = e as PointerEvent;
          spot.style.setProperty("--sx", `${pe.clientX - r.left}px`);
          spot.style.setProperty("--sy", `${pe.clientY - r.top}px`);
          spot.style.opacity = "1";
        });
        on(card, "pointerleave", () => {
          spot.style.opacity = "0";
        });
      }
    });

    /* ---- results rows: nudge + reveal the "View match" affordance ---- */
    root.querySelectorAll<HTMLElement>("[data-hover-row]").forEach((row) => {
      const cta = row.querySelector<HTMLElement>("[data-row-cta]");
      const gold = row.dataset.hoverRow === "gold";
      on(row, "pointerenter", () => {
        row.style.transform = "translateX(4px)";
        if (!gold) row.style.background = "color-mix(in srgb, var(--color-accent-900) 46%, transparent)";
        row.style.borderColor = gold
          ? "color-mix(in srgb, var(--gold) 52%, transparent)"
          : "color-mix(in srgb, var(--color-accent-700) 74%, transparent)";
        if (cta) {
          cta.style.opacity = "1";
          cta.style.transform = "none";
        }
      });
      on(row, "pointerleave", () => {
        row.style.transform = "";
        if (!gold) row.style.background = "";
        row.style.borderColor = "";
        if (cta) {
          cta.style.opacity = "0";
          cta.style.transform = "translateX(-6px)";
        }
      });
    });

    if (still) {
      root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
        el.style.transition = "none";
      });
      return () => cleanups.forEach((fn) => fn());
    }

    /* ---- scroll reveals ---- */
    const dur = 620 + MOTION_LEVEL * 44;
    const dist = 9 + MOTION_LEVEL * 1.6;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const el = en.target as HTMLElement;
          const d = parseInt(el.dataset.delay || "0", 10) * (MOTION_LEVEL / 10);
          timers.push(
            setTimeout(() => {
              el.style.opacity = "1";
              el.style.transform = "none";
            }, d),
          );
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.05 },
    );
    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.94) return;
      el.style.opacity = "0";
      el.style.transform = `translateY(${dist}px)`;
      el.style.transition = `opacity ${dur}ms ${EASE}, transform ${dur}ms ${EASE}`;
      io.observe(el);
    });

    /* ---- count-up on the big numbers ---- */
    const cio = new IntersectionObserver(
      (ents) => {
        ents.forEach((en) => {
          if (!en.isIntersecting) return;
          cio.unobserve(en.target);
          const el = en.target as HTMLElement;
          const target = parseFloat(el.dataset.count ?? "");
          if (!isFinite(target)) return;
          const suffix = el.dataset.suffix || "";
          const T = 880 + MOTION_LEVEL * 78;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / T);
            el.textContent =
              Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US") + suffix;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.35 },
    );
    root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => cio.observe(el));

    /* ---- pointer tilt ---- */
    if (fine) {
      root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
        const host = (el.closest("[data-tilt-host]") ?? el.parentElement) as HTMLElement | null;
        if (!host) return;
        const max = parseFloat(el.dataset.tilt ?? "0") * (MOTION_LEVEL / 10);
        on(host, "pointermove", (e) => {
          const r = host.getBoundingClientRect();
          const pe = e as PointerEvent;
          const dx = (pe.clientX - r.left) / r.width - 0.5;
          const dy = (pe.clientY - r.top) / r.height - 0.5;
          el.style.transition = "transform .14s linear";
          el.style.transform = `perspective(1100px) rotateY(${dx * max}deg) rotateX(${-dy * max}deg) scale(1.014)`;
        });
        on(host, "pointerleave", () => {
          el.style.transition = `transform 620ms ${EASE}`;
          el.style.transform = "";
        });
      });
    }

    return () => {
      io.disconnect();
      cio.disconnect();
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
