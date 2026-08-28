import { NavLink } from "react-router-dom";
import { CollapseIcon, DashboardIcon, ExpandIcon, FocusIcon, SettingsIcon, TasksIcon } from "./Icons";

const NAV_ITEMS = [
  { to: "/dashboard", label: "仪表盘", Icon: DashboardIcon },
  { to: "/tasks", label: "事件", Icon: TasksIcon },
  { to: "/focus", label: "专注模式", Icon: FocusIcon },
  { to: "/settings", label: "个人设置", Icon: SettingsIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-800 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo 区 */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          工
        </div>
        {!collapsed && <span className="truncate text-base font-semibold">个人工作台</span>}
      </div>

      {/* 导航项 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="ml-3 truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 折叠按钮 */}
      <button
        onClick={onToggle}
        title={collapsed ? "展开导航" : "折叠导航"}
        className="flex items-center justify-center border-t border-slate-200 p-3 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        {collapsed ? <ExpandIcon className="h-5 w-5" /> : <CollapseIcon className="h-5 w-5" />}
      </button>
    </aside>
  );
}
