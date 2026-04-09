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

// ── Web Push subscribe (browsers) ──
async function subscribeToWebPush(): Promise<boolean> {
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

// ── FCM subscribe (Capacitor Android app) ──
async function subscribeToFCM(): Promise<boolean> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Request permission
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return false;

    // Register for push
    await PushNotifications.register();

    // Listen for token
    return new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        // Send FCM token to our server
        await fetch("/api/push/fcm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.value }),
        });
        localStorage.setItem("bwl-fcm-token", token.value);
        resolve(true);
      });

      PushNotifications.addListener("registrationError", () => {
        resolve(false);
      });

      // Handle notification tap — navigate to the URL
      PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        const url = notification.notification.data?.url;
        if (url) window.location.href = url;
      });
    });
  } catch (err) {
    console.error("FCM subscribe error:", err);
    return false;
  }
}

async function unsubscribeFromFCM(): Promise<void> {
  try {
    const token = localStorage.getItem("bwl-fcm-token");
    if (token) {
      await fetch("/api/push/fcm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      localStorage.removeItem("bwl-fcm-token");
    }
  } catch { /* silent */ }
}

// ═══════════════════════════════════════
// Navbar bell icon button
// ═══════════════════════════════════════

export function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isCapacitor) {
      setSupported(true);
      setSubscribed(!!localStorage.getItem("bwl-fcm-token"));
      return;
    }

    if (hasWebPush && Notification.permission !== "denied") {
      setSupported(true);
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub));
      });
    }
  }, []);

  if (!supported) return null;

  async function handleToggle() {
    setLoading(true);
    try {
      if (isCapacitor) {
        if (subscribed) {
          await unsubscribeFromFCM();
          setSubscribed(false);
        } else {
          const ok = await subscribeToFCM();
          setSubscribed(ok);
        }
      } else {
        if (subscribed) {
          const reg = await navigator.serviceWorker.ready;
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
          setSubscribed(await subscribeToWebPush());
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
        subscribed ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
      title={subscribed ? "Notifications on" : "Turn on notifications"}
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

    // Already subscribed?
    if (isCapacitor) {
      if (localStorage.getItem("bwl-fcm-token")) return;
    } else if (hasWebPush) {
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        navigator.serviceWorker.register("/sw.js").then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            if (!sub) subscribeToWebPush();
          });
        });
        return;
      }
    } else {
      return; // No push support at all
    }

    const dismissed = sessionStorage.getItem("bwl-push-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = useCallback(async () => {
    setLoading(true);
    if (isCapacitor) {
      const ok = await subscribeToFCM();
      if (!ok) sessionStorage.setItem("bwl-push-dismissed", "1");
    } else {
      const ok = await subscribeToWebPush();
      if (!ok) sessionStorage.setItem("bwl-push-dismissed", "1");
    }
    setShow(false);
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
