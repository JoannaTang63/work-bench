import { useMemo } from "react";
import { Link } from "react-router-dom";
import { WEEKDAY_LABELS, weekDaysISO } from "../lib/calendar";
import { todayISO, type Task } from "../lib/types";

interface WeekStripProps {
  tasks: Task[] | null; // null = 加载中
}

/** 仪表盘"本周一览"：周一~周日 7 格，显示每天任务量与完成进度，点击跳转任务页 */
export default function WeekStrip({ tasks }: WeekStripProps) {
  const days = useMemo(() => weekDaysISO(), []);
  const today = todayISO();

  /** 每日统计：总数 / 已完成数 / 高优先级未完成数 */
  const stats = useMemo(() => {
    return days.map((iso) => {
      const list = (tasks ?? []).filter((t) => t.due_date === iso);
      return {
        iso,
        total: list.length,
        done: list.filter((t) => t.status === "done").length,
        urgent: list.some((t) => t.status === "pending" && t.priority === "high"),
      };
    });
  }, [days, tasks]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">本周一览</h2>
        <Link to="/tasks" className="text-xs text-indigo-600 hover:underline dark:text-indigo-300">
          查看月历 →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {stats.map(({ iso, total, done, urgent }, i) => {
          const isToday = iso === today;
          const past = iso < today;
          const progress = total > 0 ? done / total : 0;
          const dayNum = Number(iso.slice(8));
          return (
            <Link
              key={iso}
              to="/tasks"
              title={`${iso}：共 ${total} 个事件，已完成 ${done} 个`}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors ${
                isToday
                  ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/60 dark:bg-indigo-900/30"
                  : past
                    ? "border-slate-200 bg-slate-50/60 opacity-70 dark:border-slate-700 dark:bg-slate-800/40"
                    : "border-slate-200 bg-white hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/40"
              }`}
            >
              {/* 星期标签 */}
              <span
                className={`text-[10px] font-medium sm:text-xs ${
                  isToday ? "text-indigo-500 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {WEEKDAY_LABELS[i]}
              </span>
              {/* 日期数字：今天圆形高亮 */}
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums sm:h-7 sm:w-7 ${
                  isToday
                    ? "bg-indigo-600 font-bold text-white"
                    : past
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {dayNum}
              </span>
              {/* 任务量 */}
              <span className="h-4 text-[11px] tabular-nums">
                {total === 0 ? (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                ) : (
                  <span
                    className={
                      urgent && done < total
                        ? "font-semibold text-red-500 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {done}/{total}
                  </span>
                )}
              </span>
              {/* 完成进度小条 */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${progress === 1 && total > 0 ? "bg-green-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
