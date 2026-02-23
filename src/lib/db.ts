import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();
  client.$executeRawUnsafe("PRAGMA journal_mode=WAL").catch((err: unknown) => {
    console.warn("[db] Failed to enable WAL mode:", err);
  });
  client.$executeRawUnsafe("PRAGMA cache_size=-32000").catch(() => {});
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
