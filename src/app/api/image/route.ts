import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// LRU cache: max 200 entries, 5-minute TTL
// Map insertion order = access order (delete + re-set moves to end)
const MAX_CACHE = 200;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: string | null; name: string; ts: number }>();

function lruGet(key: string): { data: string | null; name: string } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return { data: entry.data, name: entry.name };
}

function lruSet(key: string, data: string | null, name: string) {
  // Evict oldest (first entry in Map) if at capacity
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, name, ts: Date.now() });
}

async function getImageData(type: string, id: string): Promise<{ data: string | null; name: string }> {
  const key = `${type}:${id}`;
  const cached = lruGet(key);
  if (cached) return cached;

  let data: string | null = null;
  let name = "";

  if (type === "player") {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { photoUrl: true, name: true },
    });
    data = player?.photoUrl ?? null;
    name = player?.name ?? "";
  } else if (type === "team") {
    const team = await prisma.team.findUnique({
      where: { id },
      select: { logoUrl: true, name: true },
    });
    data = team?.logoUrl ?? null;
    name = team?.name ?? "";
  }

  lruSet(key, data, name);
  return { data, name };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const fallback = searchParams.get("fallback") || "initials";

  if (!type || !id || (type !== "player" && type !== "team")) {
    return new NextResponse("Missing or invalid parameters", { status: 400 });
  }

  try {
    const { data: imageData, name } = await getImageData(type, id);

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
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      }
      return new NextResponse("Not found", { status: 404 });
    }

    // External URL — redirect (leverages CDN)
    if (imageData.startsWith("https://") || imageData.startsWith("http://")) {
      return NextResponse.redirect(imageData, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
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
          "Cache-Control": "public, max-age=86400, immutable",
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    // Raw base64 string
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
