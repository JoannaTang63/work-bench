interface StatCardProps {
  label: string;
  value: number | null; // null = 加载中
  accent: "indigo" | "green" | "amber";
  hint?: string;
}

const ACCENTS: Record<StatCardProps["accent"], string> = {
  indigo: "text-indigo-600 dark:text-indigo-300",
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export default function StatCard({ label, value, accent, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${ACCENTS[accent]}`}>
        {value === null ? "—" : value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
