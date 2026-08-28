import { Hono } from "hono";
import { getSupabase } from "./db";

export type Priority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "done";
/** 迭代 3：事件类型（task=任务 mood=心情 vent=吐槽 note=记录） */
export type EventType = "task" | "mood" | "vent" | "note";
/** 事件间关联：sibling=并列平行（无向） before=先后顺序（有向：from 发生在 to 之前） */
export type RelationKind = "sibling" | "before";

export interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  /** 以下为迭代 3 新增列（库未迁移时缺省 → 前端按默认值处理） */
  type?: EventType;
  content?: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
}

/** 关联事件摘要（relations 接口返回，避免整行泄露） */
export interface TaskSummary {
  id: string;
  title: string;
  type?: EventType;
  status: TaskStatus;
  due_date: string | null;
}

interface RelationRow {
  from_id: string;
  to_id: string;
  kind: RelationKind;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const EVENT_TYPES: EventType[] = ["task", "mood", "vent", "note"];
const RELATION_KINDS: RelationKind[] = ["sibling", "before"];
const SUMMARY_FIELDS = "id,title,type,status,due_date";
const CONTENT_MAX = 10000;

/** 校验 YYYY-MM-DD 且为合法日期 */
function isValidDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 判断是否为"库结构未迁移"类错误（新列/新表不存在），用于降级重试 */
function isSchemaError(message: string | undefined): boolean {
  return !!message && /column|relation|schema cache|does not exist/i.test(message);
}

const tasks = new Hono<{ Bindings: Env }>();

/**
 * GET /api/tasks?status=pending|done&q=关键词
 * q 同时搜索标题与内容（content 列需迭代 3 迁移，未迁移时降级为仅标题）。
 * 默认排序：优先级 高→中→低，同级按截止日期升序（无截止日期排最后），再按创建时间倒序。
 */
tasks.get("/", async (c) => {
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  // or() 过滤表达式以逗号分隔，值里的 , ( ) % 会破坏解析，先剔除
  const safeQ = q ? q.replace(/[,()%\\]/g, " ").trim() : "";

  const sb = getSupabase(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (query: any) => {
    let b = query;
    if (status === "pending" || status === "done") {
      b = b.eq("status", status);
    }
    if (safeQ) {
      b = b.or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`);
    }
    return b;
  };

  // 尝试 1：files(count) 聚合 + 标题/内容联合搜索（需迭代 2/3 迁移）
  let result = await applyFilters(sb.from("tasks").select("*, files(count)"));
  if (isSchemaError(result.error?.message)) {
    // 尝试 2：去掉附件聚合（未执行迭代 2 迁移）
    result = await applyFilters(sb.from("tasks").select("*"));
    if (isSchemaError(result.error?.message)) {
      // 尝试 3：content 列不存在 → 仅标题搜索（未执行迭代 3 迁移）
      let legacy = sb.from("tasks").select("*");
      if (status === "pending" || status === "done") {
        legacy = legacy.eq("status", status);
      }
      if (q) {
        legacy = legacy.ilike("title", `%${q}%`);
      }
      result = await legacy;
    }
  }
  const { data, error } = result as { data: TaskRow[] | null; error: { message?: string } | null };
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }

  // 展平附件计数：PostgREST 返回 files: [{ count: n }]；降级路径无该字段 → 0
  const rows = ((data ?? []) as (TaskRow & { files?: { count: number }[] })[]).map((t) => {
    const { files: _files, ...rest } = t;
    return { ...rest, file_count: t.files?.[0]?.count ?? 0 };
  });

  const sorted = rows.sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.created_at < b.created_at ? 1 : -1;
  });
  return c.json({ tasks: sorted });
});

/** GET /api/tasks/:id — 单个事件详情（事件弹窗跳转关联事件时使用） */
tasks.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }
  const sb = getSupabase(c.env);
  const { data, error } = await sb.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ task: data as TaskRow });
});

/** POST /api/tasks — 新建 {title, due_date?, priority?, type?, content?, parent_id?} */
tasks.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 200) {
    return c.json({ error: "invalid_title" }, 400);
  }

  const dueDate = b.due_date ?? null;
  if (dueDate !== null && !isValidDate(dueDate)) {
    return c.json({ error: "invalid_due_date" }, 400);
  }

  const priority = b.priority === undefined ? "medium" : b.priority;
  if (!PRIORITIES.includes(priority as Priority)) {
    return c.json({ error: "invalid_priority" }, 400);
  }

  const type = (b.type === undefined ? "task" : b.type) as EventType;
  if (!EVENT_TYPES.includes(type)) {
    return c.json({ error: "invalid_type" }, 400);
  }

  const content = typeof b.content === "string" ? b.content.slice(0, CONTENT_MAX) : "";

  let parentId: string | null = null;
  if (b.parent_id !== undefined && b.parent_id !== null) {
    if (typeof b.parent_id !== "string" || !UUID_RE.test(b.parent_id)) {
      return c.json({ error: "invalid_parent_id" }, 400);
    }
    parentId = b.parent_id;
  }

  const sb = getSupabase(c.env);
  if (parentId) {
    const { data: parent } = await sb.from("tasks").select("id").eq("id", parentId).maybeSingle();
    if (!parent) {
      return c.json({ error: "parent_not_found" }, 404);
    }
  }

  let result = await sb
    .from("tasks")
    .insert({ title, due_date: dueDate, priority, type, content, parent_id: parentId })
    .select()
    .single();
  if (isSchemaError(result.error?.message)) {
    // 库未迁移：去掉迭代 3 新列重试（保持旧功能可用）
    result = await sb.from("tasks").insert({ title, due_date: dueDate, priority }).select().single();
  }
  const { data, error } = result as { data: TaskRow | null; error: { message?: string } | null };
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ task: data as TaskRow }, 201);
});

/** PATCH /api/tasks/:id — 更新 {title?, due_date?, priority?, status?, type?, content?, parent_id?} */
tasks.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.title !== undefined) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title || title.length > 200) {
      return c.json({ error: "invalid_title" }, 400);
    }
    patch.title = title;
  }
  if (b.due_date !== undefined) {
    const dueDate = b.due_date;
    if (dueDate !== null && !isValidDate(dueDate)) {
      return c.json({ error: "invalid_due_date" }, 400);
    }
    patch.due_date = dueDate;
  }
  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority as Priority)) {
      return c.json({ error: "invalid_priority" }, 400);
    }
    patch.priority = b.priority;
  }
  if (b.status !== undefined) {
    if (b.status !== "pending" && b.status !== "done") {
      return c.json({ error: "invalid_status" }, 400);
    }
    patch.status = b.status;
  }
  if (b.type !== undefined) {
    if (!EVENT_TYPES.includes(b.type as EventType)) {
      return c.json({ error: "invalid_type" }, 400);
    }
    patch.type = b.type;
  }
  if (b.content !== undefined) {
    if (typeof b.content !== "string") {
      return c.json({ error: "invalid_content" }, 400);
    }
    patch.content = b.content.slice(0, CONTENT_MAX);
  }

  const sb = getSupabase(c.env);

  if (b.parent_id !== undefined) {
    const pid = b.parent_id;
    if (pid === null) {
      patch.parent_id = null;
    } else {
      if (typeof pid !== "string" || !UUID_RE.test(pid) || pid === id) {
        return c.json({ error: "invalid_parent_id" }, 400);
      }
      const { data: parent } = await sb.from("tasks").select("id").eq("id", pid).maybeSingle();
      if (!parent) {
        return c.json({ error: "parent_not_found" }, 404);
      }
      // 防环：沿新父级向上追溯祖先链，若途经自身则说明会成环
      let cur: string | null = pid;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        if (cur === id) {
          return c.json({ error: "parent_cycle" }, 400);
        }
        seen.add(cur);
        const ancRes = (await sb
          .from("tasks")
          .select("parent_id")
          .eq("id", cur)
          .maybeSingle()) as {
          data: { parent_id: string | null } | null;
          error: { message?: string } | null;
        };
        if (ancRes.error || !ancRes.data) break; // 未迁移（无 parent_id 列）或数据异常 → 停止追溯
        cur = ancRes.data.parent_id ?? null;
      }
      patch.parent_id = pid;
    }
  }

  let result = await sb.from("tasks").update(patch).eq("id", id).select().maybeSingle();
  if (isSchemaError(result.error?.message)) {
    // 库未迁移：去掉迭代 3 新列重试
    const legacy = { ...patch };
    delete legacy.type;
    delete legacy.content;
    delete legacy.parent_id;
    result = await sb.from("tasks").update(legacy).eq("id", id).select().maybeSingle();
  }
  const { data, error } = result as { data: TaskRow | null; error: { message?: string } | null };
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ task: data as TaskRow });
});

/** DELETE /api/tasks/:id — 删除事件（附件行/关联行由外键级联删除，R2 对象在此一并清理） */
tasks.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const sb = getSupabase(c.env);
  // 先取附件的 r2_key（删事件后行会被级联删掉，就查不到了）
  const { data: attached } = await sb.from("files").select("r2_key").eq("task_id", id);
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) {
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  // best-effort 清理 R2 对象（失败仅忽略，残留对象无害）
  for (const f of attached ?? []) {
    await c.env.BUCKET.delete(f.r2_key).catch(() => {});
  }
  return c.json({ ok: true });
});

/**
 * GET /api/tasks/:id/relations — 事件关联全景
 * 返回 { parent, children, siblings, before, after }：
 *   parent = 父级；children = 子级；siblings = 并列；
 *   before = 排在本事件之前的事件；after = 排在本事件之后的事件。
 * 库未迁移（无 event_relations 表 / parent_id 列）时各组返回空，不影响使用。
 */
tasks.get("/:id/relations", async (c) => {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }
  const sb = getSupabase(c.env);

  let meResult = await sb.from("tasks").select("id,parent_id").eq("id", id).maybeSingle();
  if (isSchemaError(meResult.error?.message)) {
    // 库未迁移（无 parent_id 列）：降级为仅查 id，父级返回 null
    meResult = await sb.from("tasks").select("id").eq("id", id).maybeSingle();
  }
  const me = meResult.data as { id: string; parent_id?: string | null } | null;
  if (meResult.error) {
    return c.json({ error: "db_error", message: meResult.error.message }, 502);
  }
  if (!me) {
    return c.json({ error: "not_found" }, 404);
  }

  let parent: TaskSummary | null = null;
  const children: TaskSummary[] = [];
  const siblings: TaskSummary[] = [];
  const before: TaskSummary[] = [];
  const after: TaskSummary[] = [];

  // 父级（parent_id 列未迁移时查询报错 → 静默跳过）
  if (me.parent_id) {
    const pRes = await sb.from("tasks").select(SUMMARY_FIELDS).eq("id", me.parent_id).maybeSingle();
    if (!pRes.error && pRes.data) {
      parent = pRes.data as TaskSummary;
    }
  }

  // 子级（同上，容错）
  const cRes = await sb
    .from("tasks")
    .select(SUMMARY_FIELDS)
    .eq("parent_id", id)
    .order("created_at");
  if (!cRes.error) {
    children.push(...((cRes.data ?? []) as TaskSummary[]));
  }

  // 并列 / 之前 / 之后：一次取出与本事件相关的所有关联行再分类
  const rRes = await sb
    .from("event_relations")
    .select("from_id,to_id,kind")
    .or(`from_id.eq.${id},to_id.eq.${id}`);
  const bucketOf = new Map<string, "siblings" | "before" | "after">();
  if (!rRes.error) {
    for (const r of (rRes.data ?? []) as RelationRow[]) {
      if (r.kind === "sibling") {
        bucketOf.set(r.from_id === id ? r.to_id : r.from_id, "siblings");
      } else if (r.kind === "before") {
        if (r.to_id === id) {
          bucketOf.set(r.from_id, "before"); // from 在我之前
        } else {
          bucketOf.set(r.to_id, "after"); // to 在我之后
        }
      }
    }
  }

  if (bucketOf.size > 0) {
    const sRes = await sb
      .from("tasks")
      .select(SUMMARY_FIELDS)
      .in("id", [...bucketOf.keys()]);
    for (const row of (sRes.data ?? []) as TaskSummary[]) {
      const bucket = bucketOf.get(row.id);
      if (bucket === "siblings") siblings.push(row);
      else if (bucket === "before") before.push(row);
      else if (bucket === "after") after.push(row);
    }
  }

  return c.json({ relations: { parent, children, siblings, before, after } });
});

/**
 * POST /api/tasks/:id/relations — 建立关联 {to_id, kind}
 * kind=sibling：并列（无向，两个方向视为同一条，重复创建返回 409）
 * kind=before ：from（:id）发生在 to 之前（同向重复 / 反向矛盾均返回 409）
 */
tasks.post("/:id/relations", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const b = (body ?? {}) as { to_id?: unknown; kind?: unknown };
  const toId = typeof b.to_id === "string" ? b.to_id : "";
  const kind = b.kind as RelationKind;

  if (!UUID_RE.test(id) || !UUID_RE.test(toId)) {
    return c.json({ error: "invalid_id" }, 400);
  }
  if (toId === id) {
    return c.json({ error: "self_relation" }, 400);
  }
  if (!RELATION_KINDS.includes(kind)) {
    return c.json({ error: "invalid_kind" }, 400);
  }

  const sb = getSupabase(c.env);
  const fromRes = await sb.from("tasks").select("id").eq("id", id).maybeSingle();
  const toRes = await sb.from("tasks").select("id").eq("id", toId).maybeSingle();
  if (!fromRes.data || !toRes.data) {
    return c.json({ error: "task_not_found" }, 404);
  }

  // 查重：sibling 无向（A→B / B→A 算同一条）；before 同向重复或反向矛盾都拒绝
  const dupExpr =
    kind === "sibling"
      ? `and(kind.eq.sibling,from_id.eq.${id},to_id.eq.${toId}),and(kind.eq.sibling,from_id.eq.${toId},to_id.eq.${id})`
      : `and(kind.eq.before,from_id.eq.${id},to_id.eq.${toId}),and(kind.eq.before,from_id.eq.${toId},to_id.eq.${id})`;
  const dupRes = await sb.from("event_relations").select("id").or(dupExpr);
  if (dupRes.error) {
    if (isSchemaError(dupRes.error.message)) {
      return c.json({ error: "relations_not_migrated" }, 503);
    }
    return c.json({ error: "db_error", message: dupRes.error.message }, 502);
  }
  if ((dupRes.data ?? []).length > 0) {
    return c.json({ error: "relation_exists" }, 409);
  }

  const insRes = await sb
    .from("event_relations")
    .insert({ from_id: id, to_id: toId, kind })
    .select()
    .single();
  if (insRes.error) {
    if (isSchemaError(insRes.error.message)) {
      return c.json({ error: "relations_not_migrated" }, 503);
    }
    return c.json({ error: "db_error", message: insRes.error.message }, 502);
  }
  return c.json({ relation: insRes.data }, 201);
});

/**
 * DELETE /api/tasks/:id/relations?to_id=&kind= — 移除关联
 * kind=sibling：无向，两个方向都尝试删除
 * kind=before ：有向，只删除 from_id=:id 且 to_id=to_id 的这一条
 * （前端需从"关系持有方"视角调用：之前列表的对方是 from，之后列表的对方是 to）
 */
tasks.delete("/:id/relations", async (c) => {
  const id = c.req.param("id");
  const toId = c.req.query("to_id") ?? "";
  const kind = c.req.query("kind") ?? "";

  if (!UUID_RE.test(id) || !UUID_RE.test(toId)) {
    return c.json({ error: "invalid_id" }, 400);
  }
  if (!RELATION_KINDS.includes(kind as RelationKind)) {
    return c.json({ error: "invalid_kind" }, 400);
  }

  const sb = getSupabase(c.env);
  const filter =
    kind === "sibling"
      ? `and(kind.eq.sibling,from_id.eq.${id},to_id.eq.${toId}),and(kind.eq.sibling,from_id.eq.${toId},to_id.eq.${id})`
      : `and(kind.eq.before,from_id.eq.${id},to_id.eq.${toId})`;
  const { error } = await sb.from("event_relations").delete().or(filter);
  if (error) {
    if (isSchemaError(error.message)) {
      return c.json({ error: "relations_not_migrated" }, 503);
    }
    return c.json({ error: "db_error", message: error.message }, 502);
  }
  return c.json({ ok: true });
});

export default tasks;
