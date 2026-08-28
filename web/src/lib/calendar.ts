import { todayISO } from "./types";

export interface DayCell {
  iso: string; // YYYY-MM-DD
  day: number; // 几号
  inMonth: boolean; // 是否当前展示月（补位格为 false）
  isToday: boolean;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 生成本月日历 42 格网格（周一开头，首尾用前后月日期补位） */
export function monthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 周一=0 … 周日=6
  const start = new Date(year, month, 1 - startOffset);
  const today = todayISO();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    return {
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: iso === today,
    };
  });
}

/** 本周一 ~ 周日 7 天的 ISO 日期数组（周一开头） */
export function weekDaysISO(): string[] {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7; // 周一=0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return toISO(d);
  });
}

/** 周标签（与网格周一开头一致） */
export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 月历卡片优先级配色（左色条 + 底色） */
export const PRIORITY_CARD_STYLE: Record<string, string> = {
  high:
    "border-l-red-500 bg-red-50 text-red-700 hover:bg-red-100 dark:border-l-red-400 dark:bg-red-900/25 dark:text-red-300 dark:hover:bg-red-900/40",
  medium:
    "border-l-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-l-amber-400 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/35",
  low:
    "border-l-slate-400 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-l-slate-500 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700",
};

/** 非任务类型（心情/吐槽/记录）的月历卡片配色 */
export const TYPE_CARD_STYLE: Record<string, string> = {
  mood:
    "border-l-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-l-pink-400 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/35",
  vent:
    "border-l-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-l-orange-400 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/35",
  note:
    "border-l-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-l-teal-400 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/35",
};
