import { VOCABULARY_CATEGORIES } from "./vocabulary";

export const STUDY_MAX_LEVEL = 4;

export const STUDY_LEVELS = [
  { label: "未开始", description: "还不认识" },
  { label: "刚接触", description: "有一点印象" },
  { label: "有印象", description: "能够想起一些" },
  { label: "比较熟", description: "大多时候能认出" },
  { label: "已掌握", description: "已经学会" },
] as const;

export function studyWordKey(word: string) {
  return word.normalize("NFKC").trim().toLocaleLowerCase("es");
}

const vocabularyWordKeys = new Set(
  VOCABULARY_CATEGORIES.flatMap((category) => category.words.map(([word]) => studyWordKey(word))),
);

export function isVocabularyWordKey(wordKey: string) {
  return vocabularyWordKeys.has(wordKey);
}

export function nextStudyLevel(level: number) {
  return Math.min(STUDY_MAX_LEVEL, Math.max(0, Math.trunc(level)) + 1);
}
