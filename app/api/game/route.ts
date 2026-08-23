import { ensureSchema, getD1 } from "../../../db";
import { getSessionUser, type SessionUser } from "../../../lib/auth";
import {
  addAiPlayer,
  addHumanPlayer,
  createWaitingState,
  drawForHuman,
  passHumanTurn,
  playHumanCard,
  processAiTurns,
  setPracticeSetting,
  startGame,
  toPublicState,
  type GameMode,
  type GameState,
  type PracticeSettings,
} from "../../../lib/game";

type RoomRow = {
  code: string;
  hostUserId: string;
  status: GameState["status"];
  stateJson: string;
  version: number;
};

type GamePayload = {
  action?: "create" | "join" | "add_ai" | "start" | "play" | "draw" | "pass" | "update_settings";
  code?: string;
  cardId?: string;
  mode?: GameMode;
  setting?: keyof PracticeSettings;
  value?: boolean;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "发生了未知错误。";
}

function cleanCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new Error("请先登录。");
  return user;
}

async function loadRoom(code: string) {
  if (code.length !== 6) throw new Error("请输入 6 位房间号。");
  const room = await getD1().prepare(
    `SELECT code, host_user_id AS hostUserId, status, state_json AS stateJson, version
     FROM rooms WHERE code = ?`,
  ).bind(code).first<RoomRow>();
  if (!room) throw new Error("没有找到这个房间。");
  return room;
}

function parseState(room: RoomRow) {
  return JSON.parse(room.stateJson) as GameState;
}

async function saveRoom(room: RoomRow, state: GameState) {
  const result = await getD1().prepare(
    `UPDATE rooms
     SET state_json = ?, status = ?, version = version + 1, updated_at = ?
     WHERE code = ? AND version = ?`,
  ).bind(JSON.stringify(state), state.status, Math.floor(Date.now() / 1000), room.code, room.version).run();
  if ((result.meta.changes ?? 0) !== 1) throw new Error("牌局刚刚发生变化，请重试。");
  return room.version + 1;
}

function viewerPlayerId(state: GameState, user: SessionUser) {
  const player = state.players.find((candidate) => candidate.userId === user.id);
  if (!player) throw new Error("你不在这个房间中。");
  return player.id;
}

function roomResponse(room: RoomRow, state: GameState, version: number, user: SessionUser) {
  return Response.json({ game: toPublicState(state, room.code, version, user.id, room.hostUserId) });
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser(request);
    const code = cleanCode(new URL(request.url).searchParams.get("code"));
    const room = await loadRoom(code);
    const state = parseState(room);
    viewerPlayerId(state, user);
    return roomResponse(room, state, room.version, user);
  } catch (error) {
    const status = errorMessage(error) === "请先登录。" ? 401 : 400;
    return Response.json({ error: errorMessage(error) }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireUser(request);
    const payload = (await request.json()) as GamePayload;

    if (payload.action === "create") {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const random = new Uint8Array(6);
        crypto.getRandomValues(random);
        const code = Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("");
        const mode: GameMode = payload.mode === "practice" ? "practice" : "normal";
        const state = createWaitingState(user.id, user.username, mode);
        const now = Math.floor(Date.now() / 1000);
        try {
          await getD1().prepare(
            `INSERT INTO rooms (code, host_user_id, status, state_json, version, created_at, updated_at)
             VALUES (?, ?, 'waiting', ?, 1, ?, ?)`,
          ).bind(code, user.id, JSON.stringify(state), now, now).run();
          const room: RoomRow = { code, hostUserId: user.id, status: "waiting", stateJson: JSON.stringify(state), version: 1 };
          return roomResponse(room, state, 1, user);
        } catch {
          // Extremely rare room-code collision; generate another code.
        }
      }
      throw new Error("暂时无法生成房间号，请重试。");
    }

    const code = cleanCode(payload.code);
    const room = await loadRoom(code);
    const state = parseState(room);

    if (payload.action === "join") {
      addHumanPlayer(state, user.id, user.username);
      const alreadySaved = room.stateJson === JSON.stringify(state);
      const version = alreadySaved ? room.version : await saveRoom(room, state);
      return roomResponse(room, state, version, user);
    }

    const playerId = viewerPlayerId(state, user);
    if (payload.action === "add_ai") {
      if (room.hostUserId !== user.id) throw new Error("只有房主可以添加 AI。");
      addAiPlayer(state);
    } else if (payload.action === "update_settings") {
      if (room.hostUserId !== user.id) throw new Error("只有房主可以修改练习设置。");
      if (
        !payload.setting
        || !["showChinese", "showPlayedMeanings"].includes(payload.setting)
        || typeof payload.value !== "boolean"
      ) throw new Error("练习设置无效。");
      setPracticeSetting(state, payload.setting, payload.value);
    } else if (payload.action === "start") {
      if (room.hostUserId !== user.id) throw new Error("只有房主可以开始牌局。");
      startGame(state);
      processAiTurns(state);
    } else if (payload.action === "play") {
      if (!payload.cardId) throw new Error("请选择一张牌。");
      playHumanCard(state, playerId, payload.cardId);
      processAiTurns(state);
    } else if (payload.action === "draw") {
      drawForHuman(state, playerId);
    } else if (payload.action === "pass") {
      passHumanTurn(state, playerId);
      processAiTurns(state);
    } else {
      throw new Error("不支持的操作。");
    }

    const version = await saveRoom(room, state);
    return roomResponse(room, state, version, user);
  } catch (error) {
    const text = errorMessage(error);
    const status = text === "请先登录。" ? 401 : text.includes("发生变化") ? 409 : 400;
    return Response.json({ error: text }, { status });
  }
}
