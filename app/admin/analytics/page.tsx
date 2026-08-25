import type { Metadata } from "next";
import { AdminAnalyticsClient } from "./admin-analytics-client";

export const metadata: Metadata = {
  title: "数据中心 · Palabra",
  description: "Palabra 管理员专属使用数据面板。",
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsClient />;
}
