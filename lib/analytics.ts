import { getD1 } from "../db";
import type { AnalyticsEventName, AnalyticsFeature } from "./analytics-definitions";

function metadataJson(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  const encoded = JSON.stringify(metadata);
  return encoded.length <= 2000 ? encoded : JSON.stringify({ omitted: "metadata_too_large" });
}

export async function recordAnalyticsEvent(
  userId: string,
  feature: AnalyticsFeature,
  eventName: AnalyticsEventName,
  metadata?: Record<string, unknown>,
) {
  try {
    await getD1().prepare(
      `INSERT INTO analytics_events (user_id, feature, event_name, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(userId, feature, eventName, metadataJson(metadata), Math.floor(Date.now() / 1000)).run();
  } catch {
    // Analytics must never block registration, learning, or gameplay.
  }
}
