/**
 * Client-side image compression.
 *
 * Server Actions have a request body-size limit, so large photos (a 2MB+ PNG)
 * get rejected before they reach Cloudinary. We downscale + re-encode to WebP
 * in the browser first, which typically shrinks a multi-MB PNG to well under
 * a few hundred KB while keeping it visually identical.
 *
 * Runs in the browser only (uses <canvas>). GIFs are passed through untouched
 * so their animation survives.
 */

export interface CompressOptions {
  /** Longest edge in px; larger images are scaled down to fit. Default 1600. */
  maxDimension?: number;
  /** WebP quality 0–1. Default 0.82. */
  quality?: number;
}

export async function compressImageToWebp(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;

  // Only re-encode raster images we can safely draw to a canvas.
  // GIFs would lose their animation, so leave them alone.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (typeof document === "undefined") return file; // SSR guard

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // couldn't decode — let the server deal with the original
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob) return file; // browser without WebP encode support

  // Don't make an already-small file bigger.
  if (blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
