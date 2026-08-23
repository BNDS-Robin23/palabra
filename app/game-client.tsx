"use client";

import {
  type CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { VOCABULARY_CATEGORY_OPTIONS } from "../lib/vocabulary";
import { wordAudioPath } from "../lib/word-audio";

type User = { id: string; username: string };
type PracticeSettings = { showChinese: boolean; showPlayedMeanings: boolean };
type ClientCard = {
  id: string;
  word: string;
  kind: "word" | "action";
  color?: "red" | "yellow" | "blue" | "green";
  action?: "skip" | "reverse" | "draw2";
  zh?: string;
  categories?: string[];
};
type PlayerView = {
  id: string;
  name: string;
  type: "human" | "ai";
  handCount: number;
  isCurrent: boolean;
  isHost: boolean;
};
type PlayEventView = {
  id: number;
  actorId: string;
  actorName: string;
  actorType: "human" | "ai";
  card: ClientCard;
};
type GameView = {
  code: string;
  version: number;
  mode: "normal" | "practice";
  practiceSettings: PracticeSettings;
  categoryIds: string[];
  status: "waiting" | "playing" | "finished";
  players: PlayerView[];
  hand: ClientCard[];
  viewerPlayerId: string;
  currentPlayerId: string | null;
  direction: 1 | -1;
  firstMove: boolean;
  drawnCardId?: string;
  drawCount: number;
  topCard: ClientCard | null;
  winnerId?: string;
  reveal?: { id: number; actorId: string; topWord: string; topZh: string; playedWord: string; playedZh: string };
  playEvents: PlayEventView[];
  logs: Array<{ id: number; text: string; tone: string }>;
};

type FlightStyle = CSSProperties & {
  "--play-from-x": string;
  "--play-from-y": string;
  "--play-to-x": string;
  "--play-to-y": string;
};

async function readJson(response: Response) {
  const data = (await response.json()) as { error?: string; user?: User | null; game?: GameView };
  if (!response.ok) throw new Error(data.error ?? "请求失败，请重试。");
  return data;
}

function useGameAudio(active: boolean) {
  const [bgmEnabled, setBgmEnabled] = useState(() => typeof window === "undefined" || window.localStorage.getItem("palabra-bgm-v2") !== "off");
  const [speechEnabled, setSpeechEnabled] = useState(() => typeof window === "undefined" || window.localStorage.getItem("palabra-speech") !== "off");
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState("");
  const bgmRef = useRef<{ context: AudioContext; output: GainNode; timer: number } | null>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const finishWordAudioRef = useRef<(() => void) | null>(null);
  const wordAudioQueueRef = useRef<Promise<void>>(Promise.resolve());
  const wordAudioGenerationRef = useRef(0);

  const stopBgm = useCallback(() => {
    const playing = bgmRef.current;
    bgmRef.current = null;
    setAudioReady(false);
    if (!playing) return;
    if (playing.timer) window.clearInterval(playing.timer);
    const now = playing.context.currentTime;
    playing.output.gain.cancelScheduledValues(now);
    playing.output.gain.setValueAtTime(playing.output.gain.value, now);
    playing.output.gain.linearRampToValueAtTime(0, now + 0.18);
    window.setTimeout(() => void playing.context.close(), 220);
  }, []);

  const startBgm = useCallback(async () => {
    if (bgmRef.current) {
      try {
        await bgmRef.current.context.resume();
        const ready = bgmRef.current.context.state === "running";
        setAudioReady(ready);
        if (!ready) setAudioError("浏览器仍在阻止播放，请再次点击。 ");
        return ready;
      } catch {
        setAudioError("无法启动声音，请检查标签页是否静音。 ");
        return false;
      }
    }
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setAudioError("当前浏览器不支持背景音乐。 ");
      return false;
    }
    const context = new AudioContextClass();
    const output = context.createGain();
    output.gain.value = 0.32;
    output.connect(context.destination);
    const playing = { context, output, timer: 0 };
    bgmRef.current = playing;
    let phrase = 0;

    const schedulePhrase = () => {
      const melodies = [
        [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23],
        [293.66, 369.99, 440, 369.99, 261.63, 329.63, 392, 329.63],
      ];
      const notes = melodies[phrase % melodies.length];
      const start = context.currentTime + 0.04;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = start + index * 0.28;
        oscillator.type = index % 2 === 0 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.24);
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.25);
      });
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = "sine";
      bass.frequency.setValueAtTime(phrase % 2 === 0 ? 130.81 : 146.83, start);
      bassGain.gain.setValueAtTime(0, start);
      bassGain.gain.linearRampToValueAtTime(0.08, start + 0.08);
      bassGain.gain.exponentialRampToValueAtTime(0.001, start + 2.1);
      bass.connect(bassGain);
      bassGain.connect(output);
      bass.start(start);
      bass.stop(start + 2.15);
      phrase += 1;
    };

    try {
      await context.resume();
      if (bgmRef.current !== playing || context.state !== "running") {
        setAudioReady(false);
        setAudioError("浏览器仍在阻止播放，请点击“开启声音”重试。 ");
        return false;
      }
      schedulePhrase();
      playing.timer = window.setInterval(schedulePhrase, 2280);
      setAudioReady(true);
      setAudioError("");
      return true;
    } catch {
      bgmRef.current = null;
      setAudioReady(false);
      setAudioError("无法启动声音，请检查标签页或系统是否静音。 ");
      void context.close();
      return false;
    }
  }, []);

  const playWordAudio = useCallback((word: string) => new Promise<void>((resolve) => {
    if (!word) {
      resolve();
      return;
    }
    const audio = new Audio(wordAudioPath(word));
    audio.preload = "auto";
    audio.volume = 1;
    wordAudioRef.current = audio;
    const playingBgm = bgmRef.current;
    if (playingBgm) {
      const now = playingBgm.context.currentTime;
      playingBgm.output.gain.cancelScheduledValues(now);
      playingBgm.output.gain.setTargetAtTime(0.1, now, 0.04);
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", handleError);
      if (wordAudioRef.current === audio) wordAudioRef.current = null;
      if (finishWordAudioRef.current === finish) finishWordAudioRef.current = null;
      const currentBgm = bgmRef.current;
      if (currentBgm) {
        const now = currentBgm.context.currentTime;
        currentBgm.output.gain.cancelScheduledValues(now);
        currentBgm.output.gain.setTargetAtTime(0.32, now, 0.08);
      }
      resolve();
    };
    const handleError = () => {
      setAudioError(`无法播放“${word}”的固定语音，请刷新后重试。`);
      finish();
    };
    finishWordAudioRef.current = finish;
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    void audio.play().then(() => setAudioError("")).catch(handleError);
  }), []);

  const stopWordAudio = useCallback(() => {
    wordAudioGenerationRef.current += 1;
    const audio = wordAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    finishWordAudioRef.current?.();
    wordAudioQueueRef.current = Promise.resolve();
  }, []);

  const enqueueWordAudio = useCallback((word: string) => {
    const generation = wordAudioGenerationRef.current;
    wordAudioQueueRef.current = wordAudioQueueRef.current
      .catch(() => undefined)
      .then(() => generation === wordAudioGenerationRef.current ? playWordAudio(word) : undefined);
  }, [playWordAudio]);

  useEffect(() => {
    window.localStorage.setItem("palabra-bgm-v2", bgmEnabled ? "on" : "off");
    if (!bgmEnabled || !active) return;
    const unlock = () => void startBgm();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [active, bgmEnabled, startBgm, stopBgm]);

  useEffect(() => {
    window.localStorage.setItem("palabra-speech", speechEnabled ? "on" : "off");
  }, [speechEnabled]);

  useEffect(() => () => {
    stopBgm();
    stopWordAudio();
  }, [stopBgm, stopWordAudio]);

  const toggleBgm = useCallback(() => {
    if (bgmEnabled && audioReady) {
      setBgmEnabled(false);
      stopBgm();
      return;
    }
    setBgmEnabled(true);
    void startBgm();
  }, [audioReady, bgmEnabled, startBgm, stopBgm]);

  const toggleSpeech = useCallback(() => {
    if (speechEnabled) {
      stopWordAudio();
      setSpeechEnabled(false);
      return;
    }
    setSpeechEnabled(true);
    enqueueWordAudio("¡Hola!");
  }, [enqueueWordAudio, speechEnabled, stopWordAudio]);

  const unlockAudio = useCallback(() => {
    setBgmEnabled(true);
    void startBgm();
    if (speechEnabled) enqueueWordAudio("¡Vamos!");
  }, [enqueueWordAudio, speechEnabled, startBgm]);

  const speakWord = useCallback((word: string) => {
    if (speechEnabled) enqueueWordAudio(word);
  }, [enqueueWordAudio, speechEnabled]);

  const stopAudio = useCallback(() => {
    stopBgm();
    stopWordAudio();
  }, [stopBgm, stopWordAudio]);

  return { audioError, audioReady, bgmEnabled, speechEnabled, stopAudio, toggleBgm, toggleSpeech, unlockAudio, speakWord };
}

function Brand() {
  return (
    <div className="brand" aria-label="Palabra">
      <span className="brand-mark"><span>¡P!</span></span>
      <span className="brand-copy"><strong>PALABRA</strong><small>JUEGA · PIENSA · HABLA</small></span>
    </div>
  );
}

function Rules({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "rules rules-compact" : "rules"}>
      <div className="eyebrow">CÓMO JUGAR</div>
      <h2>用联想，接住下一个词</h2>
      <div className="rule-list">
        <div><span>01</span><p><b>同类别</b>例如 <i>pan</i> 和 <i>arroz</i> 都属于食物，可以接牌。</p></div>
        <div><span>02</span><p><b>同颜色</b>红、黄、蓝、绿中颜色相同，也可以直接出牌。</p></div>
        <div><span>03</span><p><b>自由摸牌</b>有牌可出也能摸；之后可打出刚摸的牌，或结束回合。</p></div>
        <div><span>04</span><p><b>功能牌看颜色</b>功能牌也要与桌面牌同色，且最后一张必须是普通词牌。</p></div>
      </div>
      {!compact && <p className="probability"><strong>17</strong><span>个生活词汇主题<br />每局使用 6 类 · 108 张单词牌</span></p>}
      {!compact && <div className="ai-strategy"><span>ESTRATEGIA AI</span><p>AI 会优先打出手中后续可按类别或颜色衔接的牌；对手接近获胜时优先使用功能牌，并确保不以功能牌收尾。</p></div>}
    </section>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await readJson(await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username, password }),
      }));
      if (data.user) onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法登录。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-top"><Brand /><span className="language-pill">ES · 中文</span></div>
      <div className="auth-grid">
        <section className="hero-copy">
          <div className="eyebrow">120 CARTAS · 2–10 JUGADORES</div>
          <h1>把每一个<br /><em>西班牙语单词</em><br />变成下一步。</h1>
          <p>看类别，也看颜色：同类词或同色牌就能接上。无需 ChatGPT 账号，和朋友用房间号直接开局。</p>
          <div className="floating-cards" aria-hidden="true">
            <div className="mini-card mini-one"><span>vino</span></div>
            <div className="mini-card mini-two"><span>beber</span></div>
            <div className="mini-card mini-three"><span>frío</span></div>
          </div>
        </section>
        <section className="auth-card">
          <div className="auth-tabs">
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>创建账号</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登录</button>
          </div>
          <h2>{mode === "register" ? "¡Hola! 新玩家" : "欢迎回来"}</h2>
          <p>{mode === "register" ? "注册后就能创建房间，或加入朋友的牌局。" : "继续你的西班牙语牌局。"}</p>
          <form onSubmit={submit}>
            <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={2} maxLength={16} placeholder="例如：Luna88" required /></label>
            <label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} maxLength={72} placeholder="至少 6 位" required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? "请稍候…" : mode === "register" ? "创建账号并开始" : "登录"}<span>→</span></button>
          </form>
          <p className="auth-note">仅使用用户名和密码 · 不需要邮箱 · 不需要 ChatGPT 账号</p>
        </section>
      </div>
      <Rules compact />
    </main>
  );
}

function Lobby({ user, onGame, onLogout }: { user: User; onGame: (game: GameView) => void; onLogout: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const categorySelectionValid = selectedCategoryIds.length === 0 || selectedCategoryIds.length === 6;

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) => current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : current.length < 6 ? [...current, categoryId] : current);
  }

  async function action(kind: "create" | "join", mode: "normal" | "practice" = "normal") {
    if (kind === "create" && !categorySelectionValid) {
      setError("请选择恰好 6 个类别，或清空选择后由系统随机抽取。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await readJson(await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: kind,
          code,
          mode,
          ...(kind === "create" ? { categoryIds: selectedCategoryIds } : {}),
        }),
      }));
      if (data.game) onGame(data.game);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lobby-shell">
      <header className="site-header"><Brand /><div className="user-area"><span>Hola, <b>{user.username}</b></span><button onClick={onLogout}>退出</button></div></header>
      <div className="lobby-grid">
        <section className="lobby-main">
          <div className="eyebrow">LISTO PARA JUGAR</div>
          <h1>今天，想用哪个词<br />赢下这一局？</h1>
          <p className="lobby-intro">创建一个新房间，或输入朋友分享的 6 位房间号。开局前可以随时补充 AI 玩家。</p>
          <section className="category-picker" aria-label="选择本局词汇类别">
            <div className="category-picker-head">
              <div><b>选择本局的 6 个类别</b><small>{selectedCategoryIds.length === 0 ? "不选择则由系统随机抽取六类" : `已选择 ${selectedCategoryIds.length} / 6`}</small></div>
              {selectedCategoryIds.length > 0 && <button type="button" onClick={() => setSelectedCategoryIds([])} disabled={busy}>清空并随机</button>}
            </div>
            <div className="category-chips">
              {VOCABULARY_CATEGORY_OPTIONS.map((category) => {
                const selected = selectedCategoryIds.includes(category.id);
                return <button type="button" key={category.id} className={selected ? "selected" : ""} aria-pressed={selected} disabled={busy || (!selected && selectedCategoryIds.length >= 6)} onClick={() => toggleCategory(category.id)}><b>{category.zh}</b><small>{category.es}</small></button>;
              })}
            </div>
          </section>
          <div className="lobby-actions">
            <div className="create-options">
              <button className="create-room" onClick={() => action("create", "normal")} disabled={busy || !categorySelectionValid}><span className="button-orb">＋</span><span><b>普通模式</b><small>创建房间并邀请朋友</small></span><i>→</i></button>
              <button className="create-room practice-room" onClick={() => action("create", "practice")} disabled={busy || !categorySelectionValid}><span className="button-orb">练</span><span><b>练习模式</b><small>可显示中文、类别与出牌释义</small></span><i>→</i></button>
            </div>
            <div className="join-box">
              <label htmlFor="room-code">加入房间</label>
              <div><input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="输入 6 位房间号" maxLength={6} /><button onClick={() => action("join")} disabled={busy || code.length !== 6}>加入</button></div>
            </div>
          </div>
          {error && <div className="form-error lobby-error" role="alert">{error}</div>}
          <div className="stat-row"><span><b>120</b> 张牌</span><span><b>6</b> 个类别</span><span><b>2–10</b> 人</span><span><b>7</b> 张起手</span></div>
        </section>
        <Rules />
      </div>
    </main>
  );
}

function WaitingRoom({ game, user, onAction, onLeave, busy, error }: { game: GameView; user: User; onAction: (action: string, payload?: Record<string, unknown>) => void; onLeave: () => void; busy: boolean; error: string }) {
  const viewer = game.players.find((player) => player.id === game.viewerPlayerId);
  const isHost = viewer?.isHost;
  const selectedCategories = VOCABULARY_CATEGORY_OPTIONS.filter((category) => game.categoryIds.includes(category.id));
  const copyCode = async () => {
    await navigator.clipboard?.writeText(game.code);
  };
  return (
    <main className="waiting-shell">
      <header className="site-header"><Brand /><div className="user-area"><span>Hola, <b>{user.username}</b></span><button onClick={onLeave}>返回大厅</button></div></header>
      <div className="waiting-panel">
        <div className="eyebrow">SALA DE ESPERA</div>
        <h1>牌桌正在集合</h1>
        <p>{game.mode === "practice" ? "练习模式 · 设置会对房间内所有玩家生效。" : "把房间号发给朋友；至少 2 人即可开始。"}</p>
        <button className="room-code" onClick={copyCode} aria-label="复制房间号"><span>房间号</span><strong>{game.code}</strong><small>点击复制</small></button>
        <section className="room-categories" aria-label="本局词汇类别">
          <div><b>本局六类</b><small>108 张单词牌只来自以下类别</small></div>
          <p>{selectedCategories.length > 0 ? selectedCategories.map((category) => <span key={category.id}>{category.zh}</span>) : <span>开局时随机选择</span>}</p>
        </section>
        {game.mode === "practice" && <section className="practice-settings" aria-label="练习模式设置">
          <div className="practice-settings-heading"><span>PRÁCTICA</span><div><b>练习设置</b><small>{isHost ? "开局前可调整" : "由房主设置"}</small></div></div>
          <button type="button" role="switch" aria-checked={game.practiceSettings.showChinese} disabled={!isHost || busy} onClick={() => onAction("update_settings", { setting: "showChinese", value: !game.practiceSettings.showChinese })}>
            <span><b>中文显示</b><small>在自己的手牌和桌面牌上显示中文与类别</small></span><i className={game.practiceSettings.showChinese ? "on" : ""}><em></em></i>
          </button>
          <button type="button" role="switch" aria-checked={game.practiceSettings.showPlayedMeanings} disabled={!isHost || busy} onClick={() => onAction("update_settings", { setting: "showPlayedMeanings", value: !game.practiceSettings.showPlayedMeanings })}>
            <span><b>出牌显示</b><small>牌局动态显示所有人打出牌的中文意思</small></span><i className={game.practiceSettings.showPlayedMeanings ? "on" : ""}><em></em></i>
          </button>
        </section>}
        <div className="player-grid">
          {game.players.map((player, index) => <div className="waiting-player" key={player.id}><span>{player.type === "ai" ? "AI" : player.name.slice(0, 1).toUpperCase()}</span><p><b>{player.name}</b><small>{player.isHost ? "房主" : player.type === "ai" ? "AI 玩家" : "已准备"}</small></p><i>{index + 1}</i></div>)}
          {Array.from({ length: Math.max(0, 4 - game.players.length) }, (_, index) => <div className="waiting-player empty" key={`empty-${index}`}><span>＋</span><p><b>等待加入</b><small>空座位</small></p></div>)}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="waiting-actions">
          {isHost && <button className="secondary-button" onClick={() => onAction("add_ai")} disabled={busy || game.players.length >= 10}>＋ 添加 AI 玩家</button>}
          {isHost ? <button className="primary-button" onClick={() => onAction("start")} disabled={busy || game.players.length < 2}>开始游戏 <span>→</span></button> : <span className="host-hint">等待房主开始…</span>}
        </div>
      </div>
    </main>
  );
}

function GameCard({ card, onClick, disabled = false, top = false, highlighted = false }: { card: ClientCard; onClick?: () => void; disabled?: boolean; top?: boolean; highlighted?: boolean }) {
  const colorClass = card.color ? `card-${card.color}` : "";
  return (
    <button className={`game-card ${card.kind === "action" ? `action-card action-${card.action} ${colorClass}` : `word-card ${colorClass}`} ${card.zh ? "show-help" : ""} ${top ? "top-card" : ""} ${highlighted ? "drawn-card" : ""}`} onClick={onClick} disabled={disabled} tabIndex={onClick ? 0 : -1} aria-label={`${card.word}${disabled ? "，当前不可出" : ""}`}>
      <span className="card-word">{card.word}</span>
      {card.zh && <span className="card-learning"><b>{card.zh}</b><small>{card.categories?.join(" / ")}</small></span>}
    </button>
  );
}

type GameTableProps = {
  game: GameView;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
  onLeave: () => void;
  busy: boolean;
  error: string;
  notice: string;
  audioError: string;
  audioReady: boolean;
  bgmEnabled: boolean;
  speechEnabled: boolean;
  onToggleBgm: () => void;
  onToggleSpeech: () => void;
  onUnlockAudio: () => void;
  speakWord: (word: string) => void;
};

function GameTable({
  game,
  onAction,
  onLeave,
  busy,
  error,
  notice,
  audioError,
  audioReady,
  bgmEnabled,
  speechEnabled,
  onToggleBgm,
  onToggleSpeech,
  onUnlockAudio,
  speakWord,
}: GameTableProps) {
  const me = game.players.find((player) => player.id === game.viewerPlayerId)!;
  const current = game.players.find((player) => player.id === game.currentPlayerId);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const opponents = game.players.filter((player) => player.id !== game.viewerPlayerId);
  const myTurn = game.currentPlayerId === game.viewerPlayerId;
  const hasDrawn = myTurn && !!game.drawnCardId;
  const initialEventId = Math.max(0, ...(game.playEvents ?? []).map((event) => event.id));
  const lastQueuedPlayId = useRef(initialEventId);
  const lastAnimatedPlayId = useRef(initialEventId);
  const [queuedPlays, setQueuedPlays] = useState<PlayEventView[]>([]);
  const activePlay = queuedPlays[0] ?? null;
  const [visualTopCard, setVisualTopCard] = useState<ClientCard | null>(game.topCard);
  const [flightStyle, setFlightStyle] = useState<FlightStyle | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);
  const playerSources = useRef(new Map<string, HTMLElement>());

  const registerPlayerSource = useCallback((playerId: string, node: HTMLElement | null) => {
    if (node) playerSources.current.set(playerId, node);
    else playerSources.current.delete(playerId);
  }, []);

  useEffect(() => {
    const fresh = (game.playEvents ?? [])
      .filter((event) => event.id > lastQueuedPlayId.current)
      .sort((a, b) => a.id - b.id);
    if (!fresh.length) return;
    lastQueuedPlayId.current = fresh[fresh.length - 1].id;
    setQueuedPlays((currentQueue) => [...currentQueue, ...fresh]);
  }, [game.playEvents]);

  const announcedPlayId = useRef(initialEventId);

  useEffect(() => {
    if (!activePlay || activePlay.id === announcedPlayId.current) return;
    announcedPlayId.current = activePlay.id;
    speakWord(activePlay.card.word);
  }, [activePlay, speakWord]);

  useLayoutEffect(() => {
    if (!activePlay || !boardRef.current || !discardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const sourceRect = (playerSources.current.get(activePlay.actorId) ?? boardRef.current).getBoundingClientRect();
    const targetElement = discardRef.current.querySelector<HTMLElement>(".game-card, .empty-top") ?? discardRef.current;
    const targetRect = targetElement.getBoundingClientRect();
    const cardWidth = targetRect.width || 142;
    const cardHeight = targetRect.height || 202;
    setFlightStyle({
      "--play-from-x": `${sourceRect.left - boardRect.left + sourceRect.width / 2 - cardWidth / 2}px`,
      "--play-from-y": `${sourceRect.top - boardRect.top + sourceRect.height / 2 - cardHeight / 2}px`,
      "--play-to-x": `${targetRect.left - boardRect.left}px`,
      "--play-to-y": `${targetRect.top - boardRect.top}px`,
    });
  }, [activePlay]);

  const completeActivePlay = useCallback(() => {
    if (!activePlay) return;
    setVisualTopCard(activePlay.card);
    lastAnimatedPlayId.current = activePlay.id;
    setFlightStyle(null);
    setQueuedPlays((currentQueue) => currentQueue[0]?.id === activePlay.id ? currentQueue.slice(1) : currentQueue);
  }, [activePlay]);

  useEffect(() => {
    if (!activePlay) return;
    const fallback = window.setTimeout(completeActivePlay, 1150);
    return () => window.clearTimeout(fallback);
  }, [activePlay, completeActivePlay]);

  useEffect(() => {
    const latestPlayId = Math.max(0, ...(game.playEvents ?? []).map((event) => event.id));
    if (!activePlay && !queuedPlays.length && latestPlayId <= lastAnimatedPlayId.current) {
      setVisualTopCard(game.topCard);
    }
  }, [activePlay, game.playEvents, game.topCard, queuedPlays.length]);

  const isAnimating = !!activePlay || queuedPlays.length > 0;
  const tableBusy = busy || isAnimating;
  const shownCurrentId = activePlay?.actorId ?? game.currentPlayerId;
  const turnMessage = activePlay
    ? `${activePlay.actorName}${activePlay.actorType === "ai" ? "（AI）" : ""} 打出了 ${activePlay.card.word}`
    : hasDrawn
      ? "可打出刚摸的牌，或结束回合"
      : myTurn
        ? "轮到你：出牌或摸牌"
        : `${current?.name ?? "玩家"} 的回合`;

  return (
    <main className="table-shell">
      <header className="game-header"><Brand /><div className="game-meta"><span>房间 <b>{game.code}</b></span>{game.mode === "practice" && <span className="practice-badge">练习</span>}<span className="direction">{game.direction === 1 ? "↻ 顺时针" : "↺ 逆时针"}</span><div className="audio-controls" aria-label="声音设置"><button type="button" className={bgmEnabled && audioReady ? "on" : bgmEnabled ? "needs-unlock" : ""} aria-pressed={bgmEnabled && audioReady} onClick={onToggleBgm} title={bgmEnabled && !audioReady ? "点击启用背景音乐" : "切换背景音乐"}><span>♪ BGM</span><b>{!bgmEnabled ? "关" : audioReady ? "开" : "启用"}</b></button><button type="button" className={speechEnabled ? "on" : ""} aria-pressed={speechEnabled} onClick={onToggleSpeech} title="切换西班牙语单词朗读"><span>🔊 单词</span><b>{speechEnabled ? "开" : "关"}</b></button></div><button onClick={onLeave}>离开牌桌</button></div></header>
      <section className="game-board" ref={boardRef}>
        {bgmEnabled && !audioReady && <button type="button" className="sound-unlock" onClick={onUnlockAudio}><span>♪</span><b>点击开启声音</b><small>{audioError || "将播放 BGM，并朗读一声 ¡Vamos! 作为试听"}</small></button>}
        <div className="opponents">
          {opponents.map((player) => <div ref={(node) => registerPlayerSource(player.id, node)} className={`opponent ${shownCurrentId === player.id ? "current" : ""} ${activePlay?.actorId === player.id ? "playing-card" : ""}`} key={player.id}><div className="avatar">{player.type === "ai" ? "AI" : player.name.slice(0, 1).toUpperCase()}</div><div><b>{player.name}</b><small>{activePlay?.actorId === player.id ? "正在出牌…" : player.isCurrent ? "正在思考…" : player.type === "ai" ? "AI 玩家" : "在线"}</small></div><span className="card-count"><i></i>{player.handCount}</span></div>)}
        </div>

        <div className="table-center">
          <div className="draw-area">
            <button className="draw-pile" onClick={() => onAction("draw")} disabled={!myTurn || tableBusy || hasDrawn} aria-label={`摸一张牌，牌堆剩余 ${game.drawCount} 张`}><span className="draw-back">PALABRA</span><small>{hasDrawn ? "本回合已摸牌" : `${game.drawCount} 张 · 点击摸牌`}</small></button>
            {hasDrawn && <button className="pass-turn" onClick={() => onAction("pass")} disabled={tableBusy}>保留这张 · 结束回合</button>}
          </div>
          <div className="discard-area" ref={discardRef}><small>{game.firstMove ? "首位玩家可出任意牌" : "弃牌堆"}</small>{visualTopCard ? <GameCard card={visualTopCard} top /> : <div className="empty-top">任意牌</div>}</div>
          <div className={`turn-badge ${myTurn && !activePlay ? "mine" : ""} ${activePlay ? "playing" : ""}`}><span></span>{turnMessage}</div>
        </div>

        {activePlay && flightStyle && <div className="played-card-flight" style={flightStyle} role="status" aria-label={turnMessage} onAnimationEnd={() => completeActivePlay()}><GameCard card={activePlay.card} /><span>{activePlay.actorName}{activePlay.actorType === "ai" ? " · AI" : ""}<b>{activePlay.card.word}</b></span></div>}

        <aside className="activity"><div className="eyebrow">牌局动态</div>{game.logs.slice(0, 5).map((log) => <p className={`log-${log.tone}`} key={log.id}>{log.text}</p>)}</aside>
        <details className="mobile-activity">
          <summary><span>牌局动态</span><b>{game.logs[0]?.text ?? "等待第一张牌…"}</b><i>⌄</i></summary>
          <div>{game.logs.slice(0, 5).map((log) => <p className={`log-${log.tone}`} key={log.id}>{log.text}</p>)}</div>
        </details>

        {game.reveal && <div className="match-failed" role="status"><div><span>匹配失败</span><b>{game.reveal.topWord} <i>{game.reveal.topZh}</i></b><em>≠</em><b>{game.reveal.playedWord} <i>{game.reveal.playedZh}</i></b></div><p>该牌已退回，并罚摸 1 张。</p></div>}

        {error && <div className="game-error" role="alert">{error}</div>}
        {notice && <div className="game-notice" role="status">{notice}</div>}
        <div className="my-area">
          <div className="hand-title"><span><b>{me.name}</b> · 你的手牌</span><small>{game.hand.length} 张 · {hasDrawn ? "本回合只能打出高亮牌" : "可以出牌，也可以摸牌"}</small></div>
          <div className="hand-scroll" ref={(node) => registerPlayerSource(game.viewerPlayerId, node)}>
            {game.hand.map((card) => <GameCard key={card.id} card={card} highlighted={card.id === game.drawnCardId} onClick={() => onAction("play", { cardId: card.id })} disabled={!myTurn || tableBusy || (hasDrawn && card.id !== game.drawnCardId) || (card.kind === "action" && game.hand.length === 1)} />)}
          </div>
        </div>

        {game.status === "finished" && !isAnimating && <div className="winner-overlay"><div className="winner-card"><span>¡GANADOR!</span><h2>{winner?.name}</h2><p>{winner?.id === game.viewerPlayerId ? "漂亮！你用词汇赢下了这一局。" : "这一局结束了，再来一场继续挑战吧。"}</p><button className="primary-button" onClick={onLeave}>返回大厅 <span>→</span></button></div></div>}
      </section>
    </main>
  );
}

export function GameClient() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pollBusy = useRef(false);
  const gameAudio = useGameAudio(game?.status === "playing" || game?.status === "finished");

  const enterGame = useCallback((nextGame: GameView) => {
    setGame(nextGame);
    window.history.replaceState({}, "", `/?room=${nextGame.code}`);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await readJson(await fetch("/api/auth", { cache: "no-store" }));
        if (!active) return;
        setUser(data.user ?? null);
        const room = new URLSearchParams(window.location.search).get("room");
        if (data.user && room) {
          try {
            const gameData = await readJson(await fetch("/api/game", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "join", code: room }),
            }));
            if (gameData.game) setGame(gameData.game);
          } catch (joinError) {
            setError(joinError instanceof Error ? joinError.message : "无法加入房间。");
          }
        }
      } catch {
        setUser(null);
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const gameCode = game?.code;

  useEffect(() => {
    if (!gameCode) return;
    const code = gameCode;
    const poll = async () => {
      if (pollBusy.current || document.visibilityState === "hidden") return;
      pollBusy.current = true;
      try {
        const data = await readJson(await fetch(`/api/game?code=${code}`, { cache: "no-store" }));
        if (data.game) setGame((current) => {
          if (current?.code !== code) return current;
          return data.game!.version >= current.version ? data.game! : current;
        });
      } catch {
        // A temporary polling failure should not interrupt the table.
      } finally {
        pollBusy.current = false;
      }
    };
    const timer = window.setInterval(poll, 800);
    return () => window.clearInterval(timer);
  }, [gameCode]);

  async function logout() {
    gameAudio.stopAudio();
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setUser(null);
    setGame(null);
    setNotice("");
    window.history.replaceState({}, "", "/");
  }

  async function gameAction(action: string, payload: Record<string, unknown> = {}) {
    if (!game) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await readJson(await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code: game.code, ...payload }),
      }));
      if (data.game) {
        if (action === "draw") {
          const drawn = data.game.hand.find((card) => card.id === data.game?.drawnCardId);
          const meaning = drawn?.zh ? `（${drawn.zh}）` : "";
          setNotice(drawn
            ? `已摸到 ${drawn.word}${meaning}。可以打出这张牌，或保留并结束回合。`
            : "已摸 1 张牌。可以打出刚摸到的牌，或保留并结束回合。");
        }
        setGame((current) => !current || data.game!.version >= current.version ? data.game! : current);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    gameAudio.stopAudio();
    setGame(null);
    setError("");
    setNotice("");
    window.history.replaceState({}, "", "/");
  }

  if (!authReady) return <div className="loading-screen"><Brand /><span>正在摆好牌桌…</span></div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  if (!game) return <Lobby user={user} onGame={enterGame} onLogout={logout} />;
  if (game.status === "waiting") return <WaitingRoom game={game} user={user} onAction={gameAction} onLeave={leave} busy={busy} error={error} />;
  return <GameTable game={game} onAction={gameAction} onLeave={leave} busy={busy} error={error} notice={notice} audioError={gameAudio.audioError} audioReady={gameAudio.audioReady} bgmEnabled={gameAudio.bgmEnabled} speechEnabled={gameAudio.speechEnabled} onToggleBgm={gameAudio.toggleBgm} onToggleSpeech={gameAudio.toggleSpeech} onUnlockAudio={gameAudio.unlockAudio} speakWord={gameAudio.speakWord} />;
}
