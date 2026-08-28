import { useMemo, useState } from "react";
import { monthGrid, PRIORITY_CARD_STYLE, TYPE_CARD_STYLE, WEEKDAY_LABELS, type DayCell } from "../lib/calendar";
import { EVENT_TYPE_META, eventTypeOf, type Task } from "../lib/types";

interface TaskCalendarProps {
  tasks: Task[];
  busyIds: Set<string>;
  /** 点空白日期格 → 新建该日截止的事件 */
  onCreateAt: (iso: string) => void;
  /** 点事件卡 → 编辑 */
  onEditTask: (task: Task) => void;
  /** 点圆点 → 切换完成状态 */
  onToggle: (task: Task) => void;
}

/** 格子里最多渲染的事件条数，超出显示 "+N" */
const MAX_CARDS_PER_CELL = 3;

function CalendarTaskCard({
  task,
  busy,
  onEdit,
  onToggle,
}: {
  task: Task;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const done = task.status === "done";
  const type = eventTypeOf(task);
  const isTask = type === "task";
  const style = isTask ? PRIORITY_CARD_STYLE[task.priority] : TYPE_CARD_STYLE[type];
  return (
    <div
      className={`group flex items-center gap-1 rounded border-l-2 px-1 py-0.5 text-left transition-colors ${style} ${
        done ? "opacity-45 dark:opacity-40" : ""
      }`}
    >
      {/* 任务：完成切换圆点；非任务：类型 emoji 标识 */}
      {isTask ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) onToggle();
          }}
          title={done ? "标记为未完成" : "标记为已完成"}
          className={`shrink-0 rounded-full border transition-colors ${
            done
              ? "border-green-500 bg-green-500 text-white"
              : "border-slate-400 bg-white/60 hover:border-indigo-500 dark:border-slate-500 dark:bg-transparent"
          } h-3 w-3 shrink-0`}
        >
          {done && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ) : (
        <span className="shrink-0 text-[11px] leading-4" title={EVENT_TYPE_META[type].label}>
          {EVENT_TYPE_META[type].emoji}
        </span>
      )}
      {/* 标题：点卡片任意处编辑 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={`min-w-0 flex-1 truncate text-xs leading-4 ${done ? "line-through" : ""}`}
        title={task.title}
      >
        {task.title}
      </button>
      {!!task.file_count && (
        <span className="shrink-0 text-[10px] leading-4 opacity-70" title={`${task.file_count} 个附件`}>
          📎{task.file_count}
        </span>
      )}
    </div>
  );
}

export default function TaskCalendar({ tasks, busyIds, onCreateAt, onEditTask, onToggle }: TaskCalendarProps) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const grid: DayCell[] = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  /** 下拉可选年份：当前年 ±8 */
  const years = useMemo(
    () => Array.from({ length: 17 }, (_, i) => now.getFullYear() - 8 + i),
    [now],
  );

  /** 按 ISO 日期分组的事件（只分有截止日期的） */
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const list = map.get(t.due_date);
      if (list) list.push(t);
      else map.set(t.due_date, [t]);
    }
    return map;
  }, [tasks]);

  /** 未排期事件（无截止日期），月历下方收纳 */
  const unscheduled = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function backToToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  const isCurrentMonth =
    cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold tabular-nums outline-none transition-colors focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800";

  return (
    <div>
      {/* 月份导航：前后翻滚 + 年/月下拉直选 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            title="上个月"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <select
            value={cursor.year}
            onChange={(e) => setCursor((c) => ({ ...c, year: Number(e.target.value) }))}
            title="选择年份"
            className={selectClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          <select
            value={cursor.month}
            onChange={(e) => setCursor((c) => ({ ...c, month: Number(e.target.value) }))}
            title="选择月份"
            className={selectClass}
          >
            {Array.from({ length: 12 }, (_, m) => (
              <option key={m} value={m}>
                {m + 1} 月
              </option>
            ))}
          </select>
          <button
            onClick={() => shiftMonth(1)}
            title="下个月"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        {!isCurrentMonth && (
          <button
            onClick={backToToday}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
          >
            回到今天
          </button>
        )}
      </div>

      {/* 周头 */}
      <div className="grid grid-cols-7 gap-1 pb-1.5 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const dayTasks = byDate.get(cell.iso) ?? [];
          const visible = dayTasks.slice(0, MAX_CARDS_PER_CELL);
          const overflow = dayTasks.length - visible.length;
          return (
            <div
              key={cell.iso}
              onDoubleClick={() => onCreateAt(cell.iso)}
              title="双击新建该日事件"
              className={`group flex min-h-[92px] cursor-pointer flex-col gap-0.5 rounded-lg border p-1 transition-colors ${
                cell.inMonth
                  ? "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/50"
                  : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              {/* 日期数字 */}
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums ${
                    cell.isToday
                      ? "bg-indigo-600 font-bold text-white"
                      : cell.inMonth
                        ? "text-slate-600 dark:text-slate-300"
                        : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  {cell.day}
                </span>
                {/* 快捷新建按钮（悬浮出现） */}
                <button
                  onClick={() => onCreateAt(cell.iso)}
                  title={`新建 ${cell.iso} 的事件`}
                  className="rounded p-0.5 text-slate-300 opacity-0 transition-all hover:bg-indigo-50 hover:text-indigo-500 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-slate-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
              {/* 事件卡片 */}
              {visible.map((t) => (
                <CalendarTaskCard
                  key={t.id}
                  task={t}
                  busy={busyIds.has(t.id)}
                  onEdit={() => onEditTask(t)}
                  onToggle={() => onToggle(t)}
                />
              ))}
              {overflow > 0 && (
                <button
                  onClick={() => onEditTask(dayTasks[MAX_CARDS_PER_CELL])}
                  title={`还有 ${overflow} 个事件，点击查看`}
                  className="px-1 text-left text-[10px] font-medium text-indigo-500 hover:underline dark:text-indigo-400"
                >
                  +{overflow} 个
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 未排期事件收纳区 */}
      {unscheduled.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            未排期（{unscheduled.length}）— 没有日期的吐槽、心情、想法都收在这
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((t) => (
              <CalendarTaskCard
                key={t.id}
                task={t}
                busy={busyIds.has(t.id)}
                onEdit={() => onEditTask(t)}
                onToggle={() => onToggle(t)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-red-500 bg-red-50 dark:bg-red-900/25" /> 高优先级
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20" /> 中优先级
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-slate-400 bg-slate-100 dark:bg-slate-700/50" /> 低优先级
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-pink-400 bg-pink-50 dark:bg-pink-900/20" /> 😊 心情
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-orange-400 bg-orange-50 dark:bg-orange-900/20" /> 😤 吐槽
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-l-2 border-l-teal-400 bg-teal-50 dark:bg-teal-900/20" /> 📝 记录
        </span>
        <span>双击日期格或点 ＋ 快捷新建</span>
      </div>
    </div>
  );
}
