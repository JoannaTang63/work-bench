export type Theme = "light" | "dark";

export interface Profile {
  id: number;
  display_name: string;
  signature: string;
  avatar_key: string | null;
  theme: Theme;
  pomodoro_minutes: number;
  updated_at: string;
}

export type Priority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "done";
/** 迭代 3：事件类型（task=任务 mood=心情 vent=吐槽 note=记录） */
export type EventType = "task" | "mood" | "vent" | "note";

export interface Task {
  id: string;
  title: string;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  /** 以下为迭代 3 新增字段（旧数据/未迁移时缺省 → 按 task 处理） */
  type?: EventType;
  content?: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  /** 附件数量（服务端聚合，旧数据可能缺省） */
  file_count?: number;
}

/** 事件类型元数据 */
export const EVENT_TYPE_META: Record<EventType, { label: string; emoji: string }> = {
  task: { label: "任务", emoji: "📌" },
  mood: { label: "心情", emoji: "😊" },
  vent: { label: "吐槽", emoji: "😤" },
  note: { label: "记录", emoji: "📝" },
};

/** 旧数据/未迁移行无 type 字段 → 视为普通任务 */
export function eventTypeOf(t: { type?: EventType }): EventType {
  return t.type ?? "task";
}

/** 关联事件摘要（/api/tasks/:id/relations 返回） */
export interface TaskSummary {
  id: string;
  title: string;
  type?: EventType;
  status: TaskStatus;
  due_date: string | null;
}

/** 事件关联全景：父级 / 子级 / 并列 / 之前 / 之后 */
export interface EventRelations {
  parent: TaskSummary | null;
  children: TaskSummary[];
  siblings: TaskSummary[];
  /** 排在本事件之前的事件 */
  before: TaskSummary[];
  /** 排在本事件之后的事件 */
  after: TaskSummary[];
}

/** 任务附件元数据 */
export interface TaskFile {
  id: string;
  task_id: string;
  name: string;
  size: number;
  mime_type: string;
  created_at: string;
}

export interface Shortcut {
  id: string;
  title: string;
  url: string;
  sort_order: number;
  created_at: string;
}

/** 主题工具：写 localStorage 缓存并同步到 <html> 的 dark class */
export function applyTheme(theme: Theme): void {
  localStorage.setItem("workbench_theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function loadCachedTheme(): Theme {
  return localStorage.getItem("workbench_theme") === "dark" ? "dark" : "light";
}

/** 本地日期的 YYYY-MM-DD（用于与后端 date 字段比较） */
export function todayISO(): string {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
