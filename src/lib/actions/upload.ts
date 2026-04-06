"use server";

import { auth } from "@/lib/auth";

export async function uploadPlayerImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { success: false, error: "No file provided" };

  console.log("Upload attempt:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP, or GIF.` };
  }

  // Validate file size (2MB max for base64 storage)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return { success: false, error: "File too large. Max 2MB for avatar images." };
  }

  try {
    // Convert to base64 data URL (works on all platforms including Vercel)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    console.log("Image converted to data URL, length:", dataUrl.length);

    return { success: true, url: dataUrl };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: `Upload failed: ${error.message || "Unknown error"}` };
  }
}
