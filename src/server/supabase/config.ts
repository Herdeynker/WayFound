import "server-only";

import { parsePublicEnvironment, parseServerEnvironment } from "@/lib/env/schema";

export function getSupabaseBrowserConfig() {
  const env = parsePublicEnvironment();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase browser configuration is unavailable");
  return { url, key };
}

export function getSupabaseServerConfig() {
  const publicEnv = parsePublicEnvironment();
  const env = parseServerEnvironment();
  const url = env.SUPABASE_URL ?? publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is unavailable");
  return { url, key };
}

export function getAppUrl(): string {
  const publicEnv = parsePublicEnvironment();
  const serverEnv = parseServerEnvironment();
  return serverEnv.APP_URL ?? publicEnv.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}
