"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { WallPost } from "@prisma/client";

export function WallGallery({ posts }: { posts: WallPost[] }) {
  const [active, setActive] = useState<WallPost | null>(null);

  // Close on Escape + lock body scroll while the lightbox is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <>
      {/* Masonry via CSS columns — memes keep their natural aspect ratio. */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 [column-fill:_balance]">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setActive(post)}
            className="mb-3 sm:mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt={post.title ?? "Early exit meme"}
              loading="lazy"
              className="w-full object-cover"
            />
            {(post.title || post.caption) && (
              <div className="p-3">
                {post.title && (
                  <p className="text-sm font-semibold leading-snug">{post.title}</p>
                )}
                {post.caption && (
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{post.caption}</p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setActive(null)}
            aria-label="Close"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex max-h-full w-full max-w-3xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.imageUrl}
              alt={active.title ?? "Early exit meme"}
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
            />
            {(active.title || active.caption) && (
              <div className="mt-3 max-w-xl text-center">
                {active.title && (
                  <p className="text-base font-semibold text-white">{active.title}</p>
                )}
                {active.caption && (
                  <p className="mt-1 text-sm text-white/70">{active.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
