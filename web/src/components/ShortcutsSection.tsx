import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Shortcut } from "../lib/types";
import ShortcutIcon from "./ShortcutIcon";

interface FormState {
  id: string | null; // null = 新增
  title: string;
  url: string;
}

export default function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState<Shortcut[] | null>(null);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const { shortcuts: list } = await api.get<{ shortcuts: Shortcut[] }>("/api/shortcuts");
      setShortcuts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setFormError("");
    setForm({ id: null, title: "", url: "" });
  }

  function openEdit(s: Shortcut) {
    setFormError("");
    setForm({ id: s.id, title: s.title, url: s.url });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setFormError("");
    try {
      if (form.id === null) {
        await api.post("/api/shortcuts", { title: form.title, url: form.url });
      } else {
        await api.patch(`/api/shortcuts/${form.id}`, { title: form.title, url: form.url });
      }
      setForm(null);
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setFormError(
        code === "invalid_title"
          ? "标题不能为空（≤ 50 字符）"
          : code === "invalid_url"
            ? "网址格式不正确"
            : "保存失败，请稍后重试",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除该快捷方式？")) return;
    try {
      await api.delete(`/api/shortcuts/${id}`);
      setForm(null);
      await load();
    } catch {
      window.alert("删除失败，请稍后重试");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">常用快捷方式</h2>
        {shortcuts !== null && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditMode((v) => !v);
                setForm(null);
                setFormError("");
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                editMode
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {editMode ? "完成" : "编辑"}
            </button>
            {editMode && (
              <button
                onClick={openAdd}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                ＋ 新增
              </button>
            )}
          </div>
        )}
      </div>

      {/* 新增/编辑表单 */}
      {form && (
        <form onSubmit={handleSave} className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="名称（如 GitHub）"
            autoFocus
            className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
          />
          <input
            type="text"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="网址（如 github.com）"
            className="min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
          />
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.url.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-600"
          >
            取消
          </button>
          {formError && <p className="w-full text-sm text-red-500">{formError}</p>}
        </form>
      )}

      {/* 列表 */}
      {error ? (
        <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>快捷方式加载失败{error === "db_error" ? "（数据库暂不可用）" : ""}</p>
          <button onClick={load} className="mt-2 text-indigo-600 hover:underline dark:text-indigo-300">
            重试
          </button>
        </div>
      ) : shortcuts === null ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      ) : shortcuts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          还没有快捷方式，点击右上角「编辑 → ＋ 新增」添加
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shortcuts.map((s) => (
            <div key={s.id} className="relative">
              <button
                onClick={() => (editMode ? openEdit(s) : window.open(s.url, "_blank", "noopener"))}
                title={s.url}
                className="flex h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30"
              >
                <ShortcutIcon url={s.url} title={s.title} />
                <span className="w-full truncate text-xs text-slate-600 dark:text-slate-300">{s.title}</span>
              </button>
              {editMode && (
                <button
                  onClick={() => handleDelete(s.id)}
                  title="删除"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow hover:bg-red-400"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
