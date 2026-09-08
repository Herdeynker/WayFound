// Generated-compatible type snapshot for the Phase 0, 2 and 3 migrations.
// Regenerate with: npx supabase gen types typescript --linked > src/server/supabase/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      phase0_migration_check: Table<{ id: boolean; created_at: string }, { id?: boolean; created_at?: string }>;
      profiles: Table<{ id: string; display_name: string; first_name: string; citizenship_country: string; residence_country: string; current_region: string; relocation_timeline: string; passport_available: boolean | null; passport_expiry: string | null; willing_to_relocate: boolean | null; created_at: string; updated_at: string }, { id: string; display_name?: string; first_name?: string; citizenship_country?: string; residence_country?: string; current_region?: string; relocation_timeline?: string; passport_available?: boolean | null; passport_expiry?: string | null; willing_to_relocate?: boolean | null; created_at?: string; updated_at?: string }>;
      user_consents: Table<{ id: string; user_id: string; policy_version: string; consent_type: string; granted: boolean; required: boolean; source: string; recorded_at: string }>;
      notification_preferences: Table<{ user_id: string; email_enabled: boolean; telegram_enabled: boolean; updated_at: string }>;
      audit_events: Table<{ id: string; user_id: string | null; event_type: string; metadata: Json; created_at: string }>;
      data_export_requests: Table<{ id: string; user_id: string; status: string; requested_at: string; updated_at: string; completed_at: string | null; failure_code: string | null }>;
      account_deletion_requests: Table<{ id: string; user_id: string; status: string; requested_at: string; grace_period_ends_at: string; cancelled_at: string | null; updated_at: string }>;
      user_goals: Table<{ id: string; user_id: string; goal_type: string; priority: number; created_at: string; updated_at: string }>;
      education_records: Table<{ id: string; user_id: string; institution: string; country: string; qualification_level: string; field_of_study: string; start_date: string | null; completion_date: string | null; graduation_status: string; grade_classification: string; gpa_value: number | null; gpa_scale: number | null; result_pending: boolean; expected_graduation_date: string | null; transcript_available: boolean | null; research_experience: string; publications: string; academic_awards: string; created_at: string; updated_at: string }>;
      employment_records: Table<{ id: string; user_id: string; employer: string; job_title: string; country: string; employment_type: string; start_date: string | null; end_date: string | null; currently_employed: boolean; responsibilities: string; achievements: string; industry: string; occupation_category: string; management_experience: boolean | null; remote_international_experience: boolean | null; created_at: string; updated_at: string }>;
      skills: Table<{ id: string; name: string; normalized_name: string; category: string; is_active: boolean; created_at: string }>;
      user_skills: Table<{ id: string; user_id: string; skill_id: string | null; skill_name: string; normalized_name: string; category: string; proficiency: string; years_experience: number | null; evidence: string; created_at: string; updated_at: string }>;
      certifications: Table<{ id: string; user_id: string; name: string; issuer: string; jurisdiction: string; issue_date: string | null; expiry_date: string | null; no_expiry: boolean; credential_status: string; credential_url: string; occupation_or_skill: string; created_at: string; updated_at: string }>;
      trade_experience: Table<{ id: string; user_id: string; trade_or_occupation: string; apprenticeship_status: string; practical_years: number | null; experience_documentation: string; employer_or_self_employed: string; trade_certification: string; licensing_status: string; portfolio_available: boolean | null; tools_equipment: string; driving_licence_classes: string; willing_to_complete_licensing: boolean | null; preferred_destination: string; created_at: string; updated_at: string }>;
      language_profiles: Table<{ id: string; user_id: string; language: string; proficiency: string; test_name: string; test_status: string; overall_score: number | null; component_scores: Json; test_date: string | null; expiry_date: string | null; target_score: number | null; planned_test_date: string | null; created_at: string; updated_at: string }>;
      country_preferences: Table<{ id: string; user_id: string; country_code: string; rank: number; excluded: boolean; open_to_other: boolean; opportunity_types: string[]; start_timeframe: string; funding_requirement: string; salary_expectation: string; willing_to_learn_language: boolean | null; work_mode: string; created_at: string; updated_at: string }>;
      document_metadata: Table<{ id: string; user_id: string; document_type: string; readiness_status: string; storage_path: string | null; original_filename: string | null; mime_type: string | null; size_bytes: number | null; verified_at: string | null; created_at: string; updated_at: string }>;
      onboarding_progress: Table<{ user_id: string; selected_goal_types: string[]; current_section: string; draft: Json; completion: number; revision: number; updated_at: string }>;
      profile_versions: Table<{ id: string; user_id: string; version_number: number; schema_version: string; trigger: string; snapshot: Json; created_at: string }>;
      cv_parse_jobs: Table<{ id: string; user_id: string; document_id: string | null; status: string; provider: string; provider_schema_version: string; created_at: string; updated_at: string }>;
      profile_suggestions: Table<{ id: string; user_id: string; job_id: string | null; field_path: string; proposed_value: Json; evidence: string; status: string; provider_schema_version: string; confirmed_at: string | null; created_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      cancel_account_deletion_request: { Args: { request_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
