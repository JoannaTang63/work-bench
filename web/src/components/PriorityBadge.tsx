import type { Priority } from "../lib/types";

const CONFIG: Record<Priority, { label: string; className: string }> = {
  high: {
    label: "高",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  medium: {
    label: "中",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    label: "低",
    className: "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300",
  },
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = CONFIG[priority];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
