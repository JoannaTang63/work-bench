import { useState } from "react";

/** 快捷方式图标：favicon 服务，加载失败回退首字母色块 */
export default function ShortcutIcon({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  if (failed || !hostname) {
    // 根据域名哈希取色，保证同一站点颜色稳定
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = (hash * 31 + hostname.charCodeAt(i)) % 360;
    }
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
        style={{ backgroundColor: `hsl(${hash}, 60%, 45%)` }}
      >
        {title.charAt(0).toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 rounded-lg bg-slate-100 object-contain p-1 dark:bg-slate-700"
    />
  );
}
