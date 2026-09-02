// 临时测试服务器：静态托管 web/dist + 桩 /api/* 响应，用于端到端验证附件预览 UI（跑完即删）
import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { spawnSync } from "node:child_process";
import { utils as xlsxUtils, write as writeXlsx } from "xlsx";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = 8791;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".pdf": "application/pdf",
};

// 1x1 红色 PNG
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const SAMPLE_TXT = Buffer.from("这是附件预览的文本内容\n第二行：验证文本解码预览。\n");
// 最小可解析 PDF（含 "hello"）
const SAMPLE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000103 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF\n",
);

// 用 xlsx 库动态生成真实 .xlsx（多 sheet）供前端预览解析与 tab 切换验证
function makeXlsxBuf() {
  const wb = xlsxUtils.book_new();
  const ws1 = xlsxUtils.aoa_to_sheet([
    ["月份", "销售额", "目标达成"],
    ["1月", 12800, "95%"],
    ["2月", 15600, "102%"],
    ["3月", 14300, "98%"],
  ]);
  xlsxUtils.book_append_sheet(wb, ws1, "季度数据");
  const ws2 = xlsxUtils.aoa_to_sheet([
    ["部门", "负责人", "人数"],
    ["研发", "张工", 12],
    ["市场", "李工", 8],
  ]);
  xlsxUtils.book_append_sheet(wb, ws2, "人员编制");
  return Buffer.from(writeXlsx(wb, { type: "array", bookType: "xlsx" }));
}

// 真实可解析的最小 .docx（OOXML zip，含一段文字）
const docxBuf = (() => {
  try {
    const script = new URL("./_make-docx.cjs", import.meta.url);
    const r = spawnSync("node", [script.pathname], { encoding: "buffer" });
    if (r.status === 0 && r.stdout && r.stdout.length > 0) return r.stdout;
  } catch {
    /* 退回占位 */
  }
  return Buffer.from("placeholder"); // 无法生成时前端预览会提示失败，仅用验证分流
})();

const BYTES = {
  "img-1": { buf: RED_PNG, mime: "image/png", name: "示意图.png" },
  "pdf-1": { buf: SAMPLE_PDF, mime: "application/pdf", name: "说明文档.pdf" },
  "txt-1": { buf: SAMPLE_TXT, mime: "text/plain", name: "备注.txt" },
  "zip-1": { buf: Buffer.from("notazip"), mime: "application/zip", name: "打包.zip" },
  "xls-1": { buf: makeXlsxBuf(), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "销售统计.xlsx" },
  "doc-1": { buf: docxBuf, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "会议纪要.docx" },
  "old-doc-1": { buf: Buffer.from("old"), mime: "application/msword", name: "旧版.doc" },
};
const FILES = Object.entries(BYTES).map(([id, v], i) => ({
  id,
  task_id: "11111111-1111-4111-8111-111111111111",
  name: v.name,
  size: v.buf.length,
  mime_type: v.mime,
  created_at: new Date(Date.now() - i * 60000).toISOString(),
}));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // ---- API 桩 ----
  if (p === "/api/auth/login" && req.method === "POST") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: "test-token" }));
    return;
  }
  if (p === "/api/tasks" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        tasks: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "带附件的演示事件",
            due_date: null,
            priority: "high",
            status: "pending",
            type: "task",
            content: "",
            parent_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            file_count: 7,
          },
        ],
      }),
    );
    return;
  }
  if (/^\/api\/files\/[^/]+/.test(p) && req.method === "GET") {
    const id = p.slice("/api/files/".length);
    const hit = BYTES[id];
    if (!hit) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    res.writeHead(200, {
      "Content-Type": hit.mime,
      "Content-Length": String(hit.buf.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(hit.name)}`,
    });
    res.end(hit.buf);
    return;
  }
  if (p === "/api/files" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ files: FILES }));
    return;
  }
  if (p === "/api/profile" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: 1,
        display_name: "tester",
        signature: "",
        avatar_key: null,
        theme: "light",
        pomodoro_minutes: 25,
        updated_at: new Date().toISOString(),
      }),
    );
    return;
  }
  // 其它 API 兜底
  if (p.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (p === "/api/shortcuts" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ shortcuts: [] }));
    return;
  }
  if (p.startsWith("/api/tasks/") && p.endsWith("/relations") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ relations: { parent: null, children: [], siblings: [], before: [], after: [] } }));
    return;
  }

  // ---- 静态资源（SPA fallback） ----
  const rel = p === "/" ? "index.html" : p.slice(1);
  const filePath = normalize(join(DIST, rel));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  let content;
  try {
    content = await readFile(filePath);
  } catch {
    try {
      content = await readFile(join(DIST, "index.html"));
    } catch {
      res.writeHead(404);
      res.end("not found");
      return;
    }
  }
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
  res.end(content);
});

server.listen(PORT, () => console.log(`mock server on http://localhost:${PORT}`));