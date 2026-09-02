# 个人工作台 — 技术 Spec

> 状态：随实现逐步更新（当前完成：步骤 0 脚手架 + 登录 + 布局架构；步骤 1 仪表盘；步骤 2 任务管理 CRUD；步骤 3 专注模式；步骤 4 文档库；步骤 5 个人设置——头像上传/资料/主题/专注时长偏好；迭代 1 日历视觉改造——任务月历视图 + 仪表盘本周一览；迭代 2 文档改为任务附件——移除独立文档库；迭代 3 事件化——类型/长文内容/事件关联/年月下拉导航/内容搜索；迭代 4 附件在线预览——图片内嵌缩略图 + 图片/PDF/文本/Word(docx)/Excel(xlsx) 在线预览弹层）

## 1. 系统概述

单用户个人工作台 SPA：仪表盘、事件（任务/心情/吐槽/记录，含长文内容、附件与相互关联）、专注模式（番茄钟）、个人设置。

* **结构化数据**（任务、快捷方式、文件元数据、个人资料）：Supabase Postgres

* **对象存储**（文档/图片/头像）：Cloudflare R2

* **访问方式**：前端只与同一个 Cloudflare Worker 通信（API + 静态资源同域托管），Supabase service key 与 R2 凭证全部留在服务端

## 2. 架构

```
浏览器 (React SPA)
   │  同一域名：静态资源 + /api/* (Bearer token)
   ▼
Cloudflare Worker（单 Worker 一次部署）
   ├── Static Assets 托管 web/dist（SPA fallback → index.html）
   ├── 鉴权中间件（密码登录 → HMAC token，7 天有效）
   ├── /api/tasks /api/shortcuts /api/profile ──→ Supabase Postgres (service key)
   └── /api/files /api/profile/avatar ──→ R2 (bucket: workbench-files) + Supabase 元数据
```

关键配置（worker/wrangler.toml）：

```toml
[assets]
directory = "../web/dist"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "workbench-files"
```

## 3. 技术栈

| 层    | 技术                                                  | 说明                                     |
| ---- | --------------------------------------------------- | -------------------------------------- |
| 前端   | React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3.4 | `darkMode: 'class'`，react-router-dom 6 |
| API  | Cloudflare Workers + Hono 4                         | 单 Worker；wrangler 4.x                  |
| 数据库  | Supabase Postgres（supabase-js 2，service role）       | 所有表开 RLS 无 policy                      |
| 对象存储 | Cloudflare R2                                       | Worker 内 binding 直连，无凭证出服务端            |
| 提示音  | Web Audio API OscillatorNode                        | 无外部 mp3 依赖                             |

## 4. 页面与功能

| 页面          | 功能要点                                                                                                                                                                                                                                                                                                                                                                  | <br /> |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 仪表盘         | 今日概览（待办/已完成/今日到期，**迭代 3 起仅统计"任务"类型事件**，旧数据无 type 视为任务）；**本周一览条（WeekStrip）**：周一\~周日 7 格显示每日事件量与完成进度，今天高亮、过去淡化、高优先级未完成标红，点击跳转事件页月历；常用快捷方式（可编辑）；随机励志语录                                                                                                                                                                                                                   | <br /> |
| 事件（原"任务清单"） | **默认月历视图（TaskCalendar）**：42 格月网格（周一开头），事件按日期落入日期格——任务按优先级着色（高=红/中=琥珀/低=灰蓝），心情/吐槽/记录分别以 😊 粉 / 😤 橙 / 📝 青色条 + emoji 呈现，今天圆形高亮；**迭代 3：年/月两个下拉直选导航**（年份当前 ±8，保留前后翻滚与"回到今天"）；双击日期格或悬浮 ＋ 快捷新建（弹窗预填该日期）；点事件卡编辑、点圆点切换完成（仅任务类型）；单格超 3 条折叠为 "+N"；无日期事件收进"未排期"收纳区；可切换回列表视图（筛选/排序/搜索联动，列表显示类型徽标与内容摘要）                                                                           | <br /> |
| 事件编辑弹窗      | **迭代 3：事件化表单**——类型四选一（📌 任务/😊 心情/😤 吐槽/📝 记录，优先级选择仅任务类型显示）；标题 + 长文内容（≤ 10000 字，多行编辑）；日期；**父级事件下拉**（可选）；**关联管理区**：按 之前/之后/并列/子级 分组展示关联事件胶囊，点击胶囊跳转编辑对方，× 移除关联，底部选择事件 + 关系（排在它之前/之后/与之并列）添加；附件管理（见下行）                                                                                                                                                                   | <br /> |
| 专注模式        | 番茄钟倒计时（默认时长读取个人设置，读取失败回退 25 分钟）；Web Audio 合成提示音；全屏；今日番茄计数（localStorage 按日分键）                                                                                                                                                                                                                                                                                          | <br /> |
| 事件附件        | **（迭代 2：原独立文档库页已移除）** 文件归属事件：编辑弹窗内上传/下载/删除附件（≤ 50MB/个）；列表与月历卡片显示 📎 数量徽标；新建事件保存后即可上传；删除事件时级联删除附件行并清理 R2 对象。**（迭代 4：在线预览）** 附件不再只是"链接/下载入口"——上传完成后即可在弹出内**免下载查看内容**：图片附件在列表内联缩略图（带鉴权拉取 blob 本地渲染，点击放大）；点击预览在弹层内展示图片（object-contain）、PDF（iframe）或文本（解码后逐字展示）；**Word `docx`（docx-preview 渲染成 HTML）与 Excel `xlsx`（SheetJS 解析首个工作表渲染成表格）** 也在弹层内在线预览（docx-preview / xlsx 均按需动态 import 懒加载，不拖累首屏）；由 `previewKind()`（`web/src/lib/format.ts`）依据 MIME 与扩展名判定预览方式，**旧版二进制格式（.doc/.xls/.ppt/.pptx）与其它不可预览类型**（如 zip）提示"暂不支持在线预览"并引导下载，避免误导 | <br /> |
| 事件关联        | **（迭代 3 新增，可选、不强制）** 三种关系：父级/子级（层级，经 parent\_id）；并列（无向 sibling）；先后（有向 before，"之前/之后"两向展示）。点击事件可在弹窗中看到其前、后、并列、父子事件并点击跳转；顶栏搜索覆盖标题与内容；数据库未迁移时关联接口返回 503，UI 提示需执行迁移，其余功能不受影响                                                                                                                                                                                              | <br /> |
| 个人设置        | 头像上传（≤ 5MB，R2 + avatar\_key 指针，换头像自动清理旧对象）；昵称/签名；浅色/深色主题（即时生效并持久化）；默认专注时长（5–120 分钟）                                                                                                                                                                                                                                                                                   | <br /> |

日历相关公共逻辑在 `web/src/lib/calendar.ts`（月网格生成、本周日期计算、优先级/类型配色常量），月历与本周条共用；事件类型元数据（label/emoji）在 `web/src/lib/types.ts` 的 `EVENT_TYPE_META`。

## 5. 数据模型

完整建表 SQL 见 [supabase-schema.sql](./supabase-schema.sql)。

| 表                | 用途             | 关键字段                                                                                                                                                                           |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| tasks            | 事件（含任务）        | title, due\_date, priority(high/medium/low), status(pending/done), **type(task/mood/vent/note，迭代 3 新增）, content（长文内容，≤ 10000 字）, parent\_id（外键 → tasks.id，父级事件，删父置空，迭代 3 新增）** |
| event\_relations | 事件间关联（迭代 3 新增） | from\_id/to\_id（外键 → tasks.id，级联删除）, kind(sibling=并列无向 / before=from 先于 to 有向)，unique(from\_id,to\_id,kind)，check(from\_id<>to\_id)                                            |
| shortcuts        | 仪表盘快捷方式        | title, url, sort\_order                                                                                                                                                        |
| files            | 事件附件元数据        | **task\_id（外键 → tasks.id，级联删除，迭代 2 新增）**, name, r2\_key(`tasks/<task_id>/<uuid>-<name>`), size, mime\_type                                                                     |
| profile          | 个人资料（单行 id=1）  | display\_name, signature, avatar\_key, theme, pomodoro\_minutes                                                                                                                |

> 存量表沿用 `tasks` 表名（历史原因，避免破坏性 rename），语义上为"事件"。迭代 3 增量迁移（幂等，可重复执行）见 supabase-schema.sql 文末段落：`alter table tasks add column type/content/parent_id` + 建 `event_relations` 表。
> Worker 端做了**未迁移降级**：新列/新表不存在时，列表/新建/编辑自动回退旧字段集（type 视为 task、content 丢弃、parent 置空），关联接口返回 503 `relations_not_migrated`——迁移执行后无需改代码即自动启用全部能力。

## 6. API 契约

### 认证

* `POST /api/auth/login` `{password}` → `{token}`；token = `{exp}.{hmacSha256(AUTH_SECRET, exp)}`，7 天有效

* 登录限速：同 IP 5 分钟窗口最多 10 次尝试，超出返回 429

* 其余 `/api/*` 需 `Authorization: Bearer <token>`；无效/过期返回 401（前端清 token 跳 /login）

### 接口列表

| 方法 & 路径                                        | 说明                                                                                                                   | 状态 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -- |
| GET /api/health                                | 存活检查（无鉴权）                                                                                                            | ✅  |
| POST /api/auth/login                           | 密码登录                                                                                                                 | ✅  |
| GET/PUT /api/profile                           | 读/更新个人资料                                                                                                             | ✅  |
| GET /api/tasks                                 | 事件列表（?status=\&q=，**q 同时搜索标题与内容（迭代 3）**；服务端排序：优先级→日期→创建时间；响应含 file\_count 与 type/content/parent\_id，schema 未迁移时逐级降级） | ✅  |
| GET /api/tasks/:id                             | 单个事件详情（迭代 3 新增：弹窗跳转关联事件时拉取完整数据）                                                                                      | ✅  |
| POST/PATCH/DELETE /api/tasks/:id               | 事件增删改（标题/日期/优先级/状态/类型/内容/父级逐字段校验，日期严格 YYYY-MM-DD；parent\_id 服务端防环（沿祖先链追溯）；DELETE 级联清理附件行、关联行与 R2 对象；未迁移时新字段自动降级丢弃）   | ✅  |
| GET /api/tasks/:id/relations                   | 事件关联全景：{parent, children, siblings, before, after}（迭代 3 新增；未迁移时各组为空/接口 503）                                          | ✅  |
| POST /api/tasks/:id/relations                  | 建立关联 {to\_id, kind}：sibling 无向查重；before 同向重复/反向矛盾均 409（迭代 3 新增；未迁移 503 relations\_not\_migrated）                     | ✅  |
| DELETE /api/tasks/:id/relations?to\_id=\&kind= | 移除关联（sibling 双向删；before 仅删 from=:id → to=to\_id 这一条，前端从 from 侧发起；迭代 3 新增）                                            | ✅  |
| GET/POST/PATCH/DELETE /api/shortcuts/:id       | 快捷方式 CRUD（URL 服务端规范化，仅 http/https）                                                                                   | ✅  |
| GET /api/files?task\_id=                       | 某事件的附件列表（按上传时间倒序）                                                                                                    | ✅  |
| POST /api/files                                | 上传附件（multipart fields: file + task\_id，校验事件存在；≤ 50MB；R2 key `tasks/<task_id>/<uuid>-<name>`；失败自动回滚 R2）               | ✅  |
| GET /api/files/:id                             | 附件读取/下载（?download=1 触发保存；**迭代 4：不带 download 时返回 inline，供浏览器内联预览**；Bearer 鉴权 + blob，token 不落 URL）               | ✅  |
| DELETE /api/files/:id                          | 删除附件（先删元数据行，再删 R2 对象）                                                                                                | ✅  |
| GET/POST /api/profile/avatar                   | 头像读取/上传（≤ 5MB，仅 image/jpeg/png/gif/webp，禁 svg 防 XSS；元数据更新失败回滚 R2，成功后清理旧头像）                                           | ✅  |

## 7. 安全设计

1. Supabase `SERVICE_ROLE_KEY` 仅存 Worker secret（`wrangler secret put`），前端代码/git 中不出现
2. 数据库表全部开启 RLS 且不创建 policy：anon key 即使泄漏也无法读写
3. 所有 DB 访问经 supabase-js 参数化查询；R2 对象 key 服务端 uuid 生成，不信任客户端文件名
4. 文件上传限制单文件 ≤ 50MB（Workers 请求体上限 100MB 留余量）
5. 已知边界（MVP 接受）：单一共享密码、无找回；登录限速为内存实现（per-isolate，非全局精确计数）
6. **附件预览安全（迭代 4）**：预览一律经 `fetchBlob` 带 Bearer 头拉取 blob 后用 `URL.createObjectURL` 展示，token/文件 URL 不进地址栏；文本预览与 xlsx 表格渲染均**不经原始 content 注入**——文本用 React 节点渲染（自动转义），xlsx 由 SheetJS `sheet_to_html` 生成的转义 HTML 放入受控容器，docx 由 docx-preview 在受控 `docx-container` 内渲染；仅大图、PDF 用 iframe 内联展示；docx-preview / xlsx 均按需懒加载包，避免首屏载入大体积解析库

## 8. 本地开发与部署

见根目录 [README.md](../README.md)。

> 沙箱/受限网络环境备注：`wrangler dev`（workerd）的 fetch 不支持 HTTP\_PROXY。若开发机外网必须经代理（如本沙箱），可运行 `worker/scripts/dev-supabase-forward.mjs` 将 Supabase 流量经 Node 代理转发（`NODE_USE_ENV_PROXY=1 node scripts/dev-supabase-forward.mjs`，`.dev.vars` 的 `SUPABASE_URL` 指向 `http://127.0.0.1:8788`）。正常网络环境与线上部署无需此脚本。

