import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type WayfoundSupabaseClient = SupabaseClient<Database, "public">;
