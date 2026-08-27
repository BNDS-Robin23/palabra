import { COLORS, buildDeck, canPlayCard, cardsMatch, selectGameCategoryIds, type CardColor, type GameCard } from "./cards";
import { VOCABULARY_CATEGORY_NAMES } from "./vocabulary";

export type GameMode = "normal" | "practice";
export type PracticeSettings = {
  showChinese: boolean;
  showPlayedMeanings: boolean;
};

export type Player = {
  id: string;
  name: string;
  type: "human" | "ai";
  userId?: string;
  hand: GameCard[];
};

export type GameLog = {
  id: number;
  text: string;
  tone: "normal" | "action" | "warning" | "success";
};

export type Reveal = {
  id: number;
  actorId: string;
  topWord: string;
  topZh: string;
  playedWord: string;
  playedZh: string;
};

export type PlayEvent = {
  id: number;
  actorId: string;
  actorName: string;
  actorType: Player["type"];
  card: GameCard;
};

export type GameState = {
  mode?: GameMode;
  practiceSettings?: PracticeSettings;
  categoryIds?: string[];
  players: Player[];
  drawPile: GameCard[];
  discardPile: GameCard[];
  currentIndex: number;
  direction: 1 | -1;
  status: "waiting" | "playing" | "finished";
  firstMove: boolean;
  drawnCardId?: string;
  winnerId?: string;
  sequence: number;
  reveal?: Reveal;
  playEvents?: PlayEvent[];
  logs: GameLog[];
};

export type ClientCard = Pick<GameCard, "id" | "word" | "kind" | "color" | "action"> & {
  zh?: string;
  categories?: string[];
};

export type PublicGameState = {
  code: string;
  version: number;
  mode: GameMode;
  practiceSettings: PracticeSettings;
  categoryIds: string[];
  status: GameState["status"];
  players: Array<{
    id: string;
    name: string;
    type: Player["type"];
    handCount: number;
    isCurrent: boolean;
    isHost: boolean;
  }>;
  hand: ClientCard[];
  viewerPlayerId: string;
  currentPlayerId: string | null;
  direction: GameState["direction"];
  firstMove: boolean;
  drawnCardId?: string;
  drawCount: number;
  topCard: ClientCard | null;
  winnerId?: string;
  reveal?: Reveal;
  playEvents: Array<Omit<PlayEvent, "card"> & { card: ClientCard }>;
  logs: GameLog[];
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextIndex(state: GameState, from = state.currentIndex) {
  const length = state.players.length;
  return (from + state.direction + length) % length;
}

function addLog(state: GameState, text: string, tone: GameLog["tone"] = "normal") {
  state.sequence += 1;
  state.logs.unshift({ id: state.sequence, text, tone });
  state.logs = state.logs.slice(0, 10);
}

function addPlayEvent(state: GameState, player: Player, card: GameCard) {
  state.sequence += 1;
  state.playEvents = [
    ...(state.playEvents ?? []),
    {
      id: state.sequence,
      actorId: player.id,
      actorName: player.name,
      actorType: player.type,
      card: { ...card, groups: card.groups ? [...card.groups] : undefined },
    },
  ].slice(-64);
}

function normalizedMode(state: GameState): GameMode {
  return state.mode === "practice" ? "practice" : "normal";
}

function normalizedPracticeSettings(state: GameState): PracticeSettings {
  return {
    showChinese: state.practiceSettings?.showChinese === true,
    showPlayedMeanings: state.practiceSettings?.showPlayedMeanings === true,
  };
}

function showPlayedMeanings(state: GameState) {
  return normalizedMode(state) === "practice" && normalizedPracticeSettings(state).showPlayedMeanings;
}

function replenishPile(state: GameState) {
  if (state.drawPile.length || state.discardPile.length <= 1) return;
  const top = state.discardPile[state.discardPile.length - 1];
  state.drawPile = shuffle(state.discardPile.slice(0, -1).map((card) => (
    card.action === "wild" ? { ...card, color: undefined } : card
  )));
  state.discardPile = [top];
  addLog(state, "弃牌堆已重新洗成牌堆。", "normal");
}

function drawOne(state: GameState) {
  replenishPile(state);
  return state.drawPile.pop() ?? null;
}

function drawMany(state: GameState, player: Player, count: number) {
  for (let i = 0; i < count; i += 1) {
    const card = drawOne(state);
    if (card) player.hand.push(card);
  }
}

export function createWaitingState(
  userId: string,
  username: string,
  mode: GameMode = "normal",
  categoryIds: string[] = [],
): GameState {
  return {
    mode,
    practiceSettings: { showChinese: false, showPlayedMeanings: false },
    categoryIds: selectGameCategoryIds(categoryIds),
    players: [{ id: `human-${userId}`, name: username, type: "human", userId, hand: [] }],
    drawPile: [],
    discardPile: [],
    currentIndex: 0,
    direction: 1,
    status: "waiting",
    firstMove: true,
    sequence: 0,
    playEvents: [],
    logs: [],
  };
}

export function setPracticeSetting(
  state: GameState,
  setting: keyof PracticeSettings,
  value: boolean,
) {
  if (normalizedMode(state) !== "practice") throw new Error("普通房间没有练习设置。");
  if (state.status !== "waiting") throw new Error("开局后不能修改练习设置。");
  state.practiceSettings = { ...normalizedPracticeSettings(state), [setting]: value };
}

export function addHumanPlayer(state: GameState, userId: string, username: string) {
  if (state.players.some((player) => player.userId === userId)) return;
  if (state.status !== "waiting") throw new Error("牌局已经开始，无法加入。");
  if (state.players.length >= 10) throw new Error("房间已满，最多 10 人。");
  state.players.push({ id: `human-${userId}`, name: username, type: "human", userId, hand: [] });
  addLog(state, `${username} 加入了房间。`);
}

export function addAiPlayer(state: GameState) {
  if (state.status !== "waiting") throw new Error("开局后不能再添加 AI。");
  if (state.players.length >= 10) throw new Error("房间已满，最多 10 人。");
  const used = new Set(state.players.map((player) => player.name));
  const names = ["Luna", "Mateo", "Sofía", "Diego", "Alba", "Nico", "Carmen", "Pablo", "Iris"];
  const name = names.find((candidate) => !used.has(candidate)) ?? `Bot ${state.players.length}`;
  state.sequence += 1;
  state.players.push({ id: `ai-${state.sequence}-${Date.now()}`, name, type: "ai", hand: [] });
  addLog(state, `${name}（AI）加入了房间。`);
}

export function startGame(state: GameState) {
  if (state.status !== "waiting") throw new Error("牌局已经开始。");
  if (state.players.length < 2) throw new Error("至少需要 2 名玩家才能开始。");
  state.categoryIds = selectGameCategoryIds(state.categoryIds);
  const deck = shuffle(buildDeck(state.categoryIds));
  for (const player of state.players) player.hand = [];
  for (let round = 0; round < 7; round += 1) {
    for (const player of state.players) {
      const card = deck.pop();
      if (card) player.hand.push(card);
    }
  }
  state.drawPile = deck;
  state.discardPile = [];
  state.currentIndex = 0;
  state.direction = 1;
  state.status = "playing";
  state.firstMove = true;
  state.drawnCardId = undefined;
  state.winnerId = undefined;
  state.reveal = undefined;
  state.playEvents = [];
  state.logs = [];
  addLog(state, `牌局开始，${state.players[0].name} 可以打出任意一张牌。`, "success");
}

const COLOR_NAMES: Record<CardColor, string> = {
  red: "红色",
  yellow: "黄色",
  blue: "蓝色",
  green: "绿色",
};

function applyValidPlay(
  state: GameState,
  playerIndex: number,
  cardIndex: number,
  drawnNow = false,
  wildColor?: CardColor,
) {
  const player = state.players[playerIndex];
  const [card] = player.hand.splice(cardIndex, 1);
  if (card.action === "wild") {
    if (!wildColor || !COLORS.includes(wildColor)) throw new Error("请选择换色牌的新颜色。");
    card.color = wildColor;
  }
  state.discardPile.push(card);
  state.firstMove = false;
  state.drawnCardId = undefined;
  state.reveal = undefined;
  addPlayEvent(state, player, card);
  const meaning = showPlayedMeanings(state) ? `（${card.zh}）` : "";
  addLog(
    state,
    drawnNow
      ? `${player.name} 摸到 ${card.word}${meaning}，符合规则并立即打出。`
      : `${player.name} 打出了 ${card.word}${meaning}。`,
    card.kind === "action" ? "action" : "normal",
  );
  if (card.action === "wild" && card.color) {
    addLog(state, `${player.name} 把当前颜色换成了${COLOR_NAMES[card.color]}。`, "action");
  }

  if (player.hand.length === 0) {
    state.status = "finished";
    state.winnerId = player.id;
    addLog(state, `${player.name} 获胜！`, "success");
    return;
  }

  if (card.action === "skip") {
    const skippedIndex = nextIndex(state, playerIndex);
    addLog(state, `${state.players[skippedIndex].name} 被跳过。`, "action");
    state.currentIndex = nextIndex(state, skippedIndex);
    return;
  }
  if (card.action === "reverse") {
    state.direction = state.direction === 1 ? -1 : 1;
    addLog(state, `出牌方向已${state.direction === 1 ? "变为顺时针" : "变为逆时针"}。`, "action");
    state.currentIndex = nextIndex(state, playerIndex);
    return;
  }
  if (card.action === "draw2") {
    const targetIndex = nextIndex(state, playerIndex);
    drawMany(state, state.players[targetIndex], 2);
    addLog(state, `${state.players[targetIndex].name} 摸 2 张并跳过回合。`, "action");
    state.currentIndex = nextIndex(state, targetIndex);
    return;
  }
  state.currentIndex = nextIndex(state, playerIndex);
}

export function playHumanCard(state: GameState, playerId: string, cardId: string, wildColor?: CardColor) {
  if (state.status !== "playing") throw new Error("牌局尚未开始。");
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0 || playerIndex !== state.currentIndex) throw new Error("还没轮到你。");
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error("这张牌不在你的手牌中。");
  const card = player.hand[cardIndex];
  if (state.drawnCardId && card.id !== state.drawnCardId) {
    throw new Error("摸牌后只能打出刚摸到的牌，或选择结束回合。");
  }
  if (card.kind === "action" && player.hand.length === 1) {
    throw new Error("功能牌不能作为最后一张牌，请先摸牌。");
  }
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  if (!canPlayCard(card, top, state.firstMove, player.hand.length)) {
    const penalty = drawOne(state);
    if (penalty) player.hand.push(penalty);
    state.sequence += 1;
    state.reveal = {
      id: state.sequence,
      actorId: player.id,
      topWord: top?.word ?? "",
      topZh: top?.zh ?? "",
      playedWord: card.word,
      playedZh: card.zh,
    };
    const detail = showPlayedMeanings(state)
      ? `：${card.word}（${card.zh}）不能接 ${top?.word ?? ""}（${top?.zh ?? ""}）`
      : "";
    addLog(state, `${player.name} 匹配失败${detail}，被罚摸 1 张。`, "warning");
    state.drawnCardId = undefined;
    state.currentIndex = nextIndex(state, playerIndex);
    return { valid: false };
  }
  if (card.action === "wild" && (!wildColor || !COLORS.includes(wildColor))) {
    throw new Error("请选择换色牌的新颜色。");
  }
  applyValidPlay(state, playerIndex, cardIndex, false, wildColor);
  return { valid: true };
}

export function drawForHuman(state: GameState, playerId: string) {
  if (state.status !== "playing") throw new Error("牌局尚未开始。");
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0 || playerIndex !== state.currentIndex) throw new Error("还没轮到你。");
  const player = state.players[playerIndex];
  if (state.drawnCardId) throw new Error("本回合已经摸过牌了，请出牌或结束回合。");
  const drawn = drawOne(state);
  if (!drawn) throw new Error("牌堆已经空了。");
  player.hand.push(drawn);
  state.drawnCardId = drawn.id;
  addLog(state, `${player.name} 摸了 1 张牌，正在决定是否出牌。`);
  return { drawnCardId: drawn.id };
}

export function passHumanTurn(state: GameState, playerId: string) {
  if (state.status !== "playing") throw new Error("牌局尚未开始。");
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0 || playerIndex !== state.currentIndex) throw new Error("还没轮到你。");
  if (!state.drawnCardId) throw new Error("摸牌后才能选择结束回合。");
  const player = state.players[playerIndex];
  state.drawnCardId = undefined;
  addLog(state, `${player.name} 保留摸到的牌并结束回合。`);
  state.currentIndex = nextIndex(state, playerIndex);
}

function chooseAiCard(state: GameState, player: Player) {
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  const legal = player.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => canPlayCard(card, top, state.firstMove, player.hand.length));
  if (!legal.length) return null;

  const next = state.players[nextIndex(state)];
  const threat = next.hand.length <= 2;
  const actionPriority: Record<string, number> = { draw2: 32, skip: 24, reverse: 16, wild: 12 };
  legal.sort((a, b) => {
    const score = ({ card }: (typeof legal)[number]) => {
      if (card.kind === "action") return (threat ? 100 : -20) + (actionPriority[card.action ?? ""] ?? 0);
      const followUps = player.hand.filter(
        (other) => other.id !== card.id && other.kind === "word" && cardsMatch(other, card),
      ).length;
      return 40 + followUps * 8;
    };
    return score(b) - score(a);
  });
  return legal[0];
}

function chooseAiColor(player: Player): CardColor {
  const counts = new Map<CardColor, number>(COLORS.map((color) => [color, 0]));
  for (const card of player.hand) {
    if (card.action !== "wild" && card.color) counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? COLORS[0];
}

export function processAiTurns(state: GameState) {
  let safety = 0;
  while (state.status === "playing" && state.players[state.currentIndex]?.type === "ai" && safety < 50) {
    safety += 1;
    const playerIndex = state.currentIndex;
    const player = state.players[playerIndex];
    const choice = chooseAiCard(state, player);
    if (choice) {
      const wildColor = choice.card.action === "wild" ? chooseAiColor(player) : undefined;
      applyValidPlay(state, playerIndex, choice.index, false, wildColor);
      continue;
    }
    const top = state.discardPile[state.discardPile.length - 1] ?? null;
    const drawn = drawOne(state);
    if (!drawn) {
      state.currentIndex = nextIndex(state, playerIndex);
      continue;
    }
    player.hand.push(drawn);
    if (canPlayCard(drawn, top, state.firstMove, player.hand.length)) {
      const wildColor = drawn.action === "wild" ? chooseAiColor(player) : undefined;
      applyValidPlay(state, playerIndex, player.hand.length - 1, true, wildColor);
    } else {
      addLog(state, `${player.name}（AI）摸了 1 张牌，但仍无法出牌。`);
      state.currentIndex = nextIndex(state, playerIndex);
      addLog(state, `${player.name}（AI）跳过回合。`);
    }
  }
}

export function toPublicState(
  state: GameState,
  code: string,
  version: number,
  viewerUserId: string,
  hostUserId: string,
): PublicGameState {
  const viewer = state.players.find((player) => player.userId === viewerUserId);
  if (!viewer) throw new Error("你不在这个房间中。");
  const mode = normalizedMode(state);
  const practiceSettings = normalizedPracticeSettings(state);
  const showCardHelp = mode === "practice" && practiceSettings.showChinese;
  const visibleCard = (card: GameCard): ClientCard => ({
    id: card.id,
    word: card.word,
    kind: card.kind,
    color: card.color,
    action: card.action,
    ...(showCardHelp ? {
      zh: card.zh,
      categories: card.kind === "action"
        ? ["功能牌"]
        : (card.groups ?? (card.group ? [card.group] : [])).map(
          (group) => VOCABULARY_CATEGORY_NAMES[group] ?? group,
        ),
    } : {}),
  });
  return {
    code,
    version,
    mode,
    practiceSettings,
    categoryIds: [...(state.categoryIds ?? [])],
    status: state.status,
    players: state.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      type: player.type,
      handCount: player.hand.length,
      isCurrent: state.status === "playing" && index === state.currentIndex,
      isHost: player.userId === hostUserId,
    })),
    hand: viewer.hand.map(visibleCard),
    viewerPlayerId: viewer.id,
    currentPlayerId: state.status === "playing" ? state.players[state.currentIndex]?.id ?? null : null,
    direction: state.direction,
    firstMove: state.firstMove,
    drawnCardId: state.players[state.currentIndex]?.id === viewer.id ? state.drawnCardId : undefined,
    drawCount: state.drawPile.length,
    topCard: state.discardPile.length ? visibleCard(state.discardPile[state.discardPile.length - 1]) : null,
    winnerId: state.winnerId,
    reveal: state.reveal,
    playEvents: (state.playEvents ?? []).map((event) => ({
      ...event,
      card: visibleCard(event.card),
    })),
    logs: state.logs,
  };
}
