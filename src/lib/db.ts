import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: appendPoolParams(process.env.DATABASE_URL),
  });

// Always store on global so Vercel Fluid Compute reuses the connection pool
// across requests within the same warm container — in both dev and production.
globalForPrisma.prisma = prisma;

/**
 * Append connection pool parameters to the DATABASE_URL if not already present.
 * - connection_limit: max connections in the pool (default 10, Railway free tier uses 3)
 * - pool_timeout: seconds to wait for a connection before erroring (default 10)
 */
function appendPoolParams(url: string | undefined): string | undefined {
  if (!url) return url;

  const params: Record<string, string> = {
    connection_limit: process.env.DATABASE_POOL_SIZE ?? "10",
    pool_timeout: process.env.DATABASE_POOL_TIMEOUT ?? "10",
  };

  const separator = url.includes("?") ? "&" : "?";
  const additions = Object.entries(params)
    .filter(([key]) => !url.includes(key))
    .map(([key, val]) => `${key}=${val}`)
    .join("&");

  return additions ? `${url}${separator}${additions}` : url;
}
