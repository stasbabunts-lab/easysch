import Database from "better-sqlite3";
import path from "path";

// Standalone SQLite database for the personal goal board (/board), kept fully
// separate from the main Prisma database (data/prod.db) so board changes can
// never touch the core scheduling/payments data. One row per teacher holds the
// whole board state (categories → cards → subtasks, loose cards, todos, drag
// layout) as a single JSON blob. Reminders are NOT stored here — they reuse the
// main `Reminder` model + cron Telegram delivery via /api/reminders.

const globalForBoard = globalThis as unknown as { boardDb?: Database.Database };

function resolveBoardPath(): string {
  // Sit next to the main DB file (data/board.db in prod, ./board.db in dev),
  // unless overridden. Relative paths resolve against the app's cwd.
  const explicit = process.env.BOARD_DATABASE_URL?.replace(/^file:/, "");
  if (explicit) return explicit;
  const mainUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const mainPath = mainUrl.replace(/^file:/, "");
  return path.join(path.dirname(mainPath), "board.db");
}

function createBoardDb(): Database.Database {
  const db = new Database(resolveBoardPath());
  // WAL: concurrent reads while a write is in flight (same tuning as prisma.ts).
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS Board (
      teacherId TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  return db;
}

function boardDb(): Database.Database {
  if (!globalForBoard.boardDb) globalForBoard.boardDb = createBoardDb();
  return globalForBoard.boardDb;
}

/** Raw board JSON string for a teacher, or null if they have no board yet. */
export function getBoardData(teacherId: string): string | null {
  const row = boardDb()
    .prepare("SELECT data FROM Board WHERE teacherId = ?")
    .get(teacherId) as { data: string } | undefined;
  return row?.data ?? null;
}

/** Upsert the whole board JSON blob for a teacher. */
export function setBoardData(teacherId: string, data: string): void {
  boardDb()
    .prepare(
      `INSERT INTO Board (teacherId, data, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(teacherId) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`
    )
    .run(teacherId, data, new Date().toISOString());
}
