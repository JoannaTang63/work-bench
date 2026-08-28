import { Hono } from "hono";
import { getSupabase } from "./db";

export interface ProfileRow {
  id: number;
  display_name: string;
  signature: string;
  avatar_key: string | null;
  theme: "light" | "dark";
  pomodoro_minutes: number;
  updated_at: string;
}

const profile = new Hono<{ Bindings: Env }>();

/** 头像限制：≤ 5MB；允许的图片类型（禁 svg，防内嵌脚本 XSS） */
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** GET /api/profile — 读取个人资料（单行表 id=1） */
profile.get("/", async (c) => {
  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("profile").select("*").eq("id", 1).maybeSingle();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "profile_not_found" }, 404);
  }
  return c.json({ profile: data as ProfileRow });
});

/** PUT /api/profile — 更新个人资料（部分字段可选） */
profile.put("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid_body" }, 400);
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const b = body as Record<string, unknown>;

  if (b.display_name !== undefined) {
    if (typeof b.display_name !== "string" || b.display_name.length > 50) {
      return c.json({ error: "invalid_display_name" }, 400);
    }
    patch.display_name = b.display_name;
  }
  if (b.signature !== undefined) {
    if (typeof b.signature !== "string" || b.signature.length > 200) {
      return c.json({ error: "invalid_signature" }, 400);
    }
    patch.signature = b.signature;
  }
  if (b.theme !== undefined) {
    if (b.theme !== "light" && b.theme !== "dark") {
      return c.json({ error: "invalid_theme" }, 400);
    }
    patch.theme = b.theme;
  }
  if (b.pomodoro_minutes !== undefined) {
    const n = Number(b.pomodoro_minutes);
    if (!Number.isInteger(n) || n < 5 || n > 120) {
      return c.json({ error: "invalid_pomodoro_minutes" }, 400);
    }
    patch.pomodoro_minutes = n;
  }

  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("profile").update(patch).eq("id", 1).select().single();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ profile: data as ProfileRow });
});

/** GET /api/profile/avatar — 读取头像图片（Bearer 鉴权） */
profile.get("/avatar", async (c) => {
  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("profile").select("avatar_key").eq("id", 1).maybeSingle();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  const key = data?.avatar_key;
  if (!key) {
    return c.json({ error: "avatar_not_found" }, 404);
  }
  const obj = await c.env.BUCKET.get(key);
  if (!obj) {
    return c.json({ error: "avatar_not_found" }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "private, no-store");
  return new Response(obj.body, { headers });
});

/** POST /api/profile/avatar — multipart 上传头像（≤ 5MB，仅常见图片格式） */
profile.post("/avatar", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "invalid_file" }, 400);
  }
  const ext = AVATAR_MIME_EXT[file.type];
  if (!ext) {
    return c.json({ error: "invalid_image_type" }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: "empty_file" }, 400);
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "file_too_large", max_size: MAX_AVATAR_SIZE }, 413);
  }

  const key = `avatar/${crypto.randomUUID()}.${ext}`;
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const sb = getSupabase(c.env);
  // 先取旧 key，更新成功后清理旧对象
  const { data: before } = await sb.from("profile").select("avatar_key").eq("id", 1).maybeSingle();
  const oldKey = before?.avatar_key ?? null;

  const { data, error } = await sb
    .from("profile")
    .update({ avatar_key: key, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("avatar_key")
    .single();
  if (error) {
    // 元数据更新失败时回滚新上传的 R2 对象
    await c.env.BUCKET.delete(key).catch(() => {});
    return c.json({ error: "db_error", message: error.message }, 502);
  }

  // 清理旧头像对象（best-effort，失败仅忽略）
  if (oldKey && oldKey !== key) {
    await c.env.BUCKET.delete(oldKey).catch(() => {});
  }

  return c.json({ avatar_key: data.avatar_key }, 201);
});

export default profile;
