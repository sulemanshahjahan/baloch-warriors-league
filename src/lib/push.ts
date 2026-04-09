// @ts-expect-error — web-push has no type declarations
import webpush from "web-push";
import { prisma } from "./db";

// Configure VAPID
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@bwlleague.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to ALL subscribers.
 * Fire-and-forget — never throws, never blocks the caller.
 * Expired subscriptions are auto-cleaned.
 */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("Push: VAPID keys not configured, skipping");
    return;
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) return;

    const message = JSON.stringify(payload);
    const expiredIds: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
            { TTL: 3600 }
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired — mark for cleanup
            expiredIds.push(sub.id);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    }
  } catch (err) {
    console.error("Push: failed to send", err);
  }
}
