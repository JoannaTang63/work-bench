import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";
import { LockIcon } from "../components/Icons";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const { token } = await api.post<{ token: string }>("/api/auth/login", { password });
      setToken(token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const code = err instanceof Error ? err.message : "login_failed";
      setError(
        code === "invalid_password"
          ? "密码错误，请重试"
          : code === "too_many_attempts"
            ? "尝试次数过多，请 5 分钟后再试"
            : "登录失败，请稍后重试",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <LockIcon className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">个人工作台</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">请输入访问密码</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoFocus
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-600 dark:bg-slate-700 dark:focus:border-indigo-500"
          />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "登录中…" : "进入工作台"}
          </button>
        </form>
      </div>
    </div>
  );
}
