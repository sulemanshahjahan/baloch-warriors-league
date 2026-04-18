"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

export function MatchCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) {
        setIsOverdue(true);
        setTimeLeft("Overdue");
        return;
      }
      setIsUrgent(ms < 2 * 60 * 60 * 1000);
      const totalSeconds = Math.floor(ms / 1000);
      const d = Math.floor(totalSeconds / 86400);
      const h = Math.floor((totalSeconds % 86400) / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      if (d > 0) {
        setTimeLeft(`${d}d ${h}h remaining`);
      } else {
        setTimeLeft(`${h}h ${m}m ${s}s remaining`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (isOverdue) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
        <AlertTriangle className="w-3.5 h-3.5" />
        Match deadline has passed
      </div>
    );
  }

  const deadlineAbs = new Date(deadline).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
        isUrgent
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-500/10 text-amber-400"
      }`}
      title={`${deadlineAbs} PKT`}
    >
      <Clock className="w-3.5 h-3.5" />
      Deadline: {timeLeft} · {deadlineAbs} PKT
    </div>
  );
}
