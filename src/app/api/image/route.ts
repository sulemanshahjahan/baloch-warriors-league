import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const fallback = searchParams.get("fallback") || "initials";

  if (!type || !id || (type !== "player" && type !== "team")) {
    return new NextResponse("Missing or invalid parameters", { status: 400 });
  }

  try {
    let imageData: string | null = null;
    let name = "";

    // Always fetch fresh from DB (no in-memory cache — Vercel is stateless anyway)
    if (type === "player") {
      const player = await prisma.player.findUnique({
        where: { id },
        select: { photoUrl: true, name: true },
      });
      imageData = player?.photoUrl ?? null;
      name = player?.name ?? "";
    } else if (type === "team") {
      const team = await prisma.team.findUnique({
        where: { id },
        select: { logoUrl: true, name: true },
      });
      imageData = team?.logoUrl ?? null;
      name = team?.name ?? "";
    }

    // Short cache — 5 minutes, revalidate after
    const CACHE = "public, max-age=300, stale-while-revalidate=60";

    // No image — return SVG initials
    if (!imageData) {
      if (fallback === "initials" && name) {
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#333" rx="50"/><text x="50" y="50" dy=".35em" text-anchor="middle" fill="#fff" font-size="36" font-family="system-ui" font-weight="bold">${initials}</text></svg>`;

        return new NextResponse(svg, {
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE },
        });
      }
      return new NextResponse("Not found", { status: 404 });
    }

    // External URL (Cloudinary etc.) — proxy the image instead of redirect
    // Redirects get cached by browsers and cause stale image issues
    if (imageData.startsWith("https://") || imageData.startsWith("http://")) {
      try {
        const imgRes = await fetch(imageData);
        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        return new NextResponse(imgBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
          },
        });
      } catch {
        return NextResponse.redirect(imageData);
      }
    }

    // Base64 data URL
    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:(.+?);base64,(.+)$/);
      if (!match) return new NextResponse("Invalid image data", { status: 400 });

      const [, contentType, base64Data] = match;
      const buffer = Buffer.from(base64Data, "base64");

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": CACHE,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    // Raw base64 string
    const buffer = Buffer.from(imageData, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": CACHE,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Image API error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
