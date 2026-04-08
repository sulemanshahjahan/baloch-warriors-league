"use server";

import { auth } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Cloudinary handles the heavy lifting)
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload player image to Cloudinary
 * Returns a CDN URL instead of base64 data URL
 */
export async function uploadPlayerImage(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP, or GIF.` };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Max 10MB." };
  }

  try {
    // Convert file to buffer for Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "bwl/players",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error(error.message || "Upload failed"));
          } else if (result) {
            resolve({
              success: true,
              url: result.secure_url,
            });
          } else {
            reject(new Error("No result from Cloudinary"));
          }
        }
      );

      // Write buffer to stream
      const { Readable } = require("stream");
      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });

    console.log("Image uploaded to Cloudinary:", result.url);
    return result;
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: `Upload failed: ${error.message || "Unknown error"}` };
  }
}

/**
 * Upload team logo to Cloudinary
 */
export async function uploadTeamLogo(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP, or GIF.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Max 10MB." };
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "bwl/teams",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error(error.message || "Upload failed"));
          } else if (result) {
            resolve({
              success: true,
              url: result.secure_url,
            });
          } else {
            reject(new Error("No result from Cloudinary"));
          }
        }
      );

      const { Readable } = require("stream");
      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });

    console.log("Team logo uploaded to Cloudinary:", result.url);
    return result;
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: `Upload failed: ${error.message || "Unknown error"}` };
  }
}

/**
 * Upload tournament banner/logo to Cloudinary
 */
export async function uploadTournamentImage(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP, or GIF.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Max 10MB." };
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "bwl/tournaments",
          resource_type: "image",
          transformation: [
            { width: 1200, height: 600, crop: "fill" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error(error.message || "Upload failed"));
          } else if (result) {
            resolve({
              success: true,
              url: result.secure_url,
            });
          } else {
            reject(new Error("No result from Cloudinary"));
          }
        }
      );

      const { Readable } = require("stream");
      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });

    console.log("Tournament image uploaded to Cloudinary:", result.url);
    return result;
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: `Upload failed: ${error.message || "Unknown error"}` };
  }
}

/**
 * Delete image from Cloudinary by URL
 */
export async function deleteImageFromCloudinary(url: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{filename}
    const urlMatch = url.match(/\/upload\/v\d+\/(.+?)\.[^.]+$/);
    if (!urlMatch) {
      return { success: false, error: "Invalid Cloudinary URL" };
    }

    const publicId = urlMatch[1];
    await cloudinary.uploader.destroy(publicId);
    console.log("Image deleted from Cloudinary:", publicId);

    return { success: true };
  } catch (error: any) {
    console.error("Delete error:", error);
    return { success: false, error: `Delete failed: ${error.message || "Unknown error"}` };
  }
}
