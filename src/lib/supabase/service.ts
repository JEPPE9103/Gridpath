import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return key || null;
}

export function createSupabaseServiceClient(): SupabaseClient {
  const key = getSupabaseServiceRoleKey();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  const { url } = getSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
