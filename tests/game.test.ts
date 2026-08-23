import assert from "node:assert/strict";
import test from "node:test";
import { ACTION_CARDS, WORD_POOL, buildDeck, cardsMatch, type GameCard } from "../lib/cards";
import { VOCABULARY_CATEGORIES } from "../lib/vocabulary";
import { createWaitingState, drawForHuman, passHumanTurn, playHumanCard, setPracticeSetting, toPublicState, type GameState } from "../lib/game";
import { createPasswordHash, verifyPassword } from "../lib/password";

test("password hashes can be created and verified in the Sites runtime range", async () => {
  const hash = await createPasswordHash("palabra-secreta");
  assert.equal(await verifyPassword("palabra-secreta", hash), true);
  assert.equal(await verifyPassword("otra-clave", hash), false);
});

test("each game builds a 108-card deck from the 17 requested categories", () => {
  const deck = buildDeck();
  assert.equal(VOCABULARY_CATEGORIES.length, 17);
  assert.ok(WORD_POOL.length > 250);
  assert.equal(deck.length, 108);
  assert.equal(deck.filter((card) => card.kind === "word").length, 96);
  assert.equal(deck.filter((card) => card.kind === "action").length, 12);
  for (const card of deck.filter((item) => item.kind === "word")) {
    assert.ok(["red", "yellow", "blue", "green"].includes(card.color ?? ""));
  }
});

test("action cards match every card", () => {
  const action = ACTION_CARDS[0];
  for (const card of buildDeck()) assert.equal(cardsMatch(action, card), true);
});

test("word cards match by category or color only", () => {
  const foodRed: GameCard = { id: "food-red", word: "pan", zh: "面包", kind: "word", groups: ["alimentos"], color: "red" };
  const foodBlue: GameCard = { id: "food-blue", word: "arroz", zh: "米饭", kind: "word", groups: ["alimentos"], color: "blue" };
  const bodyRed: GameCard = { id: "body-red", word: "mano", zh: "手", kind: "word", groups: ["cuerpo"], color: "red" };
  const bodyGreen: GameCard = { id: "body-green", word: "pie", zh: "脚", kind: "word", groups: ["cuerpo"], color: "green" };
  assert.equal(cardsMatch(foodRed, foodBlue), true);
  assert.equal(cardsMatch(foodRed, bodyRed), true);
  assert.equal(cardsMatch(foodBlue, bodyGreen), false);
});

test("practice settings expose card meanings and categories to the room", () => {
  const state = createWaitingState("u1", "Ana", "practice");
  setPracticeSetting(state, "showChinese", true);
  setPracticeSetting(state, "showPlayedMeanings", true);
  state.players[0].hand = [{ ...WORD_POOL.find((card) => card.word === "pan")!, color: "red" }];
  const view = toPublicState(state, "ABC123", 1, "u1", "u1");
  assert.equal(view.mode, "practice");
  assert.equal(view.practiceSettings.showChinese, true);
  assert.equal(view.hand[0].zh, "面包");
  assert.deepEqual(view.hand[0].categories, ["食物"]);
});

test("an invalid semantic play is returned and draws a penalty card", () => {
  const pan = { ...WORD_POOL.find((card) => card.word === "pan")!, color: "red" as const };
  const libro = { ...WORD_POOL.find((card) => card.word === "libro")!, color: "blue" as const };
  const agua = { ...WORD_POOL.find((card) => card.word === "agua")!, color: "green" as const };
  const state: GameState = {
    mode: "practice",
    practiceSettings: { showChinese: false, showPlayedMeanings: true },
    players: [
      { id: "p1", name: "Ana", type: "human", userId: "u1", hand: [{ ...libro }, { ...agua }] },
      { id: "p2", name: "Luis", type: "human", userId: "u2", hand: [{ ...pan }] },
    ],
    drawPile: [{ ...agua, id: "penalty" }],
    discardPile: [{ ...pan }],
    currentIndex: 0,
    direction: 1,
    status: "playing",
    firstMove: false,
    sequence: 0,
    logs: [],
  };
  const result = playHumanCard(state, "p1", libro.id);
  assert.equal(result.valid, false);
  assert.equal(state.players[0].hand.length, 3);
  assert.equal(state.players[0].hand[0].id, libro.id);
  assert.equal(state.currentIndex, 1);
  assert.equal(state.reveal?.playedZh, "书");
  assert.equal(state.reveal?.topZh, "面包");
  assert.match(state.logs[0].text, /书/);
  assert.match(state.logs[0].text, /面包/);
});

test("an action card cannot be the final card", () => {
  const action = ACTION_CARDS[0];
  const state: GameState = {
    players: [
      { id: "p1", name: "Ana", type: "human", userId: "u1", hand: [{ ...action }] },
      { id: "p2", name: "Luis", type: "human", userId: "u2", hand: [] },
    ],
    drawPile: [],
    discardPile: [],
    currentIndex: 0,
    direction: 1,
    status: "playing",
    firstMove: true,
    sequence: 0,
    logs: [],
  };
  assert.throws(() => playHumanCard(state, "p1", action.id), /不能作为最后一张牌/);
  assert.equal(state.players[0].hand.length, 1);
});

test("a player may draw with a playable hand, then play the drawn card or pass", () => {
  const pan = { ...WORD_POOL.find((card) => card.word === "pan")!, color: "red" as const };
  const arroz = { ...WORD_POOL.find((card) => card.word === "arroz")!, color: "blue" as const };
  const mano = { ...WORD_POOL.find((card) => card.word === "mano")!, color: "green" as const };
  const makeState = (drawn: GameCard): GameState => ({
    players: [
      { id: "p1", name: "Ana", type: "human", userId: "u1", hand: [{ ...arroz }] },
      { id: "p2", name: "Luis", type: "human", userId: "u2", hand: [{ ...mano }] },
    ],
    drawPile: [{ ...drawn }], discardPile: [{ ...pan }], currentIndex: 0, direction: 1,
    status: "playing", firstMove: false, sequence: 0, logs: [],
  });

  const passState = makeState(mano);
  const passDraw = drawForHuman(passState, "p1");
  assert.equal(passState.players[0].hand.length, 2);
  assert.equal(passState.currentIndex, 0);
  assert.equal(passState.drawnCardId, passDraw.drawnCardId);
  assert.throws(() => drawForHuman(passState, "p1"), /已经摸过牌/);
  assert.throws(() => playHumanCard(passState, "p1", arroz.id), /只能打出刚摸到的牌/);
  passHumanTurn(passState, "p1");
  assert.equal(passState.currentIndex, 1);
  assert.equal(passState.drawnCardId, undefined);

  const playState = makeState({ ...pan, id: "drawn-pan" });
  const playDraw = drawForHuman(playState, "p1");
  assert.equal(playState.players[0].hand.length, 2);
  assert.equal(playState.discardPile.at(-1)?.word, "pan");
  playHumanCard(playState, "p1", playDraw.drawnCardId);
  assert.equal(playState.players[0].hand.length, 1);
  assert.equal(playState.discardPile.at(-1)?.id, "drawn-pan");
});
