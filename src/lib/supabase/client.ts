"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";

let client: SupabaseClient<Database, "public"> | undefined;

export function createSupabaseBrowserClient(): SupabaseClient<Database, "public"> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase browser configuration is unavailable");
  client = createBrowserClient<Database>(url, key) as unknown as SupabaseClient<Database, "public">;
  return client;
}
