# 个人工作台

单用户的个人工作台：仪表盘（含本周一览）、事件管理（任务/心情/吐槽/记录；默认月历视图，年月下拉导航，可切列表；长文内容、任务附件、事件间父子/并列/先后关联）、专注模式（番茄钟）、个人设置。
前端 + API 统一部署为单个 Cloudflare Worker；结构化数据存 Supabase，文件/头像存 Cloudflare R2。

技术文档见 [docs/spec.md](docs/spec.md)，数据库建表脚本见 [docs/supabase-schema.sql](docs/supabase-schema.sql)。

## 环境要求

- Node.js ≥ 20（Linux/macOS/Windows 均可，以下命令以 Linux/macOS shell 为例）
- npm ≥ 10

## 本地开发

```bash
# 1. 安装依赖（两个目录各自安装）
cd web && npm install
cd ../worker && npm install

# 2. 配置本地 secrets（worker/.dev.vars，已提供开发默认值，可按需修改）
#    APP_PASSWORD / AUTH_SECRET / SUPABASE_URL / SUPABASE_SERVICE_KEY

# 3. 启动 API（终端 1，默认 http://localhost:8787）
cd worker && npm run dev

# 4. 启动前端（终端 2，默认 http://localhost:5173，/api 自动代理到 8787）
cd web && npm run dev
```

本地默认登录密码：`dev-password-123`（见 `worker/.dev.vars`）。

> 未配置真实 Supabase 凭证时，登录与界面可用；涉及数据库的功能（任务、快捷方式等）会返回错误，配置后即可恢复。

## 构建与部署（单个 Cloudflare Worker）

```bash
# 1. 在 Supabase 控制台 SQL Editor 执行 docs/supabase-schema.sql 建表

# 2. 在 Cloudflare 控制台创建 R2 bucket：workbench-files

# 3. 配置 Worker secrets（一次性）
cd worker
npx wrangler secret put APP_PASSWORD        # 登录密码
npx wrangler secret put AUTH_SECRET         # 随机长字符串，如 openssl rand -hex 32
npx wrangler secret put SUPABASE_URL        # 如 https://xxxx.supabase.co
npx wrangler secret put SUPABASE_SERVICE_KEY

# 4. 构建前端并部署 Worker（静态资源 + API 一次上线）
cd ../web && npm run build
cd ../worker && npm run deploy
```

## 目录结构

```
web/     React 前端（Vite + TS + Tailwind）
worker/  Cloudflare Worker（Hono API + 静态资源托管 + R2）
docs/    技术文档与建表 SQL
```
