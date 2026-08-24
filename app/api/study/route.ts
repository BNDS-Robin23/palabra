import { ensureSchema, getD1 } from "../../../db";
import { getSessionUser } from "../../../lib/auth";
import { isVocabularyWordKey, STUDY_MAX_LEVEL, studyWordKey } from "../../../lib/study";

type StudyPayload = {
  word?: string;
  level?: number;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "发生了未知错误。";
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "请先登录后再学习单词。" }, { status: 401 });

    const result = await getD1().prepare(
      "SELECT word_key AS wordKey, level FROM study_progress WHERE user_id = ?",
    ).bind(user.id).all<{ wordKey: string; level: number }>();
    const progress = Object.fromEntries(
      result.results.map((row) => [row.wordKey, Math.min(STUDY_MAX_LEVEL, Math.max(0, row.level))]),
    );
    return Response.json({ progress });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "登录已失效，请重新登录。" }, { status: 401 });

    const payload = (await request.json()) as StudyPayload;
    const wordKey = studyWordKey(payload.word ?? "");
    const level = payload.level;
    if (!isVocabularyWordKey(wordKey) || !Number.isInteger(level) || level! < 0 || level! > STUDY_MAX_LEVEL) {
      return Response.json({ error: "无效的单词学习进度。" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    await getD1().prepare(
      `INSERT INTO study_progress (user_id, word_key, level, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, word_key) DO UPDATE SET
         level = MAX(study_progress.level, excluded.level),
         updated_at = excluded.updated_at`,
    ).bind(user.id, wordKey, level, now).run();
    const saved = await getD1().prepare(
      "SELECT level FROM study_progress WHERE user_id = ? AND word_key = ?",
    ).bind(user.id, wordKey).first<{ level: number }>();
    return Response.json({ wordKey, level: saved?.level ?? level });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
