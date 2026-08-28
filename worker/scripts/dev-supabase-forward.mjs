// 仅沙箱本地调试用：把 http://127.0.0.1:8788 的请求经 HTTP 代理转发到 Supabase。
// 背景：workerd（wrangler dev）的 fetch 不支持 HTTP_PROXY，而沙箱外网必须走代理。
// 部署到 Cloudflare Workers 后无需此脚本（Worker 出口可直连 Supabase）。
// 用法：NODE_USE_ENV_PROXY=1 node scripts/dev-supabase-forward.mjs
// 然后在 .dev.vars 中设置 SUPABASE_URL=http://127.0.0.1:8788
import http from "node:http";

const PORT = 8788;
const TARGET = process.env.FORWARD_TARGET ?? "https://ybpdzywpxutlxlatealh.supabase.co";
const targetHost = new URL(TARGET).host;

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    // 转发头：去掉 host/connection/content-length（由 fetch 重算），其余透传
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    headers.host = targetHost;

    const resp = await fetch(TARGET + req.url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });

    const buf = Buffer.from(await resp.arrayBuffer());
    const respHeaders = {};
    resp.headers.forEach((v, k) => {
      // 丢弃逐跳/长度相关头，避免与本地响应不一致
      if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) {
        respHeaders[k] = v;
      }
    });
    res.writeHead(resp.status, respHeaders);
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "forward_error", message: String(err?.message ?? err) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`supabase forwarder: http://127.0.0.1:${PORT} -> ${TARGET} (via proxy)`);
});
