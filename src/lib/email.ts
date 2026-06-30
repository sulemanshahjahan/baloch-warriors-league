import "server-only";

// Minimal email sender via the Resend REST API (no extra dependency).
// Configure with env: RESEND_API_KEY and EMAIL_FROM (e.g. "BWL <noreply@bwlleague.com>").
// If unconfigured, sends are skipped gracefully (login won't deliver until set).

export interface EmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY / EMAIL_FROM not set — skipping send to", opts.to);
    return { ok: false, error: "Email is not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Email send failed (${res.status}) ${text.slice(0, 120)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Simple dark-themed BWL email shell. */
export function otpEmailHtml(code: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#fff;padding:32px;border-radius:12px;max-width:480px;margin:0 auto;">
    <div style="font-size:28px;font-weight:800;color:#ef4444;">BWL</div>
    <p style="color:#aaa;margin-top:8px;">Your one-time login code:</p>
    <div style="font-size:38px;font-weight:900;letter-spacing:10px;background:#1a1a1a;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">${code}</div>
    <p style="color:#888;font-size:13px;">Valid for 5 minutes. If you didn't request this, ignore this email.</p>
  </div>`;
}
