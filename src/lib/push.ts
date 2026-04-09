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
// FIREBASE ADMIN — for Android app (FCM)
// ═══════════════════════════════════════════════════════

import admin from "firebase-admin";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

let fcmConfigured = false;

if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  fcmConfigured = true;
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
 * Send a notification via ALL channels:
 * 1. Save to DB (notification history + polling fallback)
 * 2. Web Push (browsers)
 * 3. FCM (Android app — works even when app is closed)
 *
 * Fire-and-forget — never throws.
 */
export async function notify(payload: NotifyPayload): Promise<void> {
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

    // 2. Web Push (browsers)
    if (vapidConfigured) {
      const subs = await prisma.pushSubscription.findMany();
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
              if (code === 404 || code === 410) expiredIds.push(sub.id);
            }
          })
        );

        if (expiredIds.length > 0) {
          await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
        }
      }
    }

    // 3. FCM (Android app)
    if (fcmConfigured) {
      const tokens = await prisma.fcmToken.findMany();
      if (tokens.length > 0) {
        const expiredTokenIds: string[] = [];

        await Promise.allSettled(
          tokens.map(async (t) => {
            try {
              await admin.messaging().send({
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
                  priority: "high",
                  notification: {
                    channelId: "bwl_default",
                    icon: "ic_notification",
                    clickAction: "FCM_PLUGIN_ACTIVITY",
                  },
                },
              });
            } catch (err: unknown) {
              const code = (err as { code?: string })?.code;
              if (
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token"
              ) {
                expiredTokenIds.push(t.id);
              }
            }
          })
        );

        if (expiredTokenIds.length > 0) {
          await prisma.fcmToken.deleteMany({ where: { id: { in: expiredTokenIds } } });
        }
      }
    }
  } catch (err) {
    console.error("Notify failed:", err);
  }
}

export const sendPushToAll = notify;
