import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { todayISO, type Task } from "../lib/types";
import QuoteCard from "../components/QuoteCard";
import ShortcutsSection from "../components/ShortcutsSection";
import StatCard from "../components/StatCard";
import WeekStrip from "../components/WeekStrip";

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const { tasks: list } = await api.get<{ tasks: Task[] }>("/api/tasks");
      setTasks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadFlag]);

  // 今日概览只统计"任务"类型（心情/吐槽/记录不进待办口径；旧数据无 type 视为任务）
  const taskOnly = tasks?.filter((t) => !t.type || t.type === "task") ?? null;
  const pending = taskOnly?.filter((t) => t.status === "pending").length ?? null;
  const done = taskOnly?.filter((t) => t.status === "done").length ?? null;
  const todayDue = taskOnly?.filter((t) => t.status === "pending" && t.due_date === todayISO()).length ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-xl font-semibold">仪表盘</h1>

      {/* 本周一览（与任务页月历呼应，加载失败时静默隐藏） */}
      {!error && <WeekStrip tasks={tasks} />}

      {/* 今日概览 */}
      <section>
        {error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <p>今日概览加载失败{error === "db_error" ? "（数据库暂不可用，请检查 Supabase 配置）" : ""}</p>
            <button
              onClick={() => setReloadFlag((f) => f + 1)}
              className="mt-2 text-indigo-600 hover:underline dark:text-indigo-300"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="待办任务" value={pending} accent="indigo" hint="全部未完成任务" />
            <StatCard label="已完成" value={done} accent="green" hint="累计已完成任务" />
            <StatCard label="今日到期" value={todayDue} accent="amber" hint="今天截止且未完成" />
          </div>
        )}
      </section>

      {/* 常用快捷方式 */}
      <ShortcutsSection />

      {/* 励志语录 */}
      <QuoteCard />
    </div>
  );
}
