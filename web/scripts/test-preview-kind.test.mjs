// 临时测试脚本：用 esbuild 转译 format.ts，验证 previewKind 分类（跑完即删）
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const src = await readFile(new URL("../src/lib/format.ts", import.meta.url), "utf8");
const out = await transform(src, { loader: "ts", format: "esm" });

// 把 esmodule 转成全局可用：去掉 import/export，追加挂载
const bundle = out.code
  .replace(/^import[^\n]*\n/gm, "")
  .replace(/^export /gm, "")
  .replace(/\bexport\b/g, "")
  + "\n;globalThis.__pk = { previewKind };";
const m = new Function(bundle);
m();

const { previewKind } = globalThis.__pk;
const cases = [
  ["image/png", "a.png", "image"],
  ["image/jpeg", "pic.jpg", "image"],
  ["application/pdf", "a.pdf", "pdf"],
  ["application/octet-stream", "report.pdf", "pdf"],
  ["text/plain", "a.txt", "text"],
  ["application/json", "a.json", "text"],
  ["application/octet-stream", "notes.md", "text"],
  ["text/markdown", "a.md", "text"],
  ["text/csv", "a.csv", "text"],
  ["application/octet-stream", "script.ts", "text"],
  ["application/octet-stream", "a.zip", "none"],
  ["image/svg+xml", "a.svg", "none"],
  ["application/x-zip-compressed", "b.bin", "none"],
];
let pass = 0;
for (const [mime, name, exp] of cases) {
  const got = previewKind(mime, name);
  const ok = got === exp;
  if (!ok) console.log("FAIL", mime, name, "exp", exp, "got", got);
  else pass++;
}
console.log(`preview-kind: ${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);