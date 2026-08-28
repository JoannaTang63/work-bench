import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon } from "./Icons";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function TopBar() {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
  const timeText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim();
    if (!q) return;
    navigate(`/tasks?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-800">
      {/* 日期 + 实时时间 */}
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{dateText}</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">
          {timeText}
        </span>
      </div>

      {/* 搜索框：回车跳转事件页，按标题/内容过滤 */}
      <div className="relative w-full max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="搜索事件（标题/内容），回车…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-600 dark:bg-slate-700 dark:focus:border-indigo-500 dark:focus:bg-slate-700"
        />
      </div>
    </header>
  );
}
