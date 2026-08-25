"use client";

import { type CSSProperties, useCallback, useEffect, useState } from "react";

type DashboardData = {
  viewer: { username: string };
  generatedAt: number;
  overview: {
    totalUsers: number;
    newToday: number;
    newSevenDays: number;
    activeToday: number;
    activeSevenDays: number;
    roomCount: number;
    finishedRooms: number;
    studiedUsers: number;
    studiedWords: number;
    masteredWords: number;
  };
  featureUsage: Array<{ feature: string; users: number; sessions: number; activeSeconds: number }>;
  eventUsage: Array<{ eventName: string; users: number; events: number }>;
  daily: Array<{ day: string; registrations: number; activeUsers: number; activeSeconds: number }>;
  popularCategories: Array<{ id: string; name: string; count: number }>;
  users: Array<{
    username: string;
    createdAt: number;
    studiedWords: number;
    masteredWords: number;
    activeSeconds: number;
    lastActiveAt: number;
  }>;
};

type ChartStyle = CSSProperties & { "--bar-height": string };

const FEATURE_NAMES: Record<string, string> = {
  auth: "账号",
  lobby: "游戏大厅",
  study: "背单词",
  waiting_room: "等待房间",
  normal_game: "普通模式",
  practice_game: "练习模式",
};

const EVENT_NAMES: Record<string, string> = {
  register: "注册成功",
  login: "登录成功",
  study_categories_selected: "开始类别学习",
  word_level_up: "提升单词熟悉度",
  audio_play: "播放单词发音",
  room_create: "创建房间",
  room_join: "加入房间",
  game_start: "开始游戏",
  game_finish: "完成游戏",
};

function duration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)} 小时`;
}

function dateTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function dayLabel(day: string) {
  const [, month, date] = day.split("-");
  return `${month}/${date}`;
}

function BrandLink() {
  return (
    <a className="brand admin-brand" href="/" aria-label="返回 Palabra 首页">
      <span className="brand-mark"><span>¡P!</span></span>
      <span className="brand-copy"><strong>PALABRA</strong><small>ADMIN · ANALYTICS</small></span>
    </a>
  );
}

export function AdminAnalyticsClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store" });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "无法读取统计数据。");
      setData(result);
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "无法读取统计数据。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return <main className="admin-shell"><header className="admin-header"><BrandLink /></header><div className="admin-state"><span className="admin-loader" /><b>正在整理 Palabra 数据…</b></div></main>;
  }

  if (error && !data) {
    return <main className="admin-shell"><header className="admin-header"><BrandLink /></header><div className="admin-state admin-denied"><b>无法进入数据中心</b><p>{error}</p><a href="/">返回 Palabra 首页</a></div></main>;
  }

  if (!data) return null;
  const maxDaily = Math.max(1, ...data.daily.map((item) => Math.max(item.activeUsers, item.registrations)));
  const maxCategory = Math.max(1, ...data.popularCategories.map((item) => item.count));
  const overviewCards = [
    { label: "注册账号", value: data.overview.totalUsers, note: `近 7 天 +${data.overview.newSevenDays}`, tone: "red" },
    { label: "今日活跃", value: data.overview.activeToday, note: `7 天活跃 ${data.overview.activeSevenDays}`, tone: "blue" },
    { label: "学习用户", value: data.overview.studiedUsers, note: `${data.overview.studiedWords} 个单词有进度`, tone: "green" },
    { label: "已掌握单词", value: data.overview.masteredWords, note: "熟悉度达到绿色", tone: "yellow" },
    { label: "创建房间", value: data.overview.roomCount, note: `${data.overview.finishedRooms} 局已完成`, tone: "violet" },
  ];

  return (
    <main className="admin-shell">
      <header className="admin-header"><BrandLink /><div><span>管理员 <b>{data.viewer.username}</b></span><a href="/">返回首页</a></div></header>
      <div className="admin-content">
        <section className="admin-hero">
          <div><div className="eyebrow">PALABRA DATA CENTER</div><h1>你的产品，正在怎样被使用？</h1><p>注册与学习历史会直接统计；功能次数和活跃时长从本版本上线后开始积累。</p></div>
          <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "刷新中…" : "刷新数据"}</button>
        </section>

        <section className="admin-overview" aria-label="关键数据">
          {overviewCards.map((card) => <article className={`tone-${card.tone}`} key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}
        </section>

        <div className="admin-dashboard-grid">
          <section className="admin-panel admin-trend-panel">
            <header><div><span>最近 14 天</span><h2>注册与活跃趋势</h2></div><div className="admin-chart-legend"><i className="new" />新增账号<i className="active" />活跃用户</div></header>
            <div className="admin-chart">
              {data.daily.map((item) => (
                <div className="admin-chart-day" key={item.day} title={`${item.day}：新增 ${item.registrations}，活跃 ${item.activeUsers}`}>
                  <div className="admin-chart-bars"><i className="new" style={{ "--bar-height": `${Math.max(3, item.registrations / maxDaily * 100)}%` } as ChartStyle} /><i className="active" style={{ "--bar-height": `${Math.max(3, item.activeUsers / maxDaily * 100)}%` } as ChartStyle} /></div>
                  <small>{dayLabel(item.day)}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel admin-feature-panel">
            <header><div><span>使用时长</span><h2>各功能活跃情况</h2></div></header>
            <div className="admin-feature-list">
              {data.featureUsage.length === 0 && <p className="admin-empty">新版统计刚刚开始，等待产生使用数据。</p>}
              {data.featureUsage.map((item) => <article key={item.feature}><i /><div><b>{FEATURE_NAMES[item.feature] ?? item.feature}</b><small>{item.users} 位用户 · {item.sessions} 次访问</small></div><strong>{duration(item.activeSeconds)}</strong></article>)}
            </div>
          </section>

          <section className="admin-panel admin-category-panel">
            <header><div><span>近 30 天</span><h2>热门学习类别</h2></div></header>
            <div className="admin-category-list">
              {data.popularCategories.length === 0 && <p className="admin-empty">类别选择会从本版本发布后开始统计。</p>}
              {data.popularCategories.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.name}</b><i><em style={{ width: `${item.count / maxCategory * 100}%` }} /></i></div><strong>{item.count}</strong></article>)}
            </div>
          </section>

          <section className="admin-panel admin-event-panel">
            <header><div><span>关键操作</span><h2>功能使用次数</h2></div></header>
            <div className="admin-event-grid">
              {data.eventUsage.length === 0 && <p className="admin-empty">等待新版本产生功能事件。</p>}
              {data.eventUsage.map((item) => <article key={item.eventName}><span>{EVENT_NAMES[item.eventName] ?? item.eventName}</span><strong>{item.events}</strong><small>{item.users} 位用户</small></article>)}
            </div>
          </section>
        </div>

        <section className="admin-panel admin-users-panel">
          <header><div><span>账号概览</span><h2>注册用户</h2></div><small>共 {data.overview.totalUsers} 个账号 · 时间为北京时间</small></header>
          <div className="admin-user-list">
            <div className="admin-user-head"><span>昵称</span><span>注册时间</span><span>学习进度</span><span>活跃时长</span><span>最近记录</span></div>
            {data.users.map((user) => <article key={`${user.username}:${user.createdAt}`}><b>{user.username}</b><span>{dateTime(user.createdAt)}</span><span>{user.studiedWords} 学习 · {user.masteredWords} 掌握</span><span>{duration(user.activeSeconds)}</span><span>{dateTime(user.lastActiveAt)}</span></article>)}
          </div>
        </section>

        <footer className="admin-footer">数据生成于 {dateTime(data.generatedAt)} · 活跃时长仅累计前台且最近有操作的时间</footer>
      </div>
    </main>
  );
}
