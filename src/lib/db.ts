import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always store on global so Vercel Fluid Compute reuses the connection pool
// across requests within the same warm container — in both dev and production.
globalForPrisma.prisma = prisma;
