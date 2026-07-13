import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Tag the device as admin when a logged-in admin registers it.
    const session = await auth();

    await prisma.fcmToken.upsert({
      where: { token },
      create: { token, isAdmin: !!session },
      update: session ? { isAdmin: true } : {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("FCM register error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    await prisma.fcmToken.deleteMany({ where: { token } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("FCM unregister error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
