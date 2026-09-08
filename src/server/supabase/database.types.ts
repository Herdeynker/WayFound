// Generated type snapshot for the Phase 0 migration workflow.
// Regenerate with: npm run supabase:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      phase0_migration_check: {
        Row: { id: boolean; created_at: string };
        Insert: { id?: boolean; created_at?: string };
        Update: { id?: boolean; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
