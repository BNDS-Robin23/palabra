import { ensureSchema, getD1 } from "../../../db";
import {
  createPasswordHash,
  createSession,
  deleteSession,
  getSessionUser,
  isAdminUser,
  normalizeUsername,
  validUsername,
  verifyPassword,
} from "../../../lib/auth";
import { recordAnalyticsEvent } from "../../../lib/analytics";

type AuthPayload = {
  action?: "register" | "login" | "logout";
  username?: string;
  password?: string;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "发生了未知错误。";
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    return Response.json({ user: await getSessionUser(request) });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as AuthPayload;
    if (payload.action === "logout") {
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": await deleteSession(request) } },
      );
    }

    const username = payload.username?.normalize("NFKC").trim() ?? "";
    const password = payload.password ?? "";
    if (!validUsername(username)) {
      return Response.json({ error: "用户名需为 2–16 个汉字、字母、数字、下划线或短横线。" }, { status: 400 });
    }
    if (password.length < 6 || password.length > 72) {
      return Response.json({ error: "密码长度需为 6–72 位。" }, { status: 400 });
    }

    const db = getD1();
    const usernameKey = normalizeUsername(username);
    if (payload.action === "register") {
      const existing = await db.prepare("SELECT id FROM users WHERE username_key = ?").bind(usernameKey).first();
      if (existing) return Response.json({ error: "这个用户名已经被使用。" }, { status: 409 });
      const id = crypto.randomUUID();
      const passwordHash = await createPasswordHash(password);
      const now = Math.floor(Date.now() / 1000);
      try {
        await db.prepare(
          "INSERT INTO users (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        ).bind(id, username, usernameKey, passwordHash, now).run();
      } catch {
        return Response.json({ error: "这个用户名已经被使用。" }, { status: 409 });
      }
      await recordAnalyticsEvent(id, "auth", "register");
      const cookie = await createSession(id, request);
      return Response.json({ user: { id, username, isAdmin: false } }, { status: 201, headers: { "Set-Cookie": cookie } });
    }

    if (payload.action === "login") {
      const user = await db.prepare(
        "SELECT id, username, password_hash AS passwordHash FROM users WHERE username_key = ?",
      ).bind(usernameKey).first<{ id: string; username: string; passwordHash: string }>();
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return Response.json({ error: "用户名或密码不正确。" }, { status: 401 });
      }
      await recordAnalyticsEvent(user.id, "auth", "login");
      const cookie = await createSession(user.id, request);
      return Response.json(
        { user: { id: user.id, username: user.username, isAdmin: await isAdminUser(user.id) } },
        { headers: { "Set-Cookie": cookie } },
      );
    }

    return Response.json({ error: "不支持的操作。" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
