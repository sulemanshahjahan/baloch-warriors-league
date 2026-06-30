"use server";

import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { createPlayerSession, clearPlayerSession, getPlayerSession } from "@/lib/player-session";
import { sendEmail, otpEmailHtml } from "@/lib/email";

function normalizeEmail(input: string): string {
  return (input || "").trim().toLowerCase();
}

async function playerByEmail(email: string) {
  if (!email.includes("@")) return null;
  return prisma.player.findFirst({
    where: { isActive: true, email },
    select: { id: true, name: true, slug: true, email: true, passwordHash: true },
  });
}

// ── Email + password login ────────────────────────────────────

export async function loginWithPassword(emailInput: string, password: string): Promise<ActionResult<{ slug: string }>> {
  const email = normalizeEmail(emailInput);
  const player = await playerByEmail(email);
  // Same generic error to avoid leaking which emails exist.
  const fail = { success: false, error: "Incorrect email or password." } as ActionResult<{ slug: string }>;
  if (!player || !player.passwordHash) return fail;
  const ok = await bcrypt.compare(password || "", player.passwordHash);
  if (!ok) return fail;
  await createPlayerSession(player.id);
  return { success: true, data: { slug: player.slug } };
}

// ── Email OTP login ───────────────────────────────────────────

export async function requestEmailOtp(emailInput: string): Promise<ActionResult> {
  const email = normalizeEmail(emailInput);
  const player = await playerByEmail(email);
  if (!player) return { success: false, error: "No active player found with that email. Ask an admin to add it." };

  const existing = await prisma.playerOtp.findUnique({ where: { email } });
  if (existing && Date.now() - existing.createdAt.getTime() < 60_000) {
    return { success: false, error: "Please wait a minute before requesting another code." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.playerOtp.upsert({
    where: { email },
    create: { email, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
  });

  const res = await sendEmail({ to: email, subject: `Your BWL login code: ${code}`, html: otpEmailHtml(code) });
  if (!res.ok) return { success: false, error: "Could not send the email. Try again shortly." };
  return { success: true, data: undefined, message: "Code sent to your email." };
}

export async function verifyEmailOtp(emailInput: string, code: string): Promise<ActionResult<{ slug: string }>> {
  const email = normalizeEmail(emailInput);
  const player = await playerByEmail(email);
  if (!player) return { success: false, error: "No active player found with that email." };

  const otp = await prisma.playerOtp.findUnique({ where: { email } });
  if (!otp) return { success: false, error: "Request a code first." };
  if (otp.expiresAt < new Date()) return { success: false, error: "Code expired. Request a new one." };
  if (otp.attempts >= 5) return { success: false, error: "Too many attempts. Request a new code." };

  const ok = await bcrypt.compare((code || "").trim(), otp.codeHash);
  if (!ok) {
    await prisma.playerOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
    return { success: false, error: "Incorrect code." };
  }
  await prisma.playerOtp.delete({ where: { email } }).catch(() => {});
  await createPlayerSession(player.id);
  return { success: true, data: { slug: player.slug } };
}

// ── Set / change password (requires session) ──────────────────

export async function setMyPassword(password: string): Promise<ActionResult> {
  const session = await getPlayerSession();
  if (!session) return { success: false, error: "Please sign in first." };
  if (!password || password.length < 6) return { success: false, error: "Password must be at least 6 characters." };
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.player.update({ where: { id: session.playerId }, data: { passwordHash } });
  return { success: true, data: undefined, message: "Password set." };
}

export async function playerLogout(): Promise<ActionResult> {
  await clearPlayerSession();
  return { success: true, data: undefined };
}
