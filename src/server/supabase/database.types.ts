// Generated-compatible type snapshot for the Phase 0 and Phase 2 migrations.
// Regenerate with: npx supabase gen types typescript --linked > src/server/supabase/database.types.ts
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
      profiles: {
        Row: { id: string; display_name: string; first_name: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string; first_name?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; display_name?: string; first_name?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      user_consents: {
        Row: { id: string; user_id: string; policy_version: string; consent_type: string; granted: boolean; required: boolean; source: string; recorded_at: string };
        Insert: { id?: string; user_id: string; policy_version: string; consent_type: string; granted: boolean; required?: boolean; source?: string; recorded_at?: string };
        Update: { id?: string; user_id?: string; policy_version?: string; consent_type?: string; granted?: boolean; required?: boolean; source?: string; recorded_at?: string };
        Relationships: [];
      };
      notification_preferences: {
        Row: { user_id: string; email_enabled: boolean; telegram_enabled: boolean; updated_at: string };
        Insert: { user_id: string; email_enabled?: boolean; telegram_enabled?: boolean; updated_at?: string };
        Update: { user_id?: string; email_enabled?: boolean; telegram_enabled?: boolean; updated_at?: string };
        Relationships: [];
      };
      audit_events: {
        Row: { id: string; user_id: string | null; event_type: string; metadata: Json; created_at: string };
        Insert: { id?: string; user_id?: string | null; event_type: string; metadata?: Json; created_at?: string };
        Update: { id?: string; user_id?: string | null; event_type?: string; metadata?: Json; created_at?: string };
        Relationships: [];
      };
      data_export_requests: {
        Row: { id: string; user_id: string; status: string; requested_at: string; updated_at: string; completed_at: string | null; failure_code: string | null };
        Insert: { id?: string; user_id: string; status?: string; requested_at?: string; updated_at?: string; completed_at?: string | null; failure_code?: string | null };
        Update: { id?: string; user_id?: string; status?: string; requested_at?: string; updated_at?: string; completed_at?: string | null; failure_code?: string | null };
        Relationships: [];
      };
      account_deletion_requests: {
        Row: { id: string; user_id: string; status: string; requested_at: string; grace_period_ends_at: string; cancelled_at: string | null; updated_at: string };
        Insert: { id?: string; user_id: string; status?: string; requested_at?: string; grace_period_ends_at: string; cancelled_at?: string | null; updated_at?: string };
        Update: { id?: string; user_id?: string; status?: string; grace_period_ends_at?: string; cancelled_at?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      cancel_account_deletion_request: { Args: { request_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
