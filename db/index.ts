import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getD1() {
  if (!env.DB) {
    throw new Error("数据库暂时不可用，请稍后重试。");
  }
  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          username_key TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS rooms (
          code TEXT PRIMARY KEY,
          host_user_id TEXT NOT NULL,
          status TEXT NOT NULL,
          state_json TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS study_progress (
          user_id TEXT NOT NULL,
          word_key TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, word_key)
        )`),
        db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_key ON users(username_key)"),
      ])
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
