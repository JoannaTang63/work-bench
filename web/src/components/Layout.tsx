import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { api, getToken } from "../lib/api";
import { applyTheme, loadCachedTheme, type Profile } from "../lib/types";

const SIDEBAR_KEY = "workbench_sidebar_collapsed";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");

  // 主题：优先 localStorage 缓存（首屏已生效），再尝试从 profile 同步
  useEffect(() => {
    applyTheme(loadCachedTheme());
    if (!getToken()) return;
    api
      .get<{ profile: Profile }>("/api/profile")
      .then(({ profile }) => {
        if (profile?.theme) applyTheme(profile.theme);
      })
      .catch(() => {
        // 本地未配置 Supabase 时忽略（502/404 等），沿用缓存主题
      });
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <div className="flex h-full">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
