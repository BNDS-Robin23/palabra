const WORD_AUDIO_BASE = "/audio/words";

export function normalizeAudioWord(word: string) {
  return word.normalize("NFC").toLocaleLowerCase("es");
}

function toBase36(value: number) {
  return (value >>> 0).toString(36);
}

export function wordAudioFileName(word: string) {
  const normalized = normalizeAudioWord(word);
  const slug = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "palabra";
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${slug}-${toBase36(hash)}.mp3`;
}

export function wordAudioPath(word: string) {
  return `${WORD_AUDIO_BASE}/${wordAudioFileName(word)}`;
}
