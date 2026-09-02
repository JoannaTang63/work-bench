/** 展示格式化工具 */

/** 字节数 → 人类可读（B / KB / MB / GB） */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** ISO 时间 → "YYYY-MM-DD HH:mm" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 取扩展名（小写，无点则返回空串） */
export function fileExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/** 附件可预览类型：image 图片 / pdf / text 文本 / docx / xlsx / none 不可预览 */
export type PreviewKind = "image" | "pdf" | "text" | "docx" | "xlsx" | "none";

const IMAGE_MIME = /^image\/(?:png|jpe?g|gif|webp|bmp|avif)$/i;
const TEXT_MIME = /^text\//i;
const DOCX_MIME = /^\s*application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\s*$/i;
const XLSX_MIME = /^\s*application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\s*$/i;
/** 常见文本/代码扩展名（即使 mime 被标的 application/octet-stream 也按文本预览） */
const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "xml", "yml", "yaml", "toml",
  "ini", "conf", "cfg", "log", "env",
  "js", "mjs", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "h", "hpp",
  "go", "rs", "rb", "php", "sh", "bash", "zsh", "sql", "html", "htm", "css",
  "diff", "patch",
]);

/** 根据 mime 与文件名判定应采用的预览方式 */
export function previewKind(mime: string, name: string): PreviewKind {
  if (IMAGE_MIME.test(mime)) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (DOCX_MIME.test(mime) || /\.docx$/i.test(name)) return "docx";
  if (XLSX_MIME.test(mime) || /\.xlsx$/i.test(name)) return "xlsx";
  if (TEXT_MIME.test(mime) || TEXT_EXT.has(fileExt(name))) return "text";
  return "none";
}
