"use client";

import { useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * A small "?" icon that reveals a tiebreak explanation on tap. The bubble is
 * fixed-positioned so it escapes table/overflow clipping. Kept out of the way by
 * default so the standings table stays clean.
 */
export function TiebreakInfo({ message }: { message: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 224;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ left, top: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Why is this row ranked here?"
        className="inline-flex align-middle text-muted-foreground/50 hover:text-amber-400 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {pos && (
        <>
          <span
            className="fixed inset-0 z-[60]"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPos(null); }}
          />
          <span
            className="fixed z-[61] w-56 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl p-2.5 text-[11px] leading-snug font-normal"
            style={{ left: pos.left, top: pos.top }}
          >
            {message}
          </span>
        </>
      )}
    </>
  );
}
