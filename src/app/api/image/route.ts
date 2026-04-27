import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Browser/CDN cache for 1 year. Stable URL (no minute-buster) means cache is honoured.
// To bust on photo updates, bump the URL with `?v=<player.updatedAt>` from the parent.
const LONG_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";
// Initials fallback uses a shorter cache so changing a player's name updates fast.
const SHORT_CACHE = "public, max-age=3600, stale-while-revalidate=60";

const ALLOWED_SIZES = [32, 64, 128, 256, 512];
function clampSize(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Snap to the closest allowed size so we don't generate infinite variants
  return ALLOWED_SIZES.reduce((best, s) =>
    Math.abs(s - n) < Math.abs(best - n) ? s : best,
  );
}

async function transcode(input: Buffer, size: number | null): Promise<{ buffer: Buffer; contentType: string }> {
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (size) {
    pipeline = pipeline.resize(size, size, { fit: "cover", position: "centre" });
  } else {
    // No explicit size — still cap at 512 to protect against full-res blobs
    pipeline = pipeline.resize(512, 512, { fit: "inside", withoutEnlargement: true });
  }
  const buffer = await pipeline.webp({ quality: 80 }).toBuffer();
  return { buffer, contentType: "image/webp" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const fallback = searchParams.get("fallback") || "initials";
  const size = clampSize(searchParams.get("size"));

  if (!type || !id || (type !== "player" && type !== "team")) {
    return new NextResponse("Missing or invalid parameters", { status: 400 });
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
    } else {
      const team = await prisma.team.findUnique({
        where: { id },
        select: { logoUrl: true, name: true },
      });
      imageData = team?.logoUrl ?? null;
      name = team?.name ?? "";
    }

    // No image — return SVG initials (lower cache so name changes propagate)
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
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": SHORT_CACHE },
        });
      }
      return new NextResponse("Not found", { status: 404 });
    }

    let sourceBuffer: Buffer;

    if (imageData.startsWith("https://") || imageData.startsWith("http://")) {
      // External URL (Cloudinary etc.) — fetch then resize/transcode
      const imgRes = await fetch(imageData);
      sourceBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:(.+?);base64,(.+)$/);
      if (!match) return new NextResponse("Invalid image data", { status: 400 });
      sourceBuffer = Buffer.from(match[2], "base64");
    } else {
      // Raw base64 (no data URL prefix)
      sourceBuffer = Buffer.from(imageData, "base64");
    }

    const { buffer, contentType } = await transcode(sourceBuffer, size);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": LONG_CACHE,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Image API error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
