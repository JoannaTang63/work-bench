import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken } from "../lib/api";
import { applyTheme, type Profile, type Theme } from "../lib/types";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 与服务端一致

/** 头像预览：带 Authorization 头取 blob（token 不落 URL）；无头像时回退首字母 */
function AvatarPreview({ displayName, version }: { displayName: string; version: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const token = getToken();
    if (!token) return;

    fetch("/api/profile/avatar", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        } else if (!cancelled && !blob) {
          setUrl(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version]);

  if (url) {
    return <img src={url} alt="头像" className="h-20 w-20 rounded-full object-cover" />;
  }
  const letter = displayName.trim().charAt(0).toUpperCase() || "我";
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
      {letter}
    </div>
  );
}

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signature, setSignature] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { profile: p } = await api.get<{ profile: Profile }>("/api/profile");
      setProfile(p);
      setDisplayName(p.display_name);
      setSignature(p.signature);
      setTheme(p.theme);
      setPomodoroMinutes(p.pomodoro_minutes);
      applyTheme(p.theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 主题切换：即时生效 + 立即持久化（不等"保存"按钮） */
  async function changeTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    try {
      await api.put("/api/profile", { theme: next });
    } catch {
      // 持久化失败时静默（本地主题已生效，下次进入以 profile 为准）
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const minutes = Number(pomodoroMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
      setSaveError("专注时长需为 5–120 的整数分钟");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await api.put("/api/profile", {
        display_name: displayName,
        signature,
        theme,
        pomodoro_minutes: minutes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setSaveError(
        code === "db_error"
          ? "保存失败（数据库暂不可用）"
          : code === "invalid_pomodoro_minutes"
            ? "专注时长需为 5–120 的整数分钟"
            : "保存失败，请稍后重试",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(list: FileList | null) {
    const file = list?.[0];
    if (!file || avatarUploading) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("请选择图片文件");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("头像不能超过 5MB");
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload("/api/profile/avatar", formData);
      setAvatarVersion((v) => v + 1);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setAvatarError(
        code === "file_too_large"
          ? "头像不能超过 5MB"
          : code === "invalid_image_type"
            ? "仅支持 JPG / PNG / GIF / WebP 图片"
            : "头像上传失败，请稍后重试",
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">个人设置</h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <p>设置加载失败{error === "db_error" ? "（数据库暂不可用，请检查 Supabase 配置）" : ""}</p>
          <button onClick={load} className="mt-2 text-indigo-600 hover:underline dark:text-indigo-300">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">个人设置</h1>

      <div className="space-y-5">
        {/* 头像 */}
        <section className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <AvatarPreview displayName={displayName} version={avatarVersion} />
          <div>
            <p className="text-sm font-medium">头像</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">JPG / PNG / GIF / WebP，≤ 5MB</p>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              {avatarUploading ? "上传中…" : "更换头像"}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              hidden
              onChange={(e) => {
                void handleAvatarChange(e.target.files);
                e.target.value = "";
              }}
            />
            {avatarError && <p className="mt-1.5 text-xs text-red-500">{avatarError}</p>}
          </div>
        </section>

        {/* 资料表单 */}
        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">昵称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="你的名字"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">个性签名</label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              maxLength={200}
              placeholder="一句话介绍自己"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">主题</label>
            <div className="flex gap-2">
              {(
                [
                  { value: "light", label: "☀ 浅色" },
                  { value: "dark", label: "🌙 深色" },
                ] as { value: Theme; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void changeTheme(value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    theme === value
                      ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">切换后立即生效并保存</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              默认专注时长（分钟）
            </label>
            <input
              type="number"
              min={5}
              max={120}
              step={1}
              value={pomodoroMinutes}
              onChange={(e) => setPomodoroMinutes(Number(e.target.value))}
              className="w-32 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">范围 5–120 分钟，专注模式将使用该时长</p>
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
            {saved && <span className="text-sm text-green-600 dark:text-green-400">已保存 ✓</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
