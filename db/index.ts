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
        db.prepare(`CREATE TABLE IF NOT EXISTS app_admins (
          user_id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          feature TEXT NOT NULL,
          event_name TEXT NOT NULL,
          metadata_json TEXT,
          created_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS analytics_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          feature TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          active_seconds INTEGER NOT NULL DEFAULT 0,
          ended_at INTEGER
        )`),
        db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_key ON users(username_key)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_rooms_status_updated_at ON rooms(status, updated_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events(user_id, created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_feature_created ON analytics_events(feature, created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_started ON analytics_sessions(user_id, started_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_sessions_feature_started ON analytics_sessions(feature, started_at)"),
      ])
      .then(async () => {
        await db.prepare(
          `INSERT OR IGNORE INTO app_admins (user_id, created_at)
           SELECT id, ? FROM users WHERE username_key = 'robin'`,
        ).bind(Math.floor(Date.now() / 1000)).run();
        await db.prepare("PRAGMA optimize").run();
      })
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
