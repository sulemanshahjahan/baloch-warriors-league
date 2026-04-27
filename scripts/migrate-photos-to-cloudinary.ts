/**
 * One-shot migration: upload all base64 photo blobs in the DB to Cloudinary,
 * then replace the DB column with the Cloudinary secure_url.
 *
 * Run: npx tsx scripts/migrate-photos-to-cloudinary.ts
 *
 * Idempotent: skips rows whose photoUrl/logoUrl/bannerUrl already starts with "http".
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

interface MigrationTarget {
  table: "player" | "team" | "tournament";
  field: "photoUrl" | "logoUrl" | "bannerUrl";
  folder: string;
  transformation: Record<string, unknown>[];
}

const TARGETS: MigrationTarget[] = [
  {
    table: "player",
    field: "photoUrl",
    folder: "bwl/players",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  },
  {
    table: "team",
    field: "logoUrl",
    folder: "bwl/teams",
    transformation: [
      { width: 400, height: 400, crop: "fit" },
      { quality: "auto", fetch_format: "auto" },
    ],
  },
  {
    table: "tournament",
    field: "bannerUrl",
    folder: "bwl/tournaments",
    transformation: [
      { width: 1200, height: 630, crop: "fill" },
      { quality: "auto", fetch_format: "auto" },
    ],
  },
];

function decodeBase64(value: string): Buffer | null {
  if (value.startsWith("data:")) {
    const m = value.match(/^data:(.+?);base64,(.+)$/);
    if (!m) return null;
    return Buffer.from(m[2], "base64");
  }
  // Raw base64 fallback
  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

async function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  folder: string,
  transformation: Record<string, unknown>[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        transformation,
      },
      (err, result) => {
        if (err) reject(err);
        else if (result) resolve(result.secure_url);
        else reject(new Error("No result from Cloudinary"));
      },
    );
    stream.end(buffer);
  });
}

async function migrateTable(target: MigrationTarget) {
  console.log(`\n── ${target.table}.${target.field} → Cloudinary (${target.folder}) ──`);

  let rows: Array<{ id: string; name: string; value: string | null }>;
  if (target.table === "player") {
    const r = await prisma.player.findMany({ select: { id: true, name: true, photoUrl: true } });
    rows = r.map((x) => ({ id: x.id, name: x.name, value: x.photoUrl }));
  } else if (target.table === "team") {
    const r = await prisma.team.findMany({ select: { id: true, name: true, logoUrl: true } });
    rows = r.map((x) => ({ id: x.id, name: x.name, value: x.logoUrl }));
  } else {
    const r = await prisma.tournament.findMany({ select: { id: true, name: true, bannerUrl: true } });
    rows = r.map((x) => ({ id: x.id, name: x.name, value: x.bannerUrl }));
  }

  let migrated = 0, skippedHttp = 0, skippedEmpty = 0, failed = 0;

  for (const row of rows) {
    if (!row.value) { skippedEmpty++; continue; }
    if (row.value.startsWith("http://") || row.value.startsWith("https://")) {
      skippedHttp++;
      continue;
    }
    const buffer = decodeBase64(row.value);
    if (!buffer || buffer.length < 100) {
      console.log(`  ✗ ${row.name} — could not decode base64`);
      failed++;
      continue;
    }
    try {
      const sizeKB = Math.round(buffer.length / 1024);
      process.stdout.write(`  ${row.name.padEnd(20)} ${sizeKB}KB → uploading...`);
      const url = await uploadToCloudinary(buffer, row.id, target.folder, target.transformation);

      if (target.table === "player") {
        await prisma.player.update({ where: { id: row.id }, data: { photoUrl: url } });
      } else if (target.table === "team") {
        await prisma.team.update({ where: { id: row.id }, data: { logoUrl: url } });
      } else {
        await prisma.tournament.update({ where: { id: row.id }, data: { bannerUrl: url } });
      }
      console.log(` ✓ ${url.replace(/^https:\/\/res\.cloudinary\.com\/[^/]+/, "...")}`);
      migrated++;
    } catch (err) {
      console.log(` ✗ ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`Done: migrated=${migrated}, already-http=${skippedHttp}, empty=${skippedEmpty}, failed=${failed}`);
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary env vars missing. Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.");
  }
  for (const t of TARGETS) {
    await migrateTable(t);
  }
  console.log("\n✓ Migration complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
