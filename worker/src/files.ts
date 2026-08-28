import { Hono } from "hono";
import { getSupabase } from "./db";

export interface FileRow {
  id: string;
  task_id: string;
  name: string;
  size: number;
  mime_type: string;
  created_at: string;
}

/** 单文件上限 50MB（Workers 请求体上限 100MB，留余量） */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const files = new Hono<{ Bindings: Env }>();

/** GET /api/files?task_id= — 某任务的附件列表（按上传时间倒序） */
files.get("/", async (c) => {
  const taskId = c.req.query("task_id");
  if (!taskId) {
    return c.json({ error: "missing_task_id" }, 400);
  }
  const sb = getSupabase(c.env);
  const { data, error } = await sb
    .from("files")
    .select("id, task_id, name, size, mime_type, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ files: (data ?? []) as FileRow[] });
});

/** POST /api/files — multipart 上传（fields: file, task_id），写 R2 + 元数据 */
files.post("/", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  const taskId = form?.get("task_id");
  if (!(file instanceof File)) {
    return c.json({ error: "invalid_file" }, 400);
  }
  if (typeof taskId !== "string" || !/^[0-9a-f-]{36}$/i.test(taskId)) {
    return c.json({ error: "invalid_task_id" }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: "empty_file" }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "file_too_large", max_size: MAX_FILE_SIZE }, 413);
  }

  // 校验任务存在（外键也会兜底，但提前给出更明确的错误码）
  const sb = getSupabase(c.env);
  const { data: task } = await sb.from("tasks").select("id").eq("id", taskId).maybeSingle();
  if (!task) {
    return c.json({ error: "task_not_found" }, 404);
  }

  // 文件名仅取最后一段并限长（防路径注入）；R2 key 按任务分目录 + uuid 前缀保证唯一
  const rawName = file.name || "unnamed";
  const safeName = rawName.split(/[/\\]/).pop()?.slice(0, 200) || "unnamed";
  const key = `tasks/${taskId}/${crypto.randomUUID()}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";

  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: mimeType },
  });

  const { data, error } = await sb
    .from("files")
    .insert({ task_id: taskId, name: safeName, r2_key: key, size: file.size, mime_type: mimeType })
    .select("id, task_id, name, size, mime_type, created_at")
    .single();
  if (error) {
    // 元数据写入失败时回滚 R2 对象，避免产生孤儿文件
    await c.env.BUCKET.delete(key).catch(() => {});
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ file: data as FileRow }, 201);
});

/** GET /api/files/:id — 从 R2 流式返回文件；?download=1 时作为附件下载 */
files.get("/:id", async (c) => {
  const id = c.req.param("id");
  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("files").select("*").eq("id", id).maybeSingle();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }

  const obj = await c.env.BUCKET.get(data.r2_key);
  if (!obj) {
    return c.json({ error: "not_found" }, 404);
  }

  const download = c.req.query("download") === "1";
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? data.mime_type ?? "application/octet-stream");
  headers.set("Content-Length", String(obj.size));
  // RFC 5987 编码文件名，支持中文等非 ASCII 字符
  headers.set(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(data.name)}`,
  );
  headers.set("Cache-Control", "private, no-store");
  return new Response(obj.body, { headers });
});

/** DELETE /api/files/:id — 先删元数据，再删 R2 对象（R2 删除失败仅忽略，残留对象无害） */
files.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("files").delete().eq("id", id).select().single();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }
  await c.env.BUCKET.delete(data.r2_key).catch(() => {});
  return c.json({ ok: true });
});

export default files;
