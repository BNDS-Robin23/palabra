export const ANALYTICS_FEATURES = [
  "auth",
  "lobby",
  "study",
  "waiting_room",
  "normal_game",
  "practice_game",
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export const ANALYTICS_EVENTS = [
  "register",
  "login",
  "study_categories_selected",
  "word_level_up",
  "word_level_down",
  "audio_play",
  "room_create",
  "room_join",
  "game_start",
  "game_finish",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsFeature(value: unknown): value is AnalyticsFeature {
  return typeof value === "string" && (ANALYTICS_FEATURES as readonly string[]).includes(value);
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
