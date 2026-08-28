import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedUrl: string | undefined;
let cachedClient: SupabaseClient | undefined;

/** 获取 Supabase client（service role，绕过 RLS；凭证仅在 Worker 服务端） */
export function getSupabase(env: Env): SupabaseClient {
  if (!cachedClient || cachedUrl !== env.SUPABASE_URL) {
    cachedClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedUrl = env.SUPABASE_URL;
  }
  return cachedClient;
}
