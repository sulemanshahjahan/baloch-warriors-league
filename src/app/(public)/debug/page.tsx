"use client";

import { useState, useEffect } from "react";

export const dynamic = "force-dynamic";

export default function DebugPage() {
  const [logs, setLogs] = useState<Array<{ t: string; msg: string; data: string }>>([]);
  const [token, setToken] = useState("");
  const [isCap, setIsCap] = useState(false);

  useEffect(() => {
    setIsCap("Capacitor" in window);
    setToken(localStorage.getItem("bwl-fcm-token") || "none");

    const load = () => {
      const stored = localStorage.getItem("bwl-push-debug");
      if (stored) {
        try { setLogs(JSON.parse(stored)); } catch {}
      }
    };

    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold mb-4">Push Debug Log</h1>
      <p className="text-xs text-muted-foreground mb-2">
        FCM Token: {token.slice(0, 30)}...
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Capacitor: {isCap ? "Yes" : "No"}
      </p>

      <button
        onClick={() => { localStorage.removeItem("bwl-push-debug"); setLogs([]); }}
        className="text-xs px-3 py-1 rounded bg-destructive text-white mb-4"
      >
        Clear logs
      </button>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No push events logged yet. Send a notification and tap it.</p>
      ) : (
        <div className="space-y-2">
          {[...logs].reverse().map((log, i) => (
            <div key={i} className="p-2 rounded bg-muted text-xs font-mono break-all">
              <p className="text-muted-foreground">{log.t}</p>
              <p className="font-bold">{log.msg}</p>
              {log.data && <p className="text-muted-foreground mt-1">{log.data}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
