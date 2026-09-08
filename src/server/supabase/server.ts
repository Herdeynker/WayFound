import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseServerConfig } from "./config";
import type { Database } from "./database.types";
import type { WayfoundSupabaseClient } from "./types";

export async function createSupabaseServerClient(): Promise<WayfoundSupabaseClient> {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseServerConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot always mutate cookies. Middleware owns refresh writes.
        }
      },
    },
  }) as unknown as WayfoundSupabaseClient;
}
