import { ensureSchema, getD1 } from "../../../../db";
import { getSessionUser } from "../../../../lib/auth";
import { VOCABULARY_CATEGORY_OPTIONS } from "../../../../lib/vocabulary";

type CountRow = { value: number };
type FeatureRow = { feature: string; users: number; sessions: number; activeSeconds: number };
type EventRow = { eventName: string; users: number; events: number };
type UserRow = {
  username: string;
  createdAt: number;
  studiedWords: number;
  masteredWords: number;
  activeSeconds: number;
  lastActiveAt: number;
};

function beijingDayKey(timestamp: number) {
  const date = new Date((timestamp + 8 * 60 * 60) * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfBeijingDay(daysAgo = 0) {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return Math.floor((Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo) - 8 * 60 * 60 * 1000) / 1000);
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "请先登录管理员账号。" }, { status: 401 });
    if (!user.isAdmin) return Response.json({ error: "你没有管理员权限。" }, { status: 403 });

    const db = getD1();
    const todayStart = startOfBeijingDay();
    const sevenDayStart = startOfBeijingDay(6);
    const thirtyDayStart = startOfBeijingDay(29);
    const fourteenDayStart = startOfBeijingDay(13);

    const [
      totalUsers,
      newToday,
      newSevenDays,
      activeToday,
      activeSevenDays,
      roomCount,
      finishedRooms,
      studiedUsers,
      studiedWords,
      masteredWords,
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS value FROM users").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM users WHERE created_at >= ?").bind(todayStart).first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM users WHERE created_at >= ?").bind(sevenDayStart).first<CountRow>(),
      db.prepare("SELECT COUNT(DISTINCT user_id) AS value FROM analytics_sessions WHERE started_at >= ?").bind(todayStart).first<CountRow>(),
      db.prepare("SELECT COUNT(DISTINCT user_id) AS value FROM analytics_sessions WHERE started_at >= ?").bind(sevenDayStart).first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM rooms").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM rooms WHERE status = 'finished'").first<CountRow>(),
      db.prepare("SELECT COUNT(DISTINCT user_id) AS value FROM study_progress").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM study_progress").first<CountRow>(),
      db.prepare("SELECT COUNT(*) AS value FROM study_progress WHERE level = 4").first<CountRow>(),
    ]);

    const featureResult = await db.prepare(
      `SELECT feature,
              COUNT(DISTINCT user_id) AS users,
              COUNT(*) AS sessions,
              COALESCE(SUM(active_seconds), 0) AS activeSeconds
       FROM analytics_sessions
       GROUP BY feature
       ORDER BY activeSeconds DESC`,
    ).all<FeatureRow>();

    const eventResult = await db.prepare(
      `SELECT event_name AS eventName,
              COUNT(DISTINCT user_id) AS users,
              COUNT(*) AS events
       FROM analytics_events
       GROUP BY event_name
       ORDER BY events DESC`,
    ).all<EventRow>();

    const userResult = await db.prepare(
      `SELECT u.username,
              u.created_at AS createdAt,
              COUNT(sp.word_key) AS studiedWords,
              COALESCE(SUM(CASE WHEN sp.level = 4 THEN 1 ELSE 0 END), 0) AS masteredWords,
              COALESCE((SELECT SUM(active_seconds) FROM analytics_sessions s WHERE s.user_id = u.id), 0) AS activeSeconds,
              COALESCE((SELECT MAX(last_seen_at) FROM analytics_sessions s WHERE s.user_id = u.id), u.created_at) AS lastActiveAt
       FROM users u
       LEFT JOIN study_progress sp ON sp.user_id = u.id
       GROUP BY u.id, u.username, u.created_at
       ORDER BY u.created_at DESC
       LIMIT 100`,
    ).all<UserRow>();

    const registrations = await db.prepare(
      "SELECT created_at AS createdAt FROM users WHERE created_at >= ?",
    ).bind(fourteenDayStart).all<{ createdAt: number }>();
    const recentSessions = await db.prepare(
      `SELECT user_id AS userId, started_at AS startedAt, active_seconds AS activeSeconds
       FROM analytics_sessions WHERE started_at >= ?`,
    ).bind(fourteenDayStart).all<{ userId: string; startedAt: number; activeSeconds: number }>();

    const daily = Array.from({ length: 14 }, (_, index) => {
      const timestamp = startOfBeijingDay(13 - index);
      return { day: beijingDayKey(timestamp), registrations: 0, activeUsers: 0, activeSeconds: 0 };
    });
    const dailyMap = new Map(daily.map((item) => [item.day, item]));
    for (const row of registrations.results) {
      const item = dailyMap.get(beijingDayKey(row.createdAt));
      if (item) item.registrations += 1;
    }
    const dailyUsers = new Map<string, Set<string>>();
    for (const row of recentSessions.results) {
      const day = beijingDayKey(row.startedAt);
      const item = dailyMap.get(day);
      if (!item) continue;
      item.activeSeconds += row.activeSeconds;
      if (!dailyUsers.has(day)) dailyUsers.set(day, new Set());
      dailyUsers.get(day)!.add(row.userId);
    }
    for (const item of daily) item.activeUsers = dailyUsers.get(item.day)?.size ?? 0;

    const categoryNames = new Map(VOCABULARY_CATEGORY_OPTIONS.map((category) => [category.id, category.zh]));
    const categoryCounts = new Map<string, number>();
    const categoryEvents = await db.prepare(
      `SELECT metadata_json AS metadataJson
       FROM analytics_events
       WHERE event_name = 'study_categories_selected' AND created_at >= ?
       ORDER BY created_at DESC LIMIT 2000`,
    ).bind(thirtyDayStart).all<{ metadataJson: string | null }>();
    for (const row of categoryEvents.results) {
      try {
        const metadata = JSON.parse(row.metadataJson ?? "{}") as { categoryIds?: unknown };
        if (!Array.isArray(metadata.categoryIds)) continue;
        for (const categoryId of metadata.categoryIds) {
          if (typeof categoryId === "string" && categoryNames.has(categoryId)) {
            categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
          }
        }
      } catch {
        // Ignore malformed historical metadata.
      }
    }

    return Response.json({
      viewer: { username: user.username },
      generatedAt: Math.floor(Date.now() / 1000),
      overview: {
        totalUsers: totalUsers?.value ?? 0,
        newToday: newToday?.value ?? 0,
        newSevenDays: newSevenDays?.value ?? 0,
        activeToday: activeToday?.value ?? 0,
        activeSevenDays: activeSevenDays?.value ?? 0,
        roomCount: roomCount?.value ?? 0,
        finishedRooms: finishedRooms?.value ?? 0,
        studiedUsers: studiedUsers?.value ?? 0,
        studiedWords: studiedWords?.value ?? 0,
        masteredWords: masteredWords?.value ?? 0,
      },
      featureUsage: featureResult.results,
      eventUsage: eventResult.results,
      daily,
      popularCategories: [...categoryCounts.entries()]
        .map(([id, count]) => ({ id, name: categoryNames.get(id) ?? id, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10),
      users: userResult.results,
    });
  } catch {
    return Response.json({ error: "暂时无法读取统计数据。" }, { status: 500 });
  }
}
