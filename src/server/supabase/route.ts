import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseServerConfig } from "./config";
import type { WayfoundSupabaseClient } from "./types";

export function createSupabaseRouteClient(
  request: NextRequest,
  response: NextResponse,
): WayfoundSupabaseClient {
  const { url, key } = getSupabaseServerConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values: Array<{ name: string; value: string; options: CookieOptions }>) {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  }) as unknown as WayfoundSupabaseClient;
}
