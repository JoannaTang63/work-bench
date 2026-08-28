// 认证：单一共享密码 → HMAC 签名 token（有效期 7 天）
// token 格式: `${exp}.${hmacSha256Hex(AUTH_SECRET, exp)}`

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueToken(secret: string): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${await hmacHex(secret, String(exp))}`;
}

export async function verifyToken(secret: string, token: string): Promise<boolean> {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return false;
  const exp = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await hmacHex(secret, exp);
  if (sig.length !== expected.length) return false;
  // 定长字符串比较（避免提前退出）
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// —— 登录限速（内存计数，per-isolate best-effort，MVP 够用）——
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 分钟窗口
const RATE_MAX_ATTEMPTS = 10; // 窗口内最多失败尝试次数

const attempts = new Map<string, { count: number; resetAt: number }>();

/** 返回 true 表示允许继续尝试；false 表示已被限速 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  rec.count += 1;
  return rec.count <= RATE_MAX_ATTEMPTS;
}
