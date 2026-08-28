import { Hono } from "hono";
import { getSupabase } from "./db";

export interface ShortcutRow {
  id: string;
  title: string;
  url: string;
  sort_order: number;
  created_at: string;
}

const shortcuts = new Hono<{ Bindings: Env }>();

/** 容错 URL 规范化：无协议时自动补 https://，仅接受 http(s) */
function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** GET /api/shortcuts — 列表（按 sort_order, created_at 升序） */
shortcuts.get("/", async (c) => {
  const sb = getSupabase(c.env);
  const { data, error } = await sb
    .from("shortcuts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ shortcuts: (data ?? []) as ShortcutRow[] });
});

/** POST /api/shortcuts — 新增 {title, url} */
shortcuts.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const url = normalizeUrl(b.url);
  if (!title || title.length > 50) {
    return c.json({ error: "invalid_title" }, 400);
  }
  if (!url) {
    return c.json({ error: "invalid_url" }, 400);
  }

  const sb = getSupabase(c.env);
  const { data: maxRow } = await sb
    .from("shortcuts")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await sb
    .from("shortcuts")
    .insert({ title, url, sort_order: nextOrder })
    .select()
    .single();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ shortcut: data as ShortcutRow }, 201);
});

/** PATCH /api/shortcuts/:id — 更新 {title?, url?} */
shortcuts.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (b.title !== undefined) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title || title.length > 50) {
      return c.json({ error: "invalid_title" }, 400);
    }
    patch.title = title;
  }
  if (b.url !== undefined) {
    const url = normalizeUrl(b.url);
    if (!url) {
      return c.json({ error: "invalid_url" }, 400);
    }
    patch.url = url;
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: "empty_patch" }, 400);
  }

  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("shortcuts").update(patch).eq("id", id).select().maybeSingle();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ shortcut: data as ShortcutRow });
});

/** DELETE /api/shortcuts/:id — 删除 */
shortcuts.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const sb = getSupabase(c.env);
  const { error } = await sb.from("shortcuts").delete().eq("id", id);
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ ok: true });
});

export default shortcuts;
