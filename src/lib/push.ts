// @ts-expect-error — web-push has no type declarations
import webpush from "web-push";
import { prisma } from "./db";

// ═══════════════════════════════════════════════════════
// WEB PUSH (VAPID) — for browsers
// ═══════════════════════════════════════════════════════

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@bwlleague.com";

let vapidConfigured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
}

// ═══════════════════════════════════════════════════════
// FIREBASE ADMIN — lazy init to avoid import issues
// ═══════════════════════════════════════════════════════

let firebaseApp: any = null;

async function getFirebaseMessaging() {
  if (firebaseApp) return firebaseApp.messaging();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("FCM: Missing Firebase env vars", {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      privateKeyLength: privateKey?.length,
    });
    return null;
  }

  try {
    const admin = (await import("firebase-admin")).default;

    if (admin.apps.length === 0) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      firebaseApp = admin.apps[0];
    }

    return firebaseApp!.messaging();
  } catch (err) {
    console.error("FCM: Firebase init failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// UNIFIED NOTIFY FUNCTION
// ═══════════════════════════════════════════════════════

interface NotifyPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send notification via ALL channels:
 * 1. Save to DB (notification history + polling fallback)
 * 2. Web Push (browsers)
 * 3. FCM (Android app — works when closed)
 */
export async function notify(payload: NotifyPayload): Promise<void> {
  console.log("notify() called:", payload.title, "-", payload.body);

  // Check app settings for test mode and per-type toggles
  try {
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();

    if (settings.testMode) {
      console.log("notify: SKIPPED (test mode on)", payload.title);
      return;
    }

    // Check per-type push toggles based on notification tag
    const tag = payload.tag || "";
    if (tag.startsWith("deadline-") && !settings.pushMatchReminders) return;
    if (tag.startsWith("match-result-") && !settings.pushMatchResults) return;
    if (tag.startsWith("score-report-") && !settings.pushScoreSubmissions) return;
    if (tag.startsWith("room-id-") && !settings.pushRoomId) return;
    if ((tag.startsWith("dispute-") || tag.startsWith("overdue-")) && !settings.pushAdminAlerts) return;
    if ((tag.startsWith("draw-") || tag.startsWith("tournament-")) && !settings.pushTournamentUpdates) return;
    if (tag.startsWith("auto-confirm-") && !settings.pushScoreSubmissions) return;
  } catch {
    // If settings check fails, proceed with sending (fail open)
  }

  // Also respect env var override
  if (process.env.NOTIFICATIONS_ENABLED === "false") {
    console.log("notify: SKIPPED (NOTIFICATIONS_ENABLED=false)");
    return;
  }

  try {
    // 1. Save to DB
    await prisma.notification.create({
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url || null,
        tag: payload.tag || null,
      },
    });
    console.log("notify: saved to DB");

    // 2. Web Push (browsers)
    if (vapidConfigured) {
      const subs = await prisma.pushSubscription.findMany();
      console.log("notify: sending Web Push to", subs.length, "subscribers");

      if (subs.length > 0) {
        const message = JSON.stringify(payload);
        const expiredIds: string[] = [];

        await Promise.allSettled(
          subs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                message,
                { TTL: 3600 }
              );
            } catch (err: unknown) {
              const code = (err as { statusCode?: number })?.statusCode;
              console.error("Web Push failed for", sub.endpoint.slice(0, 40), "status:", code);
              if (code === 404 || code === 410) expiredIds.push(sub.id);
            }
          })
        );

        if (expiredIds.length > 0) {
          await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
        }
      }
    } else {
      console.warn("notify: VAPID not configured, skipping Web Push");
    }

    // 3. FCM (Android app)
    const tokens = await prisma.fcmToken.findMany();
    console.log("notify: FCM tokens found:", tokens.length);

    if (tokens.length > 0) {
      const messaging = await getFirebaseMessaging();

      if (!messaging) {
        console.warn("notify: Firebase messaging not available, skipping FCM");
        return;
      }

      const expiredTokenIds: string[] = [];

      const results = await Promise.allSettled(
        tokens.map(async (t) => {
          try {
            const result = await messaging.send({
              token: t.token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: {
                url: payload.url || "/",
                tag: payload.tag || "",
              },
              android: {
                priority: "high" as const,
              },
            });
            console.log("FCM sent successfully:", result);
          } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            const msg = (err as { message?: string })?.message;
            console.error("FCM send failed:", code, msg);
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              expiredTokenIds.push(t.id);
            }
          }
        })
      );

      console.log("FCM results:", results.map(r => r.status));

      if (expiredTokenIds.length > 0) {
        await prisma.fcmToken.deleteMany({ where: { id: { in: expiredTokenIds } } });
        console.log("FCM: cleaned", expiredTokenIds.length, "expired tokens");
      }
    }
  } catch (err) {
    console.error("Notify failed:", err);
  }
}

export const sendPushToAll = notify;
