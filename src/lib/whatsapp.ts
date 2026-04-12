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

/**
 * Send a WhatsApp template message via Meta Cloud API.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "en",
  parameters,
}: SendTemplateParams): Promise<boolean> {
  // Check app settings
  try {
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    if (settings.testMode) {
      console.log("[WhatsApp] SKIPPED (test mode on)", to, templateName);
      return true;
    }
    // Check per-type WhatsApp toggle based on template name
    if (templateName.includes("reminder") && !settings.waMatchReminders) return true;
    if (templateName.includes("score") && !settings.waScoreSubmissions) return true;
    if (templateName.includes("result") && !settings.waMatchResults) return true;
    if (templateName.includes("room") && !settings.waRoomId) return true;
  } catch {
    // Fail open — send if settings check fails
  }

  if (process.env.NOTIFICATIONS_ENABLED === "false") {
    console.log("[WhatsApp] SKIPPED (env var)", to, templateName);
    return true;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn("[WhatsApp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID — skipping");
    return false;
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
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp] Send failed:", res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
    return false;
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
): Promise<boolean> {
  if (process.env.NOTIFICATIONS_ENABLED === "false") {
    console.log("[WhatsApp] Text SKIPPED (NOTIFICATIONS_ENABLED=false)", to);
    return true;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn("[WhatsApp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID — skipping");
    return false;
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
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp] Text send failed:", res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
    return false;
  }
}

/**
 * Send match magic link to a player via WhatsApp template message.
 */
export async function sendMatchLink(
  phone: string,
  playerName: string,
  opponentName: string,
  deadline: string,
  magicLinkUrl: string,
): Promise<boolean> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "match_reminder";
  return sendWhatsAppTemplate({
    to: phone,
    templateName,
    parameters: [playerName, opponentName, deadline, magicLinkUrl],
  });
}
