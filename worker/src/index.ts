import { Hono } from "hono";
import { checkRateLimit, issueToken, verifyToken } from "./auth";
import profile from "./profile";
import shortcuts from "./shortcuts";
import tasks from "./tasks";
import files from "./files";

const app = new Hono<{ Bindings: Env }>();

// 无需鉴权的接口
app.get("/api/health", (c) => c.json({ ok: true }));

// 登录：校验密码（带简单限速）→ 签发 7 天有效 token
app.post("/api/auth/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  if (!checkRateLimit(ip)) {
    return c.json({ error: "too_many_attempts" }, 429);
  }
  const body = await c.req.json().catch(() => null);
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || password !== c.env.APP_PASSWORD) {
    return c.json({ error: "invalid_password" }, 401);
  }
  const token = await issueToken(c.env.AUTH_SECRET);
  return c.json({ token });
});

// 其余 /api/* 一律需要 Bearer token
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (path === "/api/health" || path === "/api/auth/login") {
    return next();
  }
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !(await verifyToken(c.env.AUTH_SECRET, token))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

// 业务路由（后续模块逐步追加：avatar）
app.route("/api/profile", profile);
app.route("/api/tasks", tasks);
app.route("/api/shortcuts", shortcuts);
app.route("/api/files", files);

export default app;
