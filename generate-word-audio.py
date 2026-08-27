import argparse
import asyncio
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import edge_tts
except ImportError:
    raise SystemExit(
        "缺少 edge-tts。请先运行：python -m pip install -r requirements-audio.txt"
    )


PROJECT_ROOT = Path(__file__).resolve().parent
VOCABULARY_FILE = PROJECT_ROOT / "lib" / "vocabulary.ts"
OUTPUT_DIR = PROJECT_ROOT / "public" / "audio" / "words"
EXTRA_WORDS = ("saltar", "girar", "doble", "cambiar", "¡Hola!", "¡Vamos!")
DEFAULT_VOICE = "es-ES-ElviraNeural"


def normalize_word(word):
    return unicodedata.normalize("NFC", word).lower()


def base36(value):
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if value == 0:
        return "0"
    result = ""
    while value:
        value, remainder = divmod(value, 36)
        result = digits[remainder] + result
    return result


def audio_file_name(word):
    normalized = normalize_word(word)
    decomposed = unicodedata.normalize("NFD", normalized)
    ascii_word = "".join(
        character for character in decomposed
        if unicodedata.category(character) != "Mn"
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_word).strip("-") or "palabra"
    hash_value = 0x811C9DC5
    encoded = normalized.encode("utf-16-le")
    for index in range(0, len(encoded), 2):
        code_unit = encoded[index] | (encoded[index + 1] << 8)
        hash_value ^= code_unit
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF
    return "{}-{}.mp3".format(slug, base36(hash_value))


def vocabulary_words():
    source = VOCABULARY_FILE.read_text(encoding="utf-8")
    words = re.findall(r'\["([^"]+)",\s*"[^"]+"\]', source)
    unique = []
    seen = set()
    for word in words + list(EXTRA_WORDS):
        normalized = normalize_word(word)
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(word)
    return unique


def trim_generated_audio(source, destination, ffmpeg_path):
    if not ffmpeg_path:
        source.replace(destination)
        return
    trimmed = destination.with_suffix(".trim.mp3")
    command = [
        ffmpeg_path, "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(source),
        "-af", (
            "silenceremove=start_periods=1:start_duration=0.05:"
            "start_threshold=-50dB:start_silence=0.05:stop_periods=1:"
            "stop_duration=0.35:stop_threshold=-50dB:stop_silence=0.12"
        ),
        "-codec:a", "libmp3lame", "-b:a", "48k", str(trimmed),
    ]
    try:
        subprocess.run(command, check=True)
        trimmed.replace(destination)
        source.unlink()
    finally:
        if trimmed.exists():
            trimmed.unlink()


async def generate_all(words, voice, concurrency, force):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(concurrency)
    completed = [0]
    total = len(words)
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        print("未找到 ffmpeg；将保留语音文件末尾的原始静音。", flush=True)

    async def generate_one(word):
        destination = OUTPUT_DIR / audio_file_name(word)
        if destination.exists() and destination.stat().st_size > 0 and not force:
            completed[0] += 1
            return
        temporary = destination.with_suffix(".mp3.part")
        async with semaphore:
            try:
                communicator = edge_tts.Communicate(
                    text=word,
                    voice=voice,
                    rate="-8%",
                    volume="+0%",
                    pitch="+0Hz",
                )
                await communicator.save(str(temporary))
                trim_generated_audio(temporary, destination, ffmpeg_path)
            finally:
                if temporary.exists():
                    temporary.unlink()
            completed[0] += 1
            print("[{}/{}] {}".format(completed[0], total, word), flush=True)

    await asyncio.gather(*(generate_one(word) for word in words))


def main():
    parser = argparse.ArgumentParser(description="生成 Palabra 固定西班牙语单词音频")
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--concurrency", type=int, default=6)
    parser.add_argument("--force", action="store_true")
    arguments = parser.parse_args()
    words = vocabulary_words()
    print("使用 {} 为 {} 个唯一词条生成音频。".format(arguments.voice, len(words)))
    asyncio.run(generate_all(words, arguments.voice, max(1, arguments.concurrency), arguments.force))


if __name__ == "__main__":
    main()
