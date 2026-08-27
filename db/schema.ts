import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameKey: text("username_key").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_users_username_key").on(table.usernameKey)],
);

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const rooms = sqliteTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    hostUserId: text("host_user_id").notNull(),
    status: text("status").notNull(),
    stateJson: text("state_json").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_rooms_status_updated_at").on(table.status, table.updatedAt)],
);

export const studyProgress = sqliteTable(
  "study_progress",
  {
    userId: text("user_id").notNull(),
    wordKey: text("word_key").notNull(),
    level: integer("level").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.wordKey] })],
);

export const appAdmins = sqliteTable("app_admins", {
  userId: text("user_id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    feature: text("feature").notNull(),
    eventName: text("event_name").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_analytics_events_created_at").on(table.createdAt),
    index("idx_analytics_events_user_created").on(table.userId, table.createdAt),
    index("idx_analytics_events_feature_created").on(table.feature, table.createdAt),
  ],
);

export const analyticsSessions = sqliteTable(
  "analytics_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    feature: text("feature").notNull(),
    startedAt: integer("started_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    activeSeconds: integer("active_seconds").notNull().default(0),
    endedAt: integer("ended_at"),
  },
  (table) => [
    index("idx_analytics_sessions_user_started").on(table.userId, table.startedAt),
    index("idx_analytics_sessions_feature_started").on(table.feature, table.startedAt),
  ],
);
