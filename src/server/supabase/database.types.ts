export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_field_aliases: {
        Row: {
          academic_field_id: string
          alias: string
          id: string
          normalized_alias: string
        }
        Insert: {
          academic_field_id: string
          alias: string
          id?: string
          normalized_alias: string
        }
        Update: {
          academic_field_id?: string
          alias?: string
          id?: string
          normalized_alias?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_field_aliases_academic_field_id_fkey"
            columns: ["academic_field_id"]
            isOneToOne: false
            referencedRelation: "academic_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_fields: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          parent_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_fields_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "academic_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          grace_period_ends_at: string
          id: string
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          grace_period_ends_at: string
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          grace_period_ends_at?: string
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_status: string
          credential_url: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuer: string
          jurisdiction: string
          name: string
          no_expiry: boolean
          occupation_or_skill: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_status?: string
          credential_url?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string
          jurisdiction?: string
          name?: string
          no_expiry?: boolean
          occupation_or_skill?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_status?: string
          credential_url?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string
          jurisdiction?: string
          name?: string
          no_expiry?: boolean
          occupation_or_skill?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          created_at: string
          default_currency_code: string | null
          id: string
          iso_alpha2: string
          iso_alpha3: string
          name: string
          product_active: boolean
          supported_destination: boolean
          supported_origin: boolean
          timezone_identifiers: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency_code?: string | null
          id?: string
          iso_alpha2: string
          iso_alpha3: string
          name: string
          product_active?: boolean
          supported_destination?: boolean
          supported_origin?: boolean
          timezone_identifiers?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency_code?: string | null
          id?: string
          iso_alpha2?: string
          iso_alpha3?: string
          name?: string
          product_active?: boolean
          supported_destination?: boolean
          supported_origin?: boolean
          timezone_identifiers?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      country_aliases: {
        Row: {
          alias: string
          country_id: string
          created_at: string
          id: string
          normalized_alias: string
        }
        Insert: {
          alias: string
          country_id: string
          created_at?: string
          id?: string
          normalized_alias: string
        }
        Update: {
          alias?: string
          country_id?: string
          created_at?: string
          id?: string
          normalized_alias?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      country_cities: {
        Row: {
          country_id: string
          id: string
          is_active: boolean
          name: string
          region_id: string | null
        }
        Insert: {
          country_id: string
          id?: string
          is_active?: boolean
          name: string
          region_id?: string | null
        }
        Update: {
          country_id?: string
          id?: string
          is_active?: boolean
          name?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "country_cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_cities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "country_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      country_modules: {
        Row: {
          completeness_status: string
          country_id: string
          created_at: string
          external_classification_references: Json
          id: string
          last_verified_at: string | null
          module_code: string
          production_active: boolean
          recognized_evidence_categories: string[]
          rule_loader_contract: string
          supported_pathways: string[]
          terminology: Json
          updated_at: string
        }
        Insert: {
          completeness_status?: string
          country_id: string
          created_at?: string
          external_classification_references?: Json
          id?: string
          last_verified_at?: string | null
          module_code: string
          production_active?: boolean
          recognized_evidence_categories?: string[]
          rule_loader_contract: string
          supported_pathways?: string[]
          terminology?: Json
          updated_at?: string
        }
        Update: {
          completeness_status?: string
          country_id?: string
          created_at?: string
          external_classification_references?: Json
          id?: string
          last_verified_at?: string | null
          module_code?: string
          production_active?: boolean
          recognized_evidence_categories?: string[]
          rule_loader_contract?: string
          supported_pathways?: string[]
          terminology?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_modules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: true
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      country_preferences: {
        Row: {
          country_code: string
          created_at: string
          excluded: boolean
          funding_requirement: string
          id: string
          open_to_other: boolean
          opportunity_types: string[]
          rank: number
          salary_expectation: string
          start_timeframe: string
          updated_at: string
          user_id: string
          willing_to_learn_language: boolean | null
          work_mode: string
        }
        Insert: {
          country_code: string
          created_at?: string
          excluded?: boolean
          funding_requirement?: string
          id?: string
          open_to_other?: boolean
          opportunity_types?: string[]
          rank?: number
          salary_expectation?: string
          start_timeframe?: string
          updated_at?: string
          user_id: string
          willing_to_learn_language?: boolean | null
          work_mode?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          excluded?: boolean
          funding_requirement?: string
          id?: string
          open_to_other?: boolean
          opportunity_types?: string[]
          rank?: number
          salary_expectation?: string
          start_timeframe?: string
          updated_at?: string
          user_id?: string
          willing_to_learn_language?: boolean | null
          work_mode?: string
        }
        Relationships: []
      }
      country_regions: {
        Row: {
          code: string | null
          country_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code?: string | null
          country_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string | null
          country_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      country_rules: {
        Row: {
          age_requirement: Json
          applicant_origin_condition: Json
          country_id: string
          created_at: string
          effective_date: string | null
          evidence_id: string | null
          experience_requirement: Json
          expiry_or_review_date: string | null
          financial_requirement: Json
          id: string
          language_requirement: Json
          last_verified_at: string | null
          licence_requirement: Json
          occupation_id: string | null
          official_source_id: string | null
          opportunity_type_id: string | null
          pathway_type: string
          qualification_level_id: string | null
          replaces_rule_id: string | null
          rule_status: string
          rule_version: number
          sponsorship_evidence_rule: Json
          updated_at: string
        }
        Insert: {
          age_requirement?: Json
          applicant_origin_condition?: Json
          country_id: string
          created_at?: string
          effective_date?: string | null
          evidence_id?: string | null
          experience_requirement?: Json
          expiry_or_review_date?: string | null
          financial_requirement?: Json
          id?: string
          language_requirement?: Json
          last_verified_at?: string | null
          licence_requirement?: Json
          occupation_id?: string | null
          official_source_id?: string | null
          opportunity_type_id?: string | null
          pathway_type: string
          qualification_level_id?: string | null
          replaces_rule_id?: string | null
          rule_status?: string
          rule_version?: number
          sponsorship_evidence_rule?: Json
          updated_at?: string
        }
        Update: {
          age_requirement?: Json
          applicant_origin_condition?: Json
          country_id?: string
          created_at?: string
          effective_date?: string | null
          evidence_id?: string | null
          experience_requirement?: Json
          expiry_or_review_date?: string | null
          financial_requirement?: Json
          id?: string
          language_requirement?: Json
          last_verified_at?: string | null
          licence_requirement?: Json
          occupation_id?: string | null
          official_source_id?: string | null
          opportunity_type_id?: string | null
          pathway_type?: string
          qualification_level_id?: string | null
          replaces_rule_id?: string | null
          rule_status?: string
          rule_version?: number
          sponsorship_evidence_rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_official_source_id_fkey"
            columns: ["official_source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_opportunity_type_id_fkey"
            columns: ["opportunity_type_id"]
            isOneToOne: false
            referencedRelation: "opportunity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_qualification_level_id_fkey"
            columns: ["qualification_level_id"]
            isOneToOne: false
            referencedRelation: "qualification_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_rules_replaces_rule_id_fkey"
            columns: ["replaces_rule_id"]
            isOneToOne: false
            referencedRelation: "country_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_parse_jobs: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          provider: string
          provider_schema_version: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          provider?: string
          provider_schema_version?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          provider?: string
          provider_schema_version?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_parse_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          failure_code: string | null
          id: string
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          failure_code?: string | null
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          failure_code?: string | null
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_metadata: {
        Row: {
          created_at: string
          document_type: string
          id: string
          mime_type: string | null
          original_filename: string | null
          readiness_status: string
          size_bytes: number | null
          storage_path: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          readiness_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          readiness_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      education_records: {
        Row: {
          academic_awards: string
          completion_date: string | null
          country: string
          created_at: string
          expected_graduation_date: string | null
          field_of_study: string
          gpa_scale: number | null
          gpa_value: number | null
          grade_classification: string
          graduation_status: string
          id: string
          institution: string
          publications: string
          qualification_level: string
          research_experience: string
          result_pending: boolean
          start_date: string | null
          transcript_available: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_awards?: string
          completion_date?: string | null
          country?: string
          created_at?: string
          expected_graduation_date?: string | null
          field_of_study?: string
          gpa_scale?: number | null
          gpa_value?: number | null
          grade_classification?: string
          graduation_status?: string
          id?: string
          institution?: string
          publications?: string
          qualification_level?: string
          research_experience?: string
          result_pending?: boolean
          start_date?: string | null
          transcript_available?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_awards?: string
          completion_date?: string | null
          country?: string
          created_at?: string
          expected_graduation_date?: string | null
          field_of_study?: string
          gpa_scale?: number | null
          gpa_value?: number | null
          grade_classification?: string
          graduation_status?: string
          id?: string
          institution?: string
          publications?: string
          qualification_level?: string
          research_experience?: string
          result_pending?: boolean
          start_date?: string | null
          transcript_available?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employment_records: {
        Row: {
          achievements: string
          country: string
          created_at: string
          currently_employed: boolean
          employer: string
          employment_type: string
          end_date: string | null
          id: string
          industry: string
          job_title: string
          management_experience: boolean | null
          occupation_category: string
          remote_international_experience: boolean | null
          responsibilities: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: string
          country?: string
          created_at?: string
          currently_employed?: boolean
          employer?: string
          employment_type?: string
          end_date?: string | null
          id?: string
          industry?: string
          job_title?: string
          management_experience?: boolean | null
          occupation_category?: string
          remote_international_experience?: boolean | null
          responsibilities?: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: string
          country?: string
          created_at?: string
          currently_employed?: boolean
          employer?: string
          employment_type?: string
          end_date?: string | null
          id?: string
          industry?: string
          job_title?: string
          management_experience?: boolean | null
          occupation_category?: string
          remote_international_experience?: boolean | null
          responsibilities?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employment_types: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      industries: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          parent_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      language_profiles: {
        Row: {
          component_scores: Json
          created_at: string
          expiry_date: string | null
          id: string
          language: string
          overall_score: number | null
          planned_test_date: string | null
          proficiency: string
          target_score: number | null
          test_date: string | null
          test_name: string
          test_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          component_scores?: Json
          created_at?: string
          expiry_date?: string | null
          id?: string
          language?: string
          overall_score?: number | null
          planned_test_date?: string | null
          proficiency?: string
          target_score?: number | null
          test_date?: string | null
          test_name?: string
          test_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          component_scores?: Json
          created_at?: string
          expiry_date?: string | null
          id?: string
          language?: string
          overall_score?: number | null
          planned_test_date?: string | null
          proficiency?: string
          target_score?: number | null
          test_date?: string | null
          test_name?: string
          test_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          telegram_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          telegram_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          telegram_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      occupation_aliases: {
        Row: {
          alias: string
          id: string
          normalized_alias: string
          occupation_id: string
        }
        Insert: {
          alias: string
          id?: string
          normalized_alias: string
          occupation_id: string
        }
        Update: {
          alias?: string
          id?: string
          normalized_alias?: string
          occupation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupation_aliases_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupation_external_codes: {
        Row: {
          classification_system: string
          country_id: string | null
          display_name: string | null
          external_code: string
          id: string
          is_active: boolean
          occupation_id: string
          source_url: string | null
        }
        Insert: {
          classification_system: string
          country_id?: string | null
          display_name?: string | null
          external_code: string
          id?: string
          is_active?: boolean
          occupation_id: string
          source_url?: string | null
        }
        Update: {
          classification_system?: string
          country_id?: string | null
          display_name?: string | null
          external_code?: string
          id?: string
          is_active?: boolean
          occupation_id?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occupation_external_codes_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupation_external_codes_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupations: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          industry_id: string | null
          is_active: boolean
          occupation_kind: string
          parent_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          industry_id?: string | null
          is_active?: boolean
          occupation_kind?: string
          parent_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          industry_id?: string | null
          is_active?: boolean
          occupation_kind?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occupations_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completion: number
          current_section: string
          draft: Json
          revision: number
          selected_goal_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completion?: number
          current_section?: string
          draft?: Json
          revision?: number
          selected_goal_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completion?: number
          current_section?: string
          draft?: Json
          revision?: number
          selected_goal_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          academic_field_id: string | null
          application_deadline: string | null
          application_open_date: string | null
          application_url: string | null
          canonical_duplicate_key: string | null
          canonical_url: string | null
          content_hash: string | null
          created_at: string
          currency_code: string | null
          description: string | null
          destination_city_id: string | null
          destination_country_id: string | null
          destination_region_id: string | null
          duration_months: number | null
          employment_type_id: string | null
          end_date: string | null
          evidence_status: string
          extraction_schema_version: string
          first_discovered_at: string
          funding_coverage: string
          id: string
          is_fixture: boolean
          is_global: boolean
          last_checked_at: string | null
          last_material_change_at: string | null
          lifecycle_status: string
          location_mode: string | null
          normalized_title: string
          occupation_id: string | null
          opportunity_subtype_id: string | null
          opportunity_type_id: string
          organization_id: string | null
          original_source_url: string | null
          position_count: number | null
          publication_status: string
          rolling_deadline: boolean
          salary_frequency: string | null
          salary_max: number | null
          salary_min: number | null
          sponsorship_status: string
          start_date: string | null
          study_level_id: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          academic_field_id?: string | null
          application_deadline?: string | null
          application_open_date?: string | null
          application_url?: string | null
          canonical_duplicate_key?: string | null
          canonical_url?: string | null
          content_hash?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          destination_city_id?: string | null
          destination_country_id?: string | null
          destination_region_id?: string | null
          duration_months?: number | null
          employment_type_id?: string | null
          end_date?: string | null
          evidence_status?: string
          extraction_schema_version?: string
          first_discovered_at?: string
          funding_coverage?: string
          id?: string
          is_fixture?: boolean
          is_global?: boolean
          last_checked_at?: string | null
          last_material_change_at?: string | null
          lifecycle_status?: string
          location_mode?: string | null
          normalized_title: string
          occupation_id?: string | null
          opportunity_subtype_id?: string | null
          opportunity_type_id: string
          organization_id?: string | null
          original_source_url?: string | null
          position_count?: number | null
          publication_status?: string
          rolling_deadline?: boolean
          salary_frequency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          sponsorship_status?: string
          start_date?: string | null
          study_level_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          academic_field_id?: string | null
          application_deadline?: string | null
          application_open_date?: string | null
          application_url?: string | null
          canonical_duplicate_key?: string | null
          canonical_url?: string | null
          content_hash?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          destination_city_id?: string | null
          destination_country_id?: string | null
          destination_region_id?: string | null
          duration_months?: number | null
          employment_type_id?: string | null
          end_date?: string | null
          evidence_status?: string
          extraction_schema_version?: string
          first_discovered_at?: string
          funding_coverage?: string
          id?: string
          is_fixture?: boolean
          is_global?: boolean
          last_checked_at?: string | null
          last_material_change_at?: string | null
          lifecycle_status?: string
          location_mode?: string | null
          normalized_title?: string
          occupation_id?: string | null
          opportunity_subtype_id?: string | null
          opportunity_type_id?: string
          organization_id?: string | null
          original_source_url?: string | null
          position_count?: number | null
          publication_status?: string
          rolling_deadline?: boolean
          salary_frequency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          sponsorship_status?: string
          start_date?: string | null
          study_level_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_academic_field_id_fkey"
            columns: ["academic_field_id"]
            isOneToOne: false
            referencedRelation: "academic_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "country_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_destination_country_id_fkey"
            columns: ["destination_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_destination_region_id_fkey"
            columns: ["destination_region_id"]
            isOneToOne: false
            referencedRelation: "country_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_employment_type_id_fkey"
            columns: ["employment_type_id"]
            isOneToOne: false
            referencedRelation: "employment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_occupation_id_fkey"
            columns: ["occupation_id"]
            isOneToOne: false
            referencedRelation: "occupations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_opportunity_subtype_id_fkey"
            columns: ["opportunity_subtype_id"]
            isOneToOne: false
            referencedRelation: "opportunity_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_opportunity_type_id_fkey"
            columns: ["opportunity_type_id"]
            isOneToOne: false
            referencedRelation: "opportunity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_study_level_id_fkey"
            columns: ["study_level_id"]
            isOneToOne: false
            referencedRelation: "study_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_application_steps: {
        Row: {
          application_stage: string | null
          created_at: string
          deadline_at: string | null
          description: string
          evidence_id: string | null
          external_url: string | null
          id: string
          opportunity_id: string
          required_action_or_document: string | null
          step_order: number
          title: string
        }
        Insert: {
          application_stage?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          evidence_id?: string | null
          external_url?: string | null
          id?: string
          opportunity_id: string
          required_action_or_document?: string | null
          step_order: number
          title: string
        }
        Update: {
          application_stage?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          evidence_id?: string | null
          external_url?: string | null
          id?: string
          opportunity_id?: string
          required_action_or_document?: string | null
          step_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_application_steps_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_application_steps_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_application_steps_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_benefits: {
        Row: {
          amount_max: number | null
          amount_min: number | null
          applicability_condition: Json
          benefit_type: string
          coverage_status: string
          created_at: string
          currency_code: string | null
          evidence_id: string | null
          frequency: string | null
          id: string
          opportunity_id: string
          original_wording: string
        }
        Insert: {
          amount_max?: number | null
          amount_min?: number | null
          applicability_condition?: Json
          benefit_type: string
          coverage_status?: string
          created_at?: string
          currency_code?: string | null
          evidence_id?: string | null
          frequency?: string | null
          id?: string
          opportunity_id: string
          original_wording: string
        }
        Update: {
          amount_max?: number | null
          amount_min?: number | null
          applicability_condition?: Json
          benefit_type?: string
          coverage_status?: string
          created_at?: string
          currency_code?: string | null
          evidence_id?: string | null
          frequency?: string | null
          id?: string
          opportunity_id?: string
          original_wording?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_benefits_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_benefits_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_benefits_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          applicability_condition: Json
          application_stage: string | null
          created_at: string
          deadline_at: string | null
          document_type: string
          evidence_id: string | null
          id: string
          notes: string
          opportunity_id: string
          original_wording: string
          requirement_status: string
        }
        Insert: {
          applicability_condition?: Json
          application_stage?: string | null
          created_at?: string
          deadline_at?: string | null
          document_type: string
          evidence_id?: string | null
          id?: string
          notes?: string
          opportunity_id: string
          original_wording: string
          requirement_status: string
        }
        Update: {
          applicability_condition?: Json
          application_stage?: string | null
          created_at?: string
          deadline_at?: string | null
          document_type?: string
          evidence_id?: string | null
          id?: string
          notes?: string
          opportunity_id?: string
          original_wording?: string
          requirement_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_evidence: {
        Row: {
          active: boolean
          canonical_url: string | null
          captured_excerpt: string
          content_hash: string | null
          created_at: string
          effective_or_published_at: string | null
          evidence_type: string
          evidence_version: number
          fact_path: string | null
          http_metadata: Json
          id: string
          language_code: string | null
          opportunity_id: string
          opportunity_source_id: string | null
          retrieved_at: string
          source_id: string
          source_url: string
          superseded_by_id: string | null
        }
        Insert: {
          active?: boolean
          canonical_url?: string | null
          captured_excerpt: string
          content_hash?: string | null
          created_at?: string
          effective_or_published_at?: string | null
          evidence_type: string
          evidence_version?: number
          fact_path?: string | null
          http_metadata?: Json
          id?: string
          language_code?: string | null
          opportunity_id: string
          opportunity_source_id?: string | null
          retrieved_at?: string
          source_id: string
          source_url: string
          superseded_by_id?: string | null
        }
        Update: {
          active?: boolean
          canonical_url?: string | null
          captured_excerpt?: string
          content_hash?: string | null
          created_at?: string
          effective_or_published_at?: string | null
          evidence_type?: string
          evidence_version?: number
          fact_path?: string | null
          http_metadata?: Json
          id?: string
          language_code?: string | null
          opportunity_id?: string
          opportunity_source_id?: string | null
          retrieved_at?: string
          source_id?: string
          source_url?: string
          superseded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_evidence_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_evidence_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_evidence_opportunity_source_id_fkey"
            columns: ["opportunity_source_id"]
            isOneToOne: false
            referencedRelation: "opportunity_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_evidence_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_requirements: {
        Row: {
          applicability_condition: Json
          confidence_state: string
          created_at: string
          evidence_id: string | null
          id: string
          missing_user_value_result: string
          normalized_value: Json
          operator: string
          opportunity_id: string
          original_wording: string
          requirement_category: string
          requirement_strength: string
          schema_version: string
          unit_or_scale: string | null
        }
        Insert: {
          applicability_condition?: Json
          confidence_state?: string
          created_at?: string
          evidence_id?: string | null
          id?: string
          missing_user_value_result?: string
          normalized_value: Json
          operator: string
          opportunity_id: string
          original_wording: string
          requirement_category: string
          requirement_strength?: string
          schema_version?: string
          unit_or_scale?: string | null
        }
        Update: {
          applicability_condition?: Json
          confidence_state?: string
          created_at?: string
          evidence_id?: string | null
          id?: string
          missing_user_value_result?: string
          normalized_value?: Json
          operator?: string
          opportunity_id?: string
          original_wording?: string
          requirement_category?: string
          requirement_strength?: string
          schema_version?: string
          unit_or_scale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_requirements_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "opportunity_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_sources: {
        Row: {
          active: boolean
          canonical_url: string | null
          created_at: string
          external_source_id: string | null
          first_seen_at: string
          id: string
          is_primary: boolean
          last_seen_at: string
          opportunity_id: string
          relationship_type: string
          source_id: string
          source_priority: number
          source_url: string
        }
        Insert: {
          active?: boolean
          canonical_url?: string | null
          created_at?: string
          external_source_id?: string | null
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          last_seen_at?: string
          opportunity_id: string
          relationship_type?: string
          source_id: string
          source_priority?: number
          source_url: string
        }
        Update: {
          active?: boolean
          canonical_url?: string | null
          created_at?: string
          external_source_id?: string | null
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          last_seen_at?: string
          opportunity_id?: string
          relationship_type?: string
          source_id?: string
          source_priority?: number
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_sources_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_sources_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_subtypes: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          opportunity_type_id: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          opportunity_type_id: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          opportunity_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_subtypes_opportunity_type_id_fkey"
            columns: ["opportunity_type_id"]
            isOneToOne: false
            referencedRelation: "opportunity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_types: {
        Row: {
          code: string
          created_at: string
          description: string
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      opportunity_versions: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          opportunity_id: string
          reason: string
          schema_version: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          opportunity_id: string
          reason: string
          schema_version?: string
          snapshot: Json
          version_number: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          opportunity_id?: string
          reason?: string
          schema_version?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_versions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_versions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          alternate_names: string[]
          country_id: string | null
          created_at: string
          external_identifiers: Json
          id: string
          normalized_name: string
          official_domain: string | null
          official_name: string
          official_website_url: string | null
          organization_type: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          alternate_names?: string[]
          country_id?: string | null
          created_at?: string
          external_identifiers?: Json
          id?: string
          normalized_name: string
          official_domain?: string | null
          official_name: string
          official_website_url?: string | null
          organization_type: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          alternate_names?: string[]
          country_id?: string | null
          created_at?: string
          external_identifiers?: Json
          id?: string
          normalized_name?: string
          official_domain?: string | null
          official_name?: string
          official_website_url?: string | null
          organization_type?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      phase0_migration_check: {
        Row: {
          created_at: string
          id: boolean
        }
        Insert: {
          created_at?: string
          id?: boolean
        }
        Update: {
          created_at?: string
          id?: boolean
        }
        Relationships: []
      }
      profile_suggestions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          evidence: string
          field_path: string
          id: string
          job_id: string | null
          proposed_value: Json
          provider_schema_version: string
          status: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          evidence?: string
          field_path: string
          id?: string
          job_id?: string | null
          proposed_value: Json
          provider_schema_version?: string
          status?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          evidence?: string
          field_path?: string
          id?: string
          job_id?: string | null
          proposed_value?: Json
          provider_schema_version?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_suggestions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cv_parse_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_versions: {
        Row: {
          created_at: string
          id: string
          schema_version: string
          snapshot: Json
          trigger: string
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          schema_version?: string
          snapshot: Json
          trigger: string
          user_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          schema_version?: string
          snapshot?: Json
          trigger?: string
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          citizenship_country: string
          created_at: string
          current_region: string
          display_name: string
          first_name: string
          id: string
          passport_available: boolean | null
          passport_expiry: string | null
          relocation_timeline: string
          residence_country: string
          updated_at: string
          willing_to_relocate: boolean | null
        }
        Insert: {
          citizenship_country?: string
          created_at?: string
          current_region?: string
          display_name?: string
          first_name?: string
          id: string
          passport_available?: boolean | null
          passport_expiry?: string | null
          relocation_timeline?: string
          residence_country?: string
          updated_at?: string
          willing_to_relocate?: boolean | null
        }
        Update: {
          citizenship_country?: string
          created_at?: string
          current_region?: string
          display_name?: string
          first_name?: string
          id?: string
          passport_available?: boolean | null
          passport_expiry?: string | null
          relocation_timeline?: string
          residence_country?: string
          updated_at?: string
          willing_to_relocate?: boolean | null
        }
        Relationships: []
      }
      qualification_levels: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          rank: number | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          rank?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          rank?: number | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
        }
        Relationships: []
      }
      source_registry: {
        Row: {
          active: boolean
          base_url: string
          canonical_domain: string
          country_id: string | null
          crawl_policy_notes: string
          created_at: string
          discovery_method: string
          id: string
          internal_notes: string
          is_allowed: boolean
          is_fixture: boolean
          is_official_source: boolean
          last_failed_check_at: string | null
          last_successful_check_at: string | null
          parser_adapter_identifier: string | null
          refresh_frequency_hours: number | null
          robots_policy_status: string
          source_name: string
          source_type: string
          terms_review_status: string
          trust_tier: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_url: string
          canonical_domain: string
          country_id?: string | null
          crawl_policy_notes?: string
          created_at?: string
          discovery_method?: string
          id?: string
          internal_notes?: string
          is_allowed?: boolean
          is_fixture?: boolean
          is_official_source?: boolean
          last_failed_check_at?: string | null
          last_successful_check_at?: string | null
          parser_adapter_identifier?: string | null
          refresh_frequency_hours?: number | null
          robots_policy_status?: string
          source_name: string
          source_type: string
          terms_review_status?: string
          trust_tier: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_url?: string
          canonical_domain?: string
          country_id?: string | null
          crawl_policy_notes?: string
          created_at?: string
          discovery_method?: string
          id?: string
          internal_notes?: string
          is_allowed?: boolean
          is_fixture?: boolean
          is_official_source?: boolean
          last_failed_check_at?: string | null
          last_successful_check_at?: string | null
          parser_adapter_identifier?: string | null
          refresh_frequency_hours?: number | null
          robots_policy_status?: string
          source_name?: string
          source_type?: string
          terms_review_status?: string
          trust_tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_registry_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_evidence: {
        Row: {
          confidence_input_metadata: Json
          country_id: string
          created_at: string
          effective_at: string | null
          evidence_scope: string
          evidence_type: string
          expires_at: string | null
          id: string
          is_conflicting: boolean
          is_superseded: boolean
          opportunity_id: string | null
          organization_id: string | null
          original_wording: string
          retrieved_at: string
          source_id: string
          superseded_by_id: string | null
          verified_at: string | null
        }
        Insert: {
          confidence_input_metadata?: Json
          country_id: string
          created_at?: string
          effective_at?: string | null
          evidence_scope: string
          evidence_type: string
          expires_at?: string | null
          id?: string
          is_conflicting?: boolean
          is_superseded?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          original_wording: string
          retrieved_at?: string
          source_id: string
          superseded_by_id?: string | null
          verified_at?: string | null
        }
        Update: {
          confidence_input_metadata?: Json
          country_id?: string
          created_at?: string
          effective_at?: string | null
          evidence_scope?: string
          evidence_type?: string
          expires_at?: string | null
          id?: string
          is_conflicting?: boolean
          is_superseded?: boolean
          opportunity_id?: string | null
          organization_id?: string | null
          original_wording?: string
          retrieved_at?: string
          source_id?: string
          superseded_by_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_evidence_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_evidence_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_evidence_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "safe_active_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_evidence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_evidence_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      study_levels: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      trade_experience: {
        Row: {
          apprenticeship_status: string
          created_at: string
          driving_licence_classes: string
          employer_or_self_employed: string
          experience_documentation: string
          id: string
          licensing_status: string
          portfolio_available: boolean | null
          practical_years: number | null
          preferred_destination: string
          tools_equipment: string
          trade_certification: string
          trade_or_occupation: string
          updated_at: string
          user_id: string
          willing_to_complete_licensing: boolean | null
        }
        Insert: {
          apprenticeship_status?: string
          created_at?: string
          driving_licence_classes?: string
          employer_or_self_employed?: string
          experience_documentation?: string
          id?: string
          licensing_status?: string
          portfolio_available?: boolean | null
          practical_years?: number | null
          preferred_destination?: string
          tools_equipment?: string
          trade_certification?: string
          trade_or_occupation?: string
          updated_at?: string
          user_id: string
          willing_to_complete_licensing?: boolean | null
        }
        Update: {
          apprenticeship_status?: string
          created_at?: string
          driving_licence_classes?: string
          employer_or_self_employed?: string
          experience_documentation?: string
          id?: string
          licensing_status?: string
          portfolio_available?: boolean | null
          practical_years?: number | null
          preferred_destination?: string
          tools_equipment?: string
          trade_certification?: string
          trade_or_occupation?: string
          updated_at?: string
          user_id?: string
          willing_to_complete_licensing?: boolean | null
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          consent_type: string
          granted: boolean
          id: string
          policy_version: string
          recorded_at: string
          required: boolean
          source: string
          user_id: string
        }
        Insert: {
          consent_type: string
          granted: boolean
          id?: string
          policy_version: string
          recorded_at?: string
          required?: boolean
          source?: string
          user_id: string
        }
        Update: {
          consent_type?: string
          granted?: boolean
          id?: string
          policy_version?: string
          recorded_at?: string
          required?: boolean
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          category: string
          created_at: string
          evidence: string
          id: string
          normalized_name: string
          proficiency: string
          skill_id: string | null
          skill_name: string
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          evidence?: string
          id?: string
          normalized_name: string
          proficiency?: string
          skill_id?: string | null
          skill_name: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          evidence?: string
          id?: string
          normalized_name?: string
          proficiency?: string
          skill_id?: string | null
          skill_name?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      safe_active_opportunities: {
        Row: {
          application_deadline: string | null
          application_open_date: string | null
          application_url: string | null
          currency_code: string | null
          destination_city_id: string | null
          destination_country: string | null
          destination_country_code: string | null
          destination_region_id: string | null
          duration_months: number | null
          end_date: string | null
          funding_coverage: string | null
          id: string | null
          is_global: boolean | null
          last_checked_at: string | null
          lifecycle_status: string | null
          location_mode: string | null
          opportunity_subtype_code: string | null
          opportunity_type: string | null
          opportunity_type_code: string | null
          organization_name: string | null
          position_count: number | null
          rolling_deadline: boolean | null
          salary_frequency: string | null
          salary_max: number | null
          salary_min: number | null
          sponsorship_status: string | null
          start_date: string | null
          summary: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "country_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_destination_region_id_fkey"
            columns: ["destination_region_id"]
            isOneToOne: false
            referencedRelation: "country_regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_account_deletion_request: {
        Args: { request_id: string }
        Returns: boolean
      }
      phase4_valid_condition: { Args: { value: Json }; Returns: boolean }
      phase4_valid_normalized_value: { Args: { value: Json }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
