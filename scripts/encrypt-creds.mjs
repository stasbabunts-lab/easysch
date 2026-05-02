/**
 * One-shot migration: encrypts any plain-text BankAccount.creds in the SQLite DB.
 * Run on the server after deploying the encryption code:
 *
 *   node scripts/encrypt-creds.mjs
 *
 * Safe to run multiple times — already-encrypted records are skipped.
 */

import { createCipheriv, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

// ── Load .env.local ────────────────────────────────────────────────────────────
function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l && l.includes("=") && !l.startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

const env = loadEnv(".env.local");
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;
const DB_PATH = (env.DATABASE_URL ?? "file:./data/prod.db")
  .replace(/^file:/, "")
  .replace(/^\.\//, "");

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error("❌  ENCRYPTION_KEY missing or invalid in .env.local (must be 64 hex chars).");
  process.exit(1);
}

const KEY = Buffer.from(ENCRYPTION_KEY, "hex");
const PREFIX = "enc:";

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ── Connect to SQLite ──────────────────────────────────────────────────────────
const Database = require("better-sqlite3");
const db = new Database(DB_PATH);

const accounts = db.prepare("SELECT id, creds FROM BankAccount").all();
const update = db.prepare("UPDATE BankAccount SET creds = ? WHERE id = ?");

let count = 0;
for (const acc of accounts) {
  if (acc.creds.startsWith(PREFIX)) {
    console.log(`  skip  ${acc.id} (already encrypted)`);
    continue;
  }
  update.run(encrypt(acc.creds), acc.id);
  console.log(`  ✓     ${acc.id} encrypted`);
  count++;
}

db.close();
console.log(`\nDone: ${count} record(s) encrypted.`);
