import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  // Disable Turbopack to use webpack (required for next-pwa)
  turbopack: {},
  
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.vercel-storage.com" },
    ],
    minimumCacheTTL: 3600,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

// PWA Configuration for offline support
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/bwlleague\.com\/api\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /^https:\/\/bwlleague\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "page-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
});

export default pwaConfig(nextConfig);
