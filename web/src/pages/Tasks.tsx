import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EVENT_TYPE_META, eventTypeOf, todayISO, type EventType, type Task } from "../lib/types";
import PriorityBadge from "../components/PriorityBadge";
import TaskCalendar from "../components/TaskCalendar";
import TaskModal from "../components/TaskModal";

type StatusFilter = "all" | "pending" | "done";
type ViewMode = "calendar" | "list";

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "未完成" },
  { value: "done", label: "已完成" },
];

/** 截止日期展示：过期且未完成 → 红色"已过期 N 天"；今天 → 强调 */
function DueDateLabel({ task }: { task: Task }) {
  if (!task.due_date) return <span className="text-xs text-slate-400 dark:text-slate-500">无日期</span>;
  const [y, m, d] = task.due_date.split("-").map(Number);
  const text = `${m}月${d}日`;

  if (task.status === "pending" && eventTypeOf(task) === "task") {
    const today = todayISO();
    if (task.due_date < today) {
      const days = Math.round((Date.parse(today) - Date.parse(task.due_date)) / 86400000);
      return (
        <span className="text-xs font-medium text-red-500">
          {text} · 已过期 {days} 天
        </span>
      );
    }
    if (task.due_date === today) {
      return <span className="text-xs font-medium text-amber-500">{text} · 今天到期</span>;
    }
  }
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">
      {text}
      {y !== new Date().getFullYear() ? `（${y}）` : ""}
    </span>
  );
}

/** 非任务类型的类型徽标（心情/吐槽/记录；task 分支不会走到，兜底样式同记录） */
function TypeBadge({ type }: { type: EventType }) {
  const cls: Record<EventType, string> = {
    task: "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300",
    mood: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    vent: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    note: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${cls[type]}`}>
      {EVENT_TYPE_META[type].emoji} {EVENT_TYPE_META[type].label}
    </span>
  );
}

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("calendar"); // 默认月历
  const [sortBy, setSortBy] = useState<"priority" | "due">("priority");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0);
  const [modal, setModal] = useState<{ task: Task | null; defaultDueDate?: string } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (q) params.set("q", q);
      const { tasks: list } = await api.get<{ tasks: Task[] }>(`/api/tasks?${params.toString()}`);
      setTasks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, [statusFilter, q]);

  useEffect(() => {
    load();
  }, [load, reloadFlag]);

  /** 前端切换"按截止日期"排序（服务端默认按优先级） */
  const displayTasks = useMemo(() => {
    if (!tasks || sortBy !== "due") return tasks;
    return [...tasks].sort((a, b) => {
      if (a.due_date === b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });
  }, [tasks, sortBy]);

  function markBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function toggleStatus(task: Task) {
    if (busyIds.has(task.id)) return;
    markBusy(task.id, true);
    try {
      const { task: updated } = await api.patch<{ task: Task }>(`/api/tasks/${task.id}`, {
        status: task.status === "pending" ? "done" : "pending",
      });
      setTasks((prev) =>
        prev
          ? statusFilter === "all" || view === "calendar"
            ? prev.map((t) => (t.id === updated.id ? updated : t)) // 月历/全部视图下原地更新（划线）
            : prev.filter((t) => t.id !== updated.id) // 筛选视图下列表移出
          : prev,
      );
    } catch {
      window.alert("更新失败，请稍后重试");
    } finally {
      markBusy(task.id, false);
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`确定删除事件「${task.title}」？`)) return;
    markBusy(task.id, true);
    try {
      await api.delete(`/api/tasks/${task.id}`);
      setTasks((prev) => (prev ? prev.filter((t) => t.id !== task.id) : prev));
    } catch {
      window.alert("删除失败，请稍后重试");
    } finally {
      markBusy(task.id, false);
    }
  }

  function clearSearch() {
    setSearchParams({});
  }

  return (
    <div className={`mx-auto ${view === "calendar" ? "max-w-5xl" : "max-w-3xl"}`}>
      {/* 页头 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">事件</h1>
        <div className="flex items-center gap-2">
          {/* 视图切换：月历 / 列表 */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800">
            <button
              onClick={() => setView("calendar")}
              title="月历视图"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                view === "calendar"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              月历
            </button>
            <button
              onClick={() => setView("list")}
              title="列表视图"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                view === "list"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              列表
            </button>
          </div>
          <button
            onClick={() => setModal({ task: null })}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            ＋ 新增事件
          </button>
        </div>
      </div>

      {/* 搜索条件提示 */}
      {q && (
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          搜索：“{q}”
          <button onClick={clearSearch} title="清除搜索" className="text-xs text-indigo-600 hover:underline dark:text-indigo-300">
            清除 ✕
          </button>
        </div>
      )}

      {/* 筛选 + 排序工具栏 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-600 dark:bg-slate-800">
          {FILTER_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                statusFilter === value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "list" && (
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            排序
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "priority" | "due")}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="priority">按优先级</option>
              <option value="due">按截止日期</option>
            </select>
          </label>
        )}
      </div>

      {/* 列表 */}
      {error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <p>事件加载失败{error === "db_error" ? "（数据库暂不可用，请检查 Supabase 配置）" : ""}</p>
          <button onClick={() => setReloadFlag((f) => f + 1)} className="mt-2 text-indigo-600 hover:underline dark:text-indigo-300">
            重试
          </button>
        </div>
      ) : tasks === null ? (
        <div className="space-y-2">
          {Array.from({ length: view === "calendar" ? 6 : 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      ) : view === "calendar" ? (
        tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
            {q || statusFilter !== "all" ? "没有符合条件的事件" : "还没有事件——双击月历上任意一天，或点右上角「新增事件」开始"}
          </div>
        ) : (
          <TaskCalendar
            tasks={tasks}
            busyIds={busyIds}
            onCreateAt={(iso) => setModal({ task: null, defaultDueDate: iso })}
            onEditTask={(task) => setModal({ task })}
            onToggle={toggleStatus}
          />
        )
      ) : displayTasks!.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
          {q || statusFilter !== "all" ? "没有符合条件的事件" : "还没有事件，点击右上角「新增事件」开始"}
        </div>
      ) : (
        <ul className="space-y-2">
          {displayTasks!.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/40"
            >
              {/* 完成复选框 */}
              <input
                type="checkbox"
                checked={task.status === "done"}
                disabled={busyIds.has(task.id)}
                onChange={() => toggleStatus(task)}
                className="h-5 w-5 shrink-0 cursor-pointer rounded accent-indigo-600"
              />

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${task.status === "done" ? "text-slate-400 line-through dark:text-slate-500" : ""}`}>
                  {task.title}
                </p>
                {task.content && (
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500" title={task.content}>
                    {task.content}
                  </p>
                )}
                <div className="mt-0.5 flex items-center gap-2">
                  {eventTypeOf(task) === "task" ? (
                    <PriorityBadge priority={task.priority} />
                  ) : (
                    <TypeBadge type={eventTypeOf(task)} />
                  )}
                  <DueDateLabel task={task} />
                  {!!task.file_count && (
                    <span
                      title={`${task.file_count} 个附件`}
                      className="inline-flex items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                      {task.file_count}
                    </span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={() => setModal({ task })}
                disabled={busyIds.has(task.id)}
                title="编辑"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(task)}
                disabled={busyIds.has(task.id)}
                title="删除"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-900/30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0115.916 21.75h-7.832a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 新增/编辑模态框（key=事件id：切换编辑目标时强制重建，避免表单残留上一个事件的 state） */}
      {modal && (
        <TaskModal
          key={modal.task?.id ?? "new"}
          task={modal.task}
          defaultDueDate={modal.defaultDueDate}
          allTasks={tasks ?? []}
          onOpenById={(id) => {
            // 点击关联事件 → 拉取最新完整数据后切换编辑目标（不用摘要，避免旧数据覆盖内容）
            void (async () => {
              try {
                const { task: t } = await api.get<{ task: Task }>(`/api/tasks/${id}`);
                setModal({ task: t });
              } catch {
                window.alert("该事件可能已被删除");
              }
            })();
          }}
          onClose={() => setModal(null)}
          onSaved={() => setReloadFlag((f) => f + 1)}
        />
      )}
    </div>
  );
}
