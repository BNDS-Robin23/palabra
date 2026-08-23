import { VOCABULARY_CATEGORIES } from "./vocabulary";

export type ActionKind = "skip" | "reverse" | "draw2";
export type CardColor = "red" | "yellow" | "blue" | "green";

export type GameCard = {
  id: string;
  word: string;
  zh: string;
  kind: "word" | "action";
  groups?: string[];
  group?: string;
  color?: CardColor;
  action?: ActionKind;
};

const COLORS: CardColor[] = ["red", "yellow", "blue", "green"];
export const GAME_CATEGORY_COUNT = 6;
export const WORD_CARD_COUNT = 108;

type WordPoolCard = Omit<GameCard, "color"> & { kind: "word"; groups: string[] };

function mergeMeaning(current: string, incoming: string) {
  if (current === incoming || current.includes(incoming)) return current;
  if (incoming.includes(current)) return incoming;
  return `${current}；${incoming}`;
}

const mergedWords = new Map<string, WordPoolCard>();
for (const category of VOCABULARY_CATEGORIES) {
  for (const [word, zh] of category.words) {
    const key = word.normalize("NFC").toLocaleLowerCase("es");
    const existing = mergedWords.get(key);
    if (existing) {
      if (!existing.groups.includes(category.id)) existing.groups.push(category.id);
      existing.zh = mergeMeaning(existing.zh, zh);
      continue;
    }
    mergedWords.set(key, {
      id: `v-${mergedWords.size + 1}`,
      word,
      zh,
      kind: "word",
      groups: [category.id],
    });
  }
}

export const WORD_POOL = [...mergedWords.values()];

const actionSeeds: Array<[ActionKind, string, string]> = [
  ["skip", "saltar", "跳过"],
  ["reverse", "girar", "反转"],
  ["draw2", "doble", "加二"],
];

export const ACTION_CARDS: GameCard[] = actionSeeds.flatMap(([action, word, zh]) =>
  COLORS.map((color) => ({
    id: `a-${action}-${color}`,
    word,
    zh,
    kind: "action" as const,
    action,
    color,
  })),
);

function randomIndex(max: number) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return random[0] % max;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function selectGameCategoryIds(categoryIds: string[] = []) {
  const allIds = VOCABULARY_CATEGORIES.map((category) => category.id);
  if (categoryIds.length === 0) return shuffle(allIds).slice(0, GAME_CATEGORY_COUNT);
  const uniqueIds = [...new Set(categoryIds)];
  if (
    uniqueIds.length !== GAME_CATEGORY_COUNT
    || uniqueIds.some((id) => !allIds.includes(id))
  ) {
    throw new Error(`请选择恰好 ${GAME_CATEGORY_COUNT} 个有效类别。`);
  }
  return uniqueIds;
}

function buildSelectedWordPool(categoryIds: string[]) {
  const selected = new Set(categoryIds);
  const words = new Map<string, WordPoolCard>();
  for (const category of VOCABULARY_CATEGORIES) {
    if (!selected.has(category.id)) continue;
    for (const [word, zh] of category.words) {
      const key = word.normalize("NFC").toLocaleLowerCase("es");
      const existing = words.get(key);
      if (existing) {
        if (!existing.groups.includes(category.id)) existing.groups.push(category.id);
        existing.zh = mergeMeaning(existing.zh, zh);
        continue;
      }
      words.set(key, {
        id: `selected-${words.size + 1}`,
        word,
        zh,
        kind: "word",
        groups: [category.id],
      });
    }
  }
  return [...words.values()];
}

export function buildDeck(categoryIds: string[] = []): GameCard[] {
  const selectedCategoryIds = selectGameCategoryIds(categoryIds);
  const pool = shuffle(buildSelectedWordPool(selectedCategoryIds));
  const wordCards = Array.from({ length: WORD_CARD_COUNT }, (_, index) => {
    const card = pool[index % pool.length];
    return {
      ...card,
      id: `w-${index + 1}-${card.id}`,
      groups: [...card.groups],
      color: COLORS[randomIndex(COLORS.length)],
    };
  });
  return [...wordCards, ...ACTION_CARDS.map((card) => ({ ...card }))];
}

function sharesGroup(a: GameCard, b: GameCard) {
  const aGroups = a.groups ?? (a.group ? [a.group] : []);
  const bGroups = b.groups ?? (b.group ? [b.group] : []);
  return aGroups.some((group) => bGroups.includes(group));
}

export function cardsMatch(a: GameCard, b: GameCard) {
  if (a.kind === "action" || b.kind === "action") {
    return !!a.color && a.color === b.color;
  }
  return (!!a.color && a.color === b.color) || sharesGroup(a, b);
}

export function canPlayCard(
  candidate: GameCard,
  top: GameCard | null,
  firstMove: boolean,
  handSize: number,
) {
  if (candidate.kind === "action" && handSize === 1) return false;
  if (firstMove || !top) return true;
  return cardsMatch(candidate, top);
}

export function matchReason(a: GameCard, b: GameCard) {
  if (a.kind === "action" || b.kind === "action") return "功能牌";
  if (a.color && a.color === b.color) return "颜色相同";
  if (sharesGroup(a, b)) return "类别相同";
  return "不匹配";
}
