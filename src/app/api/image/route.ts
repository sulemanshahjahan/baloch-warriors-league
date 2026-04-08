import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Serve player/team images with proper caching
// URL format: /api/image?type=player&id=123 or /api/image?type=team&id=456
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const fallback = searchParams.get("fallback") || "initials";

  if (!type || !id) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  try {
    let imageData: string | null = null;
    let name = "";

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
    } else {
      return new NextResponse("Invalid type", { status: 400 });
    }

    // If no image, return SVG initials as fallback
    if (!imageData) {
      if (fallback === "initials" && name) {
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#333" rx="50"/>
            <text x="50" y="50" dy=".35em" text-anchor="middle" fill="#fff" font-size="36" font-family="system-ui" font-weight="bold">${initials}</text>
          </svg>
        `;

        return new NextResponse(svg, {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      }
      return new NextResponse("Not found", { status: 404 });
    }

    // If it's a Cloudinary URL or any external URL, redirect to it
    // This leverages Cloudinary's CDN and doesn't proxy through our server
    if (imageData.startsWith("https://") || imageData.startsWith("http://")) {
      return NextResponse.redirect(imageData, {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Handle legacy base64 data URL (for backward compatibility during migration)
    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:(.+?);base64,(.+)$/);
      if (!match) {
        return new NextResponse("Invalid image data", { status: 400 });
      }

      const [, contentType, base64Data] = match;
      const buffer = Buffer.from(base64Data, "base64");

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, immutable",
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    // Assume it's a raw base64 string (legacy format)
    const buffer = Buffer.from(imageData, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Image API error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
