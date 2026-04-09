import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await prisma.fcmToken.upsert({
      where: { token },
      create: { token },
      update: {},
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
