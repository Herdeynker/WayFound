import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { parseServerEnvironment } from "@/lib/env/schema";

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const env = parseServerEnvironment();
  const serverKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !serverKey) {
    throw new Error("Supabase server configuration is unavailable");
  }
  return createClient<Database>(env.SUPABASE_URL, serverKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
