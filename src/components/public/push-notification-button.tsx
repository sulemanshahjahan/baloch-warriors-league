"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;
const hasWebPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

async function subscribeToPush(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });

    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════
// In-app polling for Capacitor (no Web Push)
// Checks for new match results every 60 seconds
// ═══════════════════════════════════════

function useCapacitorPolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isCapacitor) return;

    let lastCheck = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/matches?status=COMPLETED&limit=1`);
        const matches = await res.json();
        if (!Array.isArray(matches) || matches.length === 0) return;

        const latest = matches[0];
        const completedAt = new Date(latest.completedAt || latest.scheduledAt).getTime();

        // If match completed after our last check, show in-app alert
        if (completedAt > lastCheck) {
          const home = latest.homePlayer?.name ?? latest.homeTeam?.name ?? "Home";
          const away = latest.awayPlayer?.name ?? latest.awayTeam?.name ?? "Away";
          const title = latest.tournament?.name ?? "BWL";

          // Use Capacitor Local Notifications if available
          try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            await LocalNotifications.schedule({
              notifications: [{
                title: `${title} — Result`,
                body: `${home} ${latest.homeScore ?? 0} - ${latest.awayScore ?? 0} ${away}`,
                id: Math.floor(Math.random() * 100000),
                schedule: { at: new Date() },
              }],
            });
          } catch {
            // Fallback: no local notifications plugin, just skip
          }
        }

        lastCheck = Date.now();
      } catch {
        // Silent fail
      }
    };

    const interval = setInterval(poll, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, [enabled]);
}

// ═══════════════════════════════════════
// Navbar bell icon button
// ═══════════════════════════════════════

export function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // For Capacitor: enable polling when "subscribed"
  useCapacitorPolling(isCapacitor && subscribed);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Capacitor app — always show button (uses polling instead of Web Push)
    if (isCapacitor) {
      setSupported(true);
      setSubscribed(localStorage.getItem("bwl-push-enabled") === "1");
      return;
    }

    // Web browser — check for Web Push support
    if (!hasWebPush) return;
    if (Notification.permission === "denied") return;

    setSupported(true);

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    });
  }, []);

  if (!supported) return null;

  async function handleToggle() {
    setLoading(true);
    try {
      if (isCapacitor) {
        // Capacitor — toggle polling
        if (subscribed) {
          localStorage.removeItem("bwl-push-enabled");
          setSubscribed(false);
        } else {
          localStorage.setItem("bwl-push-enabled", "1");
          setSubscribed(true);

          // Try to request local notification permission
          try {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            await LocalNotifications.requestPermissions();
          } catch {
            // Plugin not installed — polling still works, just no system notifications
          }
        }
      } else {
        // Web browser — Web Push API
        const reg = await navigator.serviceWorker.ready;
        if (subscribed) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
          setSubscribed(false);
        } else {
          const ok = await subscribeToPush();
          setSubscribed(ok);
        }
      }
    } catch (err) {
      console.error("Push toggle error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
        subscribed
          ? "text-primary hover:bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
      title={subscribed ? "Notifications on — tap to turn off" : "Turn on notifications"}
    >
      {subscribed ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
    </button>
  );
}

// ═══════════════════════════════════════
// Auto-prompt banner
// ═══════════════════════════════════════

export function PushPromptBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already enabled
    if (isCapacitor) {
      if (localStorage.getItem("bwl-push-enabled") === "1") return;
    } else {
      if (!hasWebPush) return;
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        navigator.serviceWorker.register("/sw.js").then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            if (!sub) subscribeToPush();
          });
        });
        return;
      }
    }

    const dismissed = sessionStorage.getItem("bwl-push-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = useCallback(async () => {
    setLoading(true);

    if (isCapacitor) {
      localStorage.setItem("bwl-push-enabled", "1");
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        await LocalNotifications.requestPermissions();
      } catch {
        // Plugin not available — polling still works
      }
      setShow(false);
    } else {
      const ok = await subscribeToPush();
      if (!ok) sessionStorage.setItem("bwl-push-dismissed", "1");
      setShow(false);
    }

    setLoading(false);
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem("bwl-push-dismissed", "1");
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-[360px] z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl shadow-2xl shadow-black/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Stay Updated!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified about match results, tournament updates, and news.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleAllow} disabled={loading} className="text-xs h-8">
                {loading ? "Enabling..." : "Enable Notifications"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8 text-muted-foreground">
                Not now
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
