-- 个人工作台 MVP 建表脚本
-- 使用方式：Supabase 控制台 → SQL Editor → 粘贴执行
-- 安全说明：所有表开启 RLS 且不创建 policy —— anon key 完全无权限，
--           只有 Worker 端的 service role key（绕过 RLS）可以读写。

-- ============================================================
-- 全量建表（新项目首次搭建执行本文件全部内容；
-- 已有库只需执行文末「迭代 3 增量迁移」段落）
-- ============================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'pending' check (status in ('pending','done')),
  -- 迭代 3：事件化改造 —— 不只限于"任务"，还有心情/吐槽/记录
  type text not null default 'task' check (type in ('task','mood','vent','note')),
  content text not null default '',
  parent_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shortcuts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  name text not null,
  r2_key text not null unique,
  size int not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists files_task_id_idx on files(task_id);

-- 迭代 3：事件间关联（可选、不强制）
--   sibling = 并列平行（无向，语义上 A-B 与 B-A 等价，存一行即可）
--   before  = 先后顺序（有向：from_id 的事件发生在 to_id 之前）
create table if not exists event_relations (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references tasks(id) on delete cascade,
  to_id uuid not null references tasks(id) on delete cascade,
  kind text not null check (kind in ('sibling','before')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id, kind),
  check (from_id <> to_id)
);

create index if not exists event_relations_from_idx on event_relations(from_id);
create index if not exists event_relations_to_idx on event_relations(to_id);

create table if not exists profile (
  id int primary key default 1 check (id = 1),
  display_name text not null default '',
  signature text not null default '',
  avatar_key text,
  theme text not null default 'light' check (theme in ('light','dark')),
  pomodoro_minutes int not null default 25 check (pomodoro_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);

-- 单行 profile 表初始化
insert into profile (id) values (1) on conflict (id) do nothing;

-- 开启 RLS（无 policy = anon 全拒绝，service role 不受 RLS 限制）
alter table tasks enable row level security;
alter table shortcuts enable row level security;
alter table files enable row level security;
alter table event_relations enable row level security;
alter table profile enable row level security;

-- updated_at 自动更新触发器
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists profile_set_updated_at on profile;
create trigger profile_set_updated_at before update on profile
  for each row execute function set_updated_at();

-- ============================================================
-- 迭代 3 增量迁移（已有库执行：任务 → 事件化 + 事件关联）
-- 包含：tasks 新增 type / content / parent_id 三列，
--       新建 event_relations 表（含索引、RLS），均为幂等语句，可重复执行。
-- ============================================================
alter table tasks add column if not exists type text not null default 'task'
  check (type in ('task','mood','vent','note'));
alter table tasks add column if not exists content text not null default '';
alter table tasks add column if not exists parent_id uuid references tasks(id) on delete set null;

create table if not exists event_relations (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references tasks(id) on delete cascade,
  to_id uuid not null references tasks(id) on delete cascade,
  kind text not null check (kind in ('sibling','before')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id, kind),
  check (from_id <> to_id)
);
create index if not exists event_relations_from_idx on event_relations(from_id);
create index if not exists event_relations_to_idx on event_relations(to_id);
alter table event_relations enable row level security;
