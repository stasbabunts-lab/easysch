import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePath = dbUrl.replace(/^file:/, "");
  // timeout = SQLite busy_timeout (ms): on a momentarily locked DB, wait and retry
  // instead of failing immediately with SQLITE_BUSY.
  const adapter = new PrismaBetterSqlite3({ url: filePath, timeout: 5000 });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // WAL lets reads run concurrently with an in-flight write instead of blocking it.
  // journal_mode is persisted on the DB file, so this is effectively a one-time
  // switch that also covers freshly created databases (dev / fresh deploys).
  // Fire-and-forget: harmless and idempotent if already in WAL.
  client.$queryRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {});
  client.$queryRawUnsafe("PRAGMA synchronous = NORMAL").catch(() => {});

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
