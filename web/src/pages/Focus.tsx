import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { todayISO } from "../lib/types";
import { playDoneSound, primeAudio } from "../lib/audio";

const DEFAULT_MINUTES = 25;

/** 今日番茄计数（localStorage，按日期分键） */
function countKey(): string {
  return `workbench_pomodoro_${todayISO()}`;
}

function readCount(): number {
  return Number(localStorage.getItem(countKey()) ?? "0") || 0;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

type Phase = "idle" | "running" | "paused" | "finished";

export default function Focus() {
  const [durationSec, setDurationSec] = useState<number | null>(null); // null = 读取 profile 中
  const [remainingMs, setRemainingMs] = useState(DEFAULT_MINUTES * 60 * 1000);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(() => readCount());
  const endAtRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 读取 profile 的默认时长；读取失败（如未配置 Supabase）或数据非法时回退 25 分钟
  useEffect(() => {
    api
      .get<{ profile: { pomodoro_minutes: number } }>("/api/profile")
      .then(({ profile: p }) => {
        const minutes = Number(p?.pomodoro_minutes);
        if (!Number.isFinite(minutes) || minutes < 1) {
          throw new Error("invalid_pomodoro_minutes");
        }
        const sec = minutes * 60;
        setDurationSec(sec);
        setRemainingMs(sec * 1000);
      })
      .catch(() => {
        const sec = DEFAULT_MINUTES * 60;
        setDurationSec(sec);
        setRemainingMs(sec * 1000);
      });
  }, []);

  const finish = useCallback(() => {
    setPhase("finished");
    setRemainingMs(0);
    playDoneSound();
    const next = readCount() + 1;
    localStorage.setItem(countKey(), String(next));
    setCount(next);
  }, []);

  // 倒计时：以结束时间戳为准，避免 setInterval 累积误差
  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => {
      const remaining = endAtRef.current - Date.now();
      if (remaining <= 0) {
        finish();
      } else {
        setRemainingMs(remaining);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [phase, finish]);

  // 标签页标题同步倒计时
  useEffect(() => {
    const total = durationSec ?? DEFAULT_MINUTES * 60;
    if (phase === "running" || phase === "paused") {
      const sec = Math.ceil(remainingMs / 1000);
      document.title = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)} · 专注模式`;
    } else {
      document.title = "个人工作台";
    }
    void total;
    return () => {
      document.title = "个人工作台";
    };
  }, [phase, remainingMs, durationSec]);

  function start() {
    primeAudio(); // 用户手势中预热音频上下文
    if (remainingMs <= 0) {
      resetTimer();
    }
    endAtRef.current = Date.now() + remainingMs;
    setPhase("running");
  }

  function pause() {
    setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    setPhase("paused");
  }

  function resetTimer() {
    setPhase("idle");
    setRemainingMs((durationSec ?? DEFAULT_MINUTES * 60) * 1000);
  }

  function skip() {
    resetTimer();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  }

  const totalMs = (durationSec ?? DEFAULT_MINUTES * 60) * 1000;
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const sec = Math.ceil(remainingMs / 1000);
  const timeText = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-[60vh] flex-col items-center justify-center bg-slate-100 p-6 transition-colors dark:bg-slate-900"
    >
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">专注模式</p>

      {/* 倒计时大数字 */}
      <p
        className={`font-mono text-8xl font-bold tabular-nums transition-colors sm:text-9xl ${
          phase === "finished"
            ? "text-green-500"
            : phase === "running"
              ? "text-indigo-600 dark:text-indigo-300"
              : "text-slate-700 dark:text-slate-200"
        }`}
      >
        {timeText}
      </p>

      {/* 进度条 */}
      <div className="mt-6 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
        />
      </div>

      {/* 状态提示 */}
      <p className="mt-4 h-6 text-sm">
        {phase === "finished" ? (
          <span className="font-medium text-green-600 dark:text-green-400">完成！休息一下吧 🍅</span>
        ) : phase === "paused" ? (
          <span className="text-slate-500 dark:text-slate-400">已暂停</span>
        ) : phase === "running" ? (
          <span className="text-slate-500 dark:text-slate-400">专注中…</span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            时长 {Math.round((durationSec ?? DEFAULT_MINUTES * 60) / 60)} 分钟（可在个人设置中修改）
          </span>
        )}
      </p>

      {/* 控制按钮 */}
      <div className="mt-6 flex items-center gap-3">
        {phase === "running" ? (
          <button
            onClick={pause}
            className="rounded-xl bg-slate-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-500"
          >
            暂停
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            {phase === "paused" ? "继续" : "开始"}
          </button>
        )}
        <button
          onClick={resetTimer}
          className="rounded-xl bg-slate-100 px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          重置
        </button>
        <button
          onClick={skip}
          disabled={phase === "idle"}
          className="rounded-xl bg-slate-100 px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          跳过
        </button>
        <button
          onClick={toggleFullscreen}
          title="进入/退出全屏"
          className="rounded-xl bg-slate-100 px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          全屏
        </button>
      </div>

      {/* 今日统计 */}
      <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
        今日已完成 <span className="font-semibold text-indigo-600 dark:text-indigo-300">{count}</span> 个番茄
      </p>
    </div>
  );
}
