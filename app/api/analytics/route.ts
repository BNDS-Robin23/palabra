import { ensureSchema, getD1 } from "../../../db";
import { getSessionUser } from "../../../lib/auth";
import {
  isAnalyticsEvent,
  isAnalyticsFeature,
  type AnalyticsEventName,
} from "../../../lib/analytics-definitions";
import { recordAnalyticsEvent } from "../../../lib/analytics";

type AnalyticsPayload = {
  action?: "start" | "heartbeat" | "end" | "event";
  sessionId?: string;
  feature?: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
};

const CLIENT_EVENTS = new Set<AnalyticsEventName>(["study_categories_selected", "audio_play"]);

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
    const payload = (await request.json()) as AnalyticsPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.action === "start") {
      if (!isAnalyticsFeature(payload.feature)) {
        return Response.json({ error: "无效的功能类型。" }, { status: 400 });
      }
      const sessionId = crypto.randomUUID();
      await getD1().prepare(
        `INSERT INTO analytics_sessions
         (id, user_id, feature, started_at, last_seen_at, active_seconds, ended_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL)`,
      ).bind(sessionId, user.id, payload.feature, now, now).run();
      return Response.json({ sessionId });
    }

    if (payload.action === "heartbeat" || payload.action === "end") {
      const sessionId = payload.sessionId?.trim() ?? "";
      if (!sessionId || sessionId.length > 80) {
        return Response.json({ error: "无效的统计会话。" }, { status: 400 });
      }
      const ending = payload.action === "end" ? now : null;
      await getD1().prepare(
        `UPDATE analytics_sessions
         SET active_seconds = active_seconds + MIN(30, MAX(0, ? - last_seen_at)),
             last_seen_at = ?,
             ended_at = COALESCE(?, ended_at)
         WHERE id = ? AND user_id = ? AND ended_at IS NULL`,
      ).bind(now, now, ending, sessionId, user.id).run();
      return Response.json({ ok: true });
    }

    if (payload.action === "event") {
      if (
        !isAnalyticsFeature(payload.feature)
        || !isAnalyticsEvent(payload.eventName)
        || !CLIENT_EVENTS.has(payload.eventName)
      ) {
        return Response.json({ error: "无效的统计事件。" }, { status: 400 });
      }
      await recordAnalyticsEvent(user.id, payload.feature, payload.eventName, payload.metadata);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "不支持的统计操作。" }, { status: 400 });
  } catch {
    return Response.json({ error: "暂时无法记录使用数据。" }, { status: 500 });
  }
}
