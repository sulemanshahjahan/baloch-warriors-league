/**
 * WhatsApp Cloud API client for sending automated messages.
 *
 * Required env vars:
 *   WHATSAPP_TOKEN        — Permanent access token from Meta Developer portal
 *   WHATSAPP_PHONE_ID     — Phone number ID (not the phone number itself)
 *   WHATSAPP_TEMPLATE_NAME — Approved template name (default: "match_reminder")
 *
 * Setup guide:
 * 1. Create Meta Business account: https://business.facebook.com
 * 2. Go to https://developers.facebook.com → Create App → Business type
 * 3. Add WhatsApp product → Get started
 * 4. Add a phone number (or use the test number)
 * 5. Create a message template (utility category):
 *    Name: match_reminder
 *    Body: "{{1}}, your match vs {{2}} is ready.\nDeadline: {{3}}\nReport your score here: {{4}}"
 *    (4 variables: player name, opponent name, deadline, magic link URL)
 * 6. Copy the Phone Number ID and generate a permanent token
 * 7. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID to Vercel env vars
 */

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

interface SendTemplateParams {
  to: string; // Phone number with country code, e.g. "923001234567" (no +)
  templateName: string;
  languageCode?: string;
  parameters: string[]; // Template variable values in order
}

export interface WhatsAppResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a WhatsApp template message via Meta Cloud API.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "en",
  parameters,
}: SendTemplateParams): Promise<WhatsAppResult> {
  // Check app settings
  try {
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    if (settings.testMode) {
      console.log("[WhatsApp] SKIPPED (test mode on)", to, templateName);
      return { ok: true, error: "Skipped (test mode)" };
    }
    // Check per-type WhatsApp toggle based on template name
    if (templateName.includes("reminder") && !settings.waMatchReminders) return { ok: true, error: "Skipped (reminders disabled)" };
    if (templateName.includes("score") && !settings.waScoreSubmissions) return { ok: true, error: "Skipped (score submissions disabled)" };
    if (templateName.includes("result") && !settings.waMatchResults) return { ok: true, error: "Skipped (results disabled)" };
    if (templateName.includes("room") && !settings.waRoomId) return { ok: true, error: "Skipped (room ID disabled)" };
  } catch {
    // Fail open — send if settings check fails
  }

  if (process.env.NOTIFICATIONS_ENABLED === "false") {
    console.log("[WhatsApp] SKIPPED (env var)", to, templateName);
    return { ok: true, error: "Skipped (env disabled)" };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn("[WhatsApp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID — skipping");
    return { ok: false, error: "Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID env vars" };
  }

  // Strip + and spaces from phone number
  const cleanPhone = to.replace(/[+\s\-()]/g, "");

  const body = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: parameters.map((value) => ({
            type: "text",
            text: value,
          })),
        },
      ],
    },
  };

  try {
    const res = await fetch(`${WHATSAPP_API}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      const errMsg = err?.error?.message || err?.error?.error_data?.details || `HTTP ${res.status}`;
      console.error("[WhatsApp] Send failed:", res.status, JSON.stringify(err));
      return { ok: false, error: errMsg };
    }

    return { ok: true };
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Send a plain text WhatsApp message (for non-template use cases).
 * Note: Only works within 24h of user's last message (session window).
 * For proactive messages, use sendWhatsAppTemplate instead.
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
): Promise<WhatsAppResult> {
  if (process.env.NOTIFICATIONS_ENABLED === "false") {
    return { ok: true, error: "Skipped (env disabled)" };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    return { ok: false, error: "Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID" };
  }

  const cleanPhone = to.replace(/[+\s\-()]/g, "");

  try {
    const res = await fetch(`${WHATSAPP_API}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      const errMsg = err?.error?.message || `HTTP ${res.status}`;
      console.error("[WhatsApp] Text send failed:", res.status, JSON.stringify(err));
      return { ok: false, error: errMsg };
    }

    return { ok: true };
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Send match reminder with availability link (24h before match).
 * Template: match_reminder — params: playerName, opponentName, deadline, availabilityLink
 */
export async function sendMatchLink(
  phone: string,
  playerName: string,
  opponentName: string,
  deadline: string,
  magicLinkUrl: string,
): Promise<WhatsAppResult> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "match_reminder";
  return sendWhatsAppTemplate({
    to: phone,
    templateName,
    parameters: [playerName, opponentName, deadline, magicLinkUrl],
  });
}

/**
 * Send fixture notification after schedule generation.
 * Template: match_schedule — params: playerName, opponentName, opponentPhone, deadline
 */
export async function sendScheduleMessage(
  phone: string,
  playerName: string,
  opponentName: string,
  opponentPhone: string,
  deadline: string,
): Promise<WhatsAppResult> {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: "match_schedule",
    parameters: [playerName, opponentName, opponentPhone, deadline],
  });
}

/**
 * Notify player that opponent is ready to play.
 * Template: opponent_ready — params: playerName, opponentName, preferredTime, matchLink
 */
export async function sendOpponentReady(
  phone: string,
  playerName: string,
  opponentName: string,
  preferredTime: string,
  matchLink: string,
): Promise<WhatsAppResult> {
  return sendWhatsAppTemplate({
    to: phone,
    templateName: "opponent_ready",
    parameters: [playerName, opponentName, preferredTime, matchLink],
  });
}
