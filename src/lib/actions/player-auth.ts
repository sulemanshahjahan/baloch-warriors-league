"use server";

import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { createPlayerSession, clearPlayerSession } from "@/lib/player-session";

/** Digits only, no leading +/spaces. */
function normalizePhone(input: string): string {
  return (input || "").replace(/\D/g, "");
}

/** Find a player whose stored phone matches (by last 9 digits). */
async function findPlayerByPhone(digits: string) {
  if (digits.length < 7) return null;
  const tail = digits.slice(-9);
  return prisma.player.findFirst({
    where: { isActive: true, phone: { contains: tail } },
    select: { id: true, name: true, slug: true, phone: true },
  });
}

/** Send a one-time login code to the player's WhatsApp number. */
export async function requestPlayerOtp(phoneInput: string): Promise<ActionResult> {
  const digits = normalizePhone(phoneInput);
  const player = await findPlayerByPhone(digits);
  if (!player) {
    return { success: false, error: "No active player found with that number. Ask an admin to add your phone." };
  }
  const phone = normalizePhone(player.phone ?? digits);

  // Rate limit: one code per 60s
  const existing = await prisma.playerOtp.findUnique({ where: { phone } });
  if (existing && Date.now() - existing.createdAt.getTime() < 60_000) {
    return { success: false, error: "Please wait a minute before requesting another code." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.playerOtp.upsert({
    where: { phone },
    create: { phone, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
  });

  // Send via WhatsApp template `login_otp` (body param = the code).
  const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");
  const res = await sendWhatsAppTemplate({
    to: phone,
    templateName: "login_otp",
    languageCode: "en",
    parameters: [code],
  });
  if (!res.ok) {
    return { success: false, error: "Could not send the code via WhatsApp. Try again shortly." };
  }

  return { success: true, data: undefined, message: `Code sent to the number ending ${phone.slice(-4)}.` };
}

/** Verify a code and start a player session. */
export async function verifyPlayerOtp(phoneInput: string, code: string): Promise<ActionResult> {
  const digits = normalizePhone(phoneInput);
  const player = await findPlayerByPhone(digits);
  if (!player) return { success: false, error: "No active player found with that number." };
  const phone = normalizePhone(player.phone ?? digits);

  const otp = await prisma.playerOtp.findUnique({ where: { phone } });
  if (!otp) return { success: false, error: "Request a code first." };
  if (otp.expiresAt < new Date()) return { success: false, error: "Code expired. Request a new one." };
  if (otp.attempts >= 5) return { success: false, error: "Too many attempts. Request a new code." };

  const ok = await bcrypt.compare((code || "").trim(), otp.codeHash);
  if (!ok) {
    await prisma.playerOtp.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    return { success: false, error: "Incorrect code." };
  }

  await prisma.playerOtp.delete({ where: { phone } }).catch(() => {});
  await createPlayerSession(player.id);
  return { success: true, data: { slug: player.slug } as unknown as undefined, message: "Logged in" };
}

export async function playerLogout(): Promise<ActionResult> {
  await clearPlayerSession();
  return { success: true, data: undefined };
}
