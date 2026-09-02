import { previewKind } from "../src/lib/format";

const cases: [string, string, string][] = [
  ["image/png", "a.png", "image"],
  ["image/jpeg", "a.jpg", "image"],
  ["image/webp", "a.webp", "image"],
  ["application/pdf", "a.pdf", "pdf"],
  ["application/octet-stream", "a.pdf", "pdf"],
  ["text/plain", "a.txt", "text"],
  ["application/octet-stream", "a.md", "text"],
  ["application/octet-stream", "a.yaml", "text"],
  ["application/octet-stream", "a.py", "text"],
  ["application/octet-stream", "run.sh", "text"],
  ["application/json", "data.json", "text"],
  ["application/zip", "a.zip", "none"],
  ["application/x-msdownload", "a.exe", "none"],
  ["application/octet-stream", "a.docx", "docx"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx", "docx"],
  ["application/octet-stream", "a.xlsx", "xlsx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx", "xlsx"],
  ["application/msword", "a.doc", "none"],
  ["application/octet-stream", "a.xls", "none"],
  ["application/octet-stream", "a.ppt", "none"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "a.pptx", "none"],
  ["", "a.unknownext", "none"],
];

let fail = 0;
for (const [mime, name, want] of cases) {
  const got = previewKind(mime, name);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${mime} / ${name} -> ${got} (want ${want})`);
}
console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);