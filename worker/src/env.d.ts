// Worker 绑定与 Secrets 类型定义
// Secrets 通过 `wrangler secret put <NAME>` 配置（本地开发放在 .dev.vars）
interface Env {
  /** R2 bucket 绑定（wrangler.toml 中 [[r2_buckets]]） */
  BUCKET: R2Bucket;
  /** 登录密码（secret） */
  APP_PASSWORD: string;
  /** token 签名密钥（secret） */
  AUTH_SECRET: string;
  /** Supabase 项目 URL（secret） */
  SUPABASE_URL: string;
  /** Supabase service role key（secret，仅服务端使用，严禁进前端） */
  SUPABASE_SERVICE_KEY: string;
}
