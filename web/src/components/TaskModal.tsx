import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken } from "../lib/api";
import { formatSize } from "../lib/format";
import {
  EVENT_TYPE_META,
  eventTypeOf,
  type EventRelations,
  type EventType,
  type Priority,
  type Task,
  type TaskFile,
  type TaskSummary,
} from "../lib/types";

interface TaskModalProps {
  task: Task | null; // null = 新增
  /** 新增模式下预填的截止日期（月历点日期格快捷新建时传入） */
  defaultDueDate?: string;
  /** 全量事件列表（父级/关联选择器的数据源） */
  allTasks: Task[];
  /** 点击关联事件 → 跳转编辑该事件 */
  onOpenById: (id: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const TYPE_OPTIONS = (Object.keys(EVENT_TYPE_META) as EventType[]).map((value) => ({
  value,
  label: EVENT_TYPE_META[value].label,
  emoji: EVENT_TYPE_META[value].emoji,
}));

const CONTENT_PLACEHOLDER: Record<EventType, string> = {
  task: "补充细节、步骤、验收标准…",
  mood: "今天心情怎么样？发生了什么…",
  vent: "不吐不快，都写下来…",
  note: "随手记点什么…",
};

const CONTENT_MAX = 10000;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700";

/** 附件区块：仅编辑已保存的事件时可用（新事件需先保存拿到 id） */
function Attachments({ taskId }: { taskId: string }) {
  const [files, setFiles] = useState<TaskFile[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { files: list } = await api.get<{ files: TaskFile[] }>(`/api/files?task_id=${taskId}`);
      setFiles(list);
    } catch {
      setError("附件加载失败");
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(list: FileList | null) {
    const file = list?.[0];
    if (!file || uploading) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("task_id", taskId);
      formData.append("file", file);
      await api.upload("/api/files", formData);
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "file_too_large"
          ? "文件不能超过 50MB"
          : code === "task_not_found"
            ? "事件不存在（可能已被删除）"
            : "上传失败，请稍后重试",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: TaskFile) {
    if (!window.confirm(`确定删除附件「${file.name}」？`)) return;
    setError("");
    try {
      await api.delete(`/api/files/${file.id}`);
      setFiles((prev) => (prev ? prev.filter((f) => f.id !== file.id) : prev));
    } catch {
      setError("删除失败，请稍后重试");
    }
  }

  /** 带 Authorization 头取 blob 再触发下载（token 不落 URL） */
  async function handleDownload(file: TaskFile) {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/files/${file.id}?download=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("下载失败，请稍后重试");
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">附件</label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          {uploading ? "上传中…" : "＋ 上传附件"}
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            void handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mb-1 text-xs text-red-500">{error}</p>}

      {files === null ? (
        <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
      ) : files.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">暂无附件（≤ 50MB / 个）</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-700/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={f.name}>
                {f.name}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => void handleDownload(f)}
                title="下载"
                className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-slate-600"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(f)}
                title="删除"
                className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 关联事件胶囊：点击跳转编辑，× 移除 */
function RelationChip({
  summary,
  onOpen,
  onRemove,
}: {
  summary: TaskSummary;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const type = summary.type ?? "task";
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs dark:border-slate-600 dark:bg-slate-700/60">
      <button
        type="button"
        onClick={onOpen}
        title="点击查看 / 编辑该事件"
        className="max-w-[11em] truncate text-slate-700 transition-colors hover:text-indigo-600 hover:underline dark:text-slate-200 dark:hover:text-indigo-300"
      >
        {type !== "task" ? `${EVENT_TYPE_META[type].emoji} ` : ""}
        {summary.title}
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="移除该关联"
        className="rounded-full px-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
      >
        ×
      </button>
    </span>
  );
}

/** 关联区块：父级（表单下拉）之外的全部关联 —— 之前/之后/并列/子级，可添加、移除、点击跳转 */
function RelationsSection({
  taskId,
  allTasks,
  onOpenById,
}: {
  taskId: string;
  allTasks: Task[];
  onOpenById: (id: string) => void;
}) {
  const [rel, setRel] = useState<EventRelations | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addTarget, setAddTarget] = useState("");
  const [addKind, setAddKind] = useState<"before" | "after" | "sibling">("sibling");

  const load = useCallback(async () => {
    setError("");
    try {
      const { relations } = await api.get<{ relations: EventRelations }>(`/api/tasks/${taskId}/relations`);
      setRel(relations);
    } catch {
      setError("关联信息加载失败");
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRelation() {
    if (!addTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      if (addKind === "before") {
        // "之前"：所选事件排在当前事件之前（from=所选, to=当前）
        await api.post(`/api/tasks/${addTarget}/relations`, { to_id: taskId, kind: "before" });
      } else {
        // "之后"：当前事件排在所选事件之前（from=当前, to=所选）；"并列"：无向
        await api.post(`/api/tasks/${taskId}/relations`, {
          to_id: addTarget,
          kind: addKind === "after" ? "before" : "sibling",
        });
      }
      setAddTarget("");
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "relation_exists"
          ? "这两个事件已有该关联"
          : code === "relations_not_migrated"
            ? "关联功能需先执行数据库迁移（docs/supabase-schema.sql 迭代 3 段落）"
            : "添加关联失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeRelation(kind: "sibling" | "before", otherId: string, otherIsFrom: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // before 为有向关系：需从"关系持有方"（from 侧）发起删除
      const fromId = otherIsFrom ? otherId : taskId;
      const toId = otherIsFrom ? taskId : otherId;
      await api.delete(`/api/tasks/${fromId}/relations?to_id=${toId}&kind=${kind}`);
      await load();
    } catch {
      setError("移除关联失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  async function removeChild(childId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // 移除子级 = 清空该子事件的 parent_id
      await api.patch(`/api/tasks/${childId}`, { parent_id: null });
      await load();
    } catch {
      setError("移除子级失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  const groups: { label: string; items: TaskSummary[] }[] = rel
    ? [
        { label: "之前", items: rel.before },
        { label: "之后", items: rel.after },
        { label: "并列", items: rel.siblings },
        { label: "子级", items: rel.children },
      ]
    : [];

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-600">
      <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
        关联（可选）
        <span className="ml-1 font-normal text-xs text-slate-400 dark:text-slate-500">
          建立事件之间的脉络：父子、并列、先后
        </span>
      </label>

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {rel === null ? (
        <div className="h-6 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
      ) : (
        <div className="space-y-2">
          {groups.map(({ label, items }) =>
            items.length > 0 ? (
              <div key={label} className="flex flex-wrap items-center gap-1.5">
                <span className="w-8 shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
                {items.map((s) => (
                  <RelationChip
                    key={s.id}
                    summary={s}
                    onOpen={() => onOpenById(s.id)}
                    onRemove={() => {
                      if (label === "之前") return removeRelation("before", s.id, true);
                      if (label === "之后") return removeRelation("before", s.id, false);
                      if (label === "并列") return removeRelation("sibling", s.id, false);
                      return removeChild(s.id);
                    }}
                  />
                ))}
              </div>
            ) : null,
          )}

          {/* 添加关联 */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <select
              value={addTarget}
              onChange={(e) => setAddTarget(e.target.value)}
              className="max-w-[13em] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">选择事件…</option>
              {allTasks
                .filter((t) => t.id !== taskId)
                .map((t) => {
                  const type = eventTypeOf(t);
                  return (
                    <option key={t.id} value={t.id}>
                      {type !== "task" ? `${EVENT_TYPE_META[type].emoji} ` : ""}
                      {t.title}
                    </option>
                  );
                })}
            </select>
            <select
              value={addKind}
              onChange={(e) => setAddKind(e.target.value as "before" | "after" | "sibling")}
              title="所选事件与当前事件的关系"
              className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="before">排在它之前</option>
              <option value="after">排在它之后</option>
              <option value="sibling">与之并列</option>
            </select>
            <button
              type="button"
              onClick={() => void addRelation()}
              disabled={!addTarget || busy}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              ＋ 关联
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskModal({ task, defaultDueDate, allTasks, onOpenById, onClose, onSaved }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDueDate ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [type, setType] = useState<EventType>(eventTypeOf(task ?? {}));
  const [content, setContent] = useState(task?.content ?? "");
  const [parentId, setParentId] = useState(task?.parent_id ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const body = {
      title: title.trim(),
      due_date: dueDate || null,
      priority,
      type,
      content,
      parent_id: parentId || null,
    };
    try {
      if (task) {
        await api.patch(`/api/tasks/${task.id}`, body);
      } else {
        await api.post("/api/tasks", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "invalid_title"
          ? "标题不能为空（≤ 200 字符）"
          : code === "invalid_due_date"
            ? "截止日期格式不正确"
            : code === "parent_cycle"
              ? "不能把后代事件设为父级（会形成循环）"
              : code === "parent_not_found"
                ? "所选父级事件不存在（可能已被删除）"
                : "保存失败，请稍后重试",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold">{task ? "编辑事件" : "新增事件"}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 类型 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">类型</label>
            <div className="flex gap-1.5">
              {TYPE_OPTIONS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors ${
                    type === value
                      ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={200}
              placeholder={type === "task" ? "要做什么？" : "一句话概括…"}
              className={inputClass}
            />
          </div>

          {/* 内容 / 记录 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              {type === "task" ? "内容" : "记录"}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={CONTENT_MAX}
              placeholder={CONTENT_PLACEHOLDER[type]}
              className={`${inputClass} resize-y leading-relaxed`}
            />
            <p className="mt-0.5 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {content.length}/{CONTENT_MAX}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                {type === "task" ? "截止日期" : "日期"}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} dark:[color-scheme:dark]`}
              />
            </div>
            {/* 优先级仅对"任务"类型有意义 */}
            {type === "task" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">优先级</label>
                <div className="flex gap-1.5">
                  {PRIORITY_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`flex-1 rounded-lg border px-1 py-2 text-sm transition-colors ${
                        priority === value
                          ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 父级事件 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              父级事件
              <span className="ml-1 font-normal text-xs text-slate-400 dark:text-slate-500">（可选）</span>
            </label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={selectClass}>
              <option value="">（无）</option>
              {allTasks
                .filter((t) => t.id !== task?.id)
                .map((t) => {
                  const t2 = eventTypeOf(t);
                  return (
                    <option key={t.id} value={t.id}>
                      {t2 !== "task" ? `${EVENT_TYPE_META[t2].emoji} ` : ""}
                      {t.title}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* 关联：编辑已保存的事件时可管理 */}
          {task ? (
            <RelationsSection taskId={task.id} allTasks={allTasks} onOpenById={onOpenById} />
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              保存后即可设置事件关联（父子 / 并列 / 先后）与上传附件
            </p>
          )}

          {/* 附件：编辑已保存的事件时可管理 */}
          {task && <Attachments taskId={task.id} />}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
