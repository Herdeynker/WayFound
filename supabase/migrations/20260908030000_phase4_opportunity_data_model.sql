-- WAYFOUND Phase 4: normalized opportunity, provenance, country-rule and source-registry foundation.
-- This migration deliberately contains only clearly labelled non-production fixtures. It does not
-- assert current immigration, licensing, funding, or sponsorship rules for any jurisdiction.

create or replace function public.phase4_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Conditions are data, not executable code. The shape is deliberately bounded so later evaluators
-- can interpret it safely without evaluating arbitrary expressions.
create or replace function public.phase4_valid_condition(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  key_name text;
begin
  if jsonb_typeof(value) <> 'object' then return false; end if;
  for key_name in select jsonb_object_keys(value) loop
    if key_name not in ('origin_country_codes', 'study_level_codes', 'occupation_codes', 'has_dependants', 'waived_when_documented') then
      return false;
    end if;
  end loop;
  if value ? 'origin_country_codes' and jsonb_typeof(value -> 'origin_country_codes') <> 'array' then return false; end if;
  if value ? 'study_level_codes' and jsonb_typeof(value -> 'study_level_codes') <> 'array' then return false; end if;
  if value ? 'occupation_codes' and jsonb_typeof(value -> 'occupation_codes') <> 'array' then return false; end if;
  if value ? 'has_dependants' and jsonb_typeof(value -> 'has_dependants') <> 'boolean' then return false; end if;
  if value ? 'waived_when_documented' and jsonb_typeof(value -> 'waived_when_documented') <> 'boolean' then return false; end if;
  return true;
end;
$$;

-- A known fact must carry a bounded value/min/max/list/code representation. Unknown facts are
-- explicit rather than encoded as false, zero, an empty string, or a missing JSON key.
create or replace function public.phase4_valid_normalized_value(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  key_name text;
begin
  if jsonb_typeof(value) <> 'object' or not (value ? 'state') then return false; end if;
  if value ->> 'state' = 'unknown' then return value = '{"state":"unknown"}'::jsonb; end if;
  if value ->> 'state' <> 'known' then return false; end if;
  for key_name in select jsonb_object_keys(value) loop
    if key_name not in ('state', 'value', 'min', 'max', 'values', 'code', 'scale', 'country_codes') then return false; end if;
  end loop;
  return value ?| array['value', 'min', 'max', 'values', 'code'];
end;
$$;

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_alpha2 char(2) not null unique,
  iso_alpha3 char(3) not null unique,
  name text not null,
  default_currency_code char(3),
  timezone_identifiers text[] not null default '{}',
  supported_origin boolean not null default false,
  supported_destination boolean not null default false,
  product_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint countries_iso_alpha2_format check (iso_alpha2 ~ '^[A-Z]{2}$'),
  constraint countries_iso_alpha3_format check (iso_alpha3 ~ '^[A-Z]{3}$')
);

create table public.country_aliases (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint country_aliases_nonempty check (char_length(trim(alias)) > 0)
);

create table public.country_regions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  code text,
  name text not null,
  is_active boolean not null default true,
  unique (country_id, name),
  unique (country_id, code)
);

create table public.country_cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  region_id uuid references public.country_regions (id) on delete set null,
  name text not null,
  is_active boolean not null default true,
  unique (country_id, region_id, name)
);

create table public.country_modules (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null unique references public.countries (id) on delete cascade,
  module_code text not null unique,
  supported_pathways text[] not null default '{}',
  recognized_evidence_categories text[] not null default '{}',
  terminology jsonb not null default '{}'::jsonb,
  external_classification_references jsonb not null default '{}'::jsonb,
  rule_loader_contract text not null,
  completeness_status text not null default 'framework_only',
  production_active boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint country_modules_terminology_object check (jsonb_typeof(terminology) = 'object'),
  constraint country_modules_external_refs_object check (jsonb_typeof(external_classification_references) = 'object'),
  constraint country_modules_completeness check (completeness_status in ('framework_only', 'partial', 'verified'))
);

create table public.opportunity_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_types_code check (code in ('scholarship', 'fellowship', 'graduate_programme', 'research_position', 'internship', 'professional_job', 'skilled_trade_work'))
);

create table public.opportunity_subtypes (
  id uuid primary key default gen_random_uuid(),
  opportunity_type_id uuid not null references public.opportunity_types (id) on delete restrict,
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.qualification_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  rank smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.study_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.employment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.industries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  parent_id uuid references public.industries (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.academic_fields (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  parent_id uuid references public.academic_fields (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.academic_field_aliases (
  id uuid primary key default gen_random_uuid(),
  academic_field_id uuid not null references public.academic_fields (id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique
);

create table public.occupations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  occupation_kind text not null default 'occupation',
  parent_id uuid references public.occupations (id) on delete restrict,
  industry_id uuid references public.industries (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint occupations_kind check (occupation_kind in ('occupation', 'skilled_trade'))
);

create table public.occupation_aliases (
  id uuid primary key default gen_random_uuid(),
  occupation_id uuid not null references public.occupations (id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique
);

create table public.occupation_external_codes (
  id uuid primary key default gen_random_uuid(),
  occupation_id uuid not null references public.occupations (id) on delete cascade,
  country_id uuid references public.countries (id) on delete cascade,
  classification_system text not null,
  external_code text not null,
  display_name text,
  source_url text,
  is_active boolean not null default true,
  unique (occupation_id, country_id, classification_system, external_code)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  official_name text not null,
  normalized_name text not null unique,
  alternate_names text[] not null default '{}',
  organization_type text not null,
  country_id uuid references public.countries (id) on delete set null,
  official_domain text,
  official_website_url text,
  verification_status text not null default 'unverified',
  external_identifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_type check (organization_type in ('university', 'employer', 'government_body', 'scholarship_organization', 'research_institution', 'recruitment_organization', 'regulator', 'sponsor_register_authority', 'other')),
  constraint organizations_verification check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  constraint organizations_external_ids_object check (jsonb_typeof(external_identifiers) = 'object')
);

create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text not null,
  base_url text not null unique,
  canonical_domain text not null,
  country_id uuid references public.countries (id) on delete set null,
  trust_tier smallint not null,
  is_official_source boolean not null default false,
  is_allowed boolean not null default false,
  discovery_method text not null default 'manual_registry',
  refresh_frequency_hours integer,
  crawl_policy_notes text not null default '',
  robots_policy_status text not null default 'unknown',
  terms_review_status text not null default 'not_reviewed',
  parser_adapter_identifier text,
  last_successful_check_at timestamptz,
  last_failed_check_at timestamptz,
  active boolean not null default false,
  internal_notes text not null default '',
  is_fixture boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint source_registry_type check (source_type in ('official_government', 'official_university', 'official_employer', 'official_scholarship_body', 'official_sponsor_register', 'approved_job_board', 'approved_scholarship_directory', 'search_provider', 'fixture')),
  constraint source_registry_trust_tier check (trust_tier between 1 and 5),
  constraint source_registry_discovery check (discovery_method in ('manual_registry', 'official_feed', 'search_provider', 'partner_feed', 'fixture')),
  constraint source_registry_refresh check (refresh_frequency_hours is null or refresh_frequency_hours > 0),
  constraint source_registry_robots check (robots_policy_status in ('unknown', 'allowed', 'disallowed', 'review_required')),
  constraint source_registry_terms check (terms_review_status in ('not_reviewed', 'approved', 'restricted', 'blocked')),
  constraint source_registry_fixture_status check (not is_fixture or (not active and not is_allowed and not is_official_source))
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_type_id uuid not null references public.opportunity_types (id) on delete restrict,
  opportunity_subtype_id uuid references public.opportunity_subtypes (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete restrict,
  title text not null,
  normalized_title text not null,
  destination_country_id uuid references public.countries (id) on delete restrict,
  destination_region_id uuid references public.country_regions (id) on delete set null,
  destination_city_id uuid references public.country_cities (id) on delete set null,
  is_global boolean not null default false,
  location_mode text,
  summary text,
  description text,
  application_open_date date,
  application_deadline date,
  rolling_deadline boolean not null default false,
  start_date date,
  end_date date,
  duration_months integer,
  application_url text,
  canonical_url text,
  original_source_url text,
  currency_code char(3),
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_frequency text,
  funding_coverage text not null default 'not_stated',
  position_count integer,
  study_level_id uuid references public.study_levels (id) on delete set null,
  academic_field_id uuid references public.academic_fields (id) on delete set null,
  occupation_id uuid references public.occupations (id) on delete set null,
  employment_type_id uuid references public.employment_types (id) on delete set null,
  sponsorship_status text not null default 'not_stated',
  lifecycle_status text not null default 'discovered',
  publication_status text not null default 'draft',
  evidence_status text not null default 'unverified',
  is_fixture boolean not null default false,
  first_discovered_at timestamptz not null default timezone('utc', now()),
  last_checked_at timestamptz,
  last_material_change_at timestamptz,
  extraction_schema_version text not null default 'phase4.v1',
  content_hash text,
  canonical_duplicate_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint opportunities_location check (destination_country_id is not null or is_global),
  constraint opportunities_mode check (location_mode is null or location_mode in ('on_site', 'hybrid', 'remote', 'flexible')),
  constraint opportunities_dates check ((application_deadline is null or application_open_date is null or application_deadline >= application_open_date) and (end_date is null or start_date is null or end_date >= start_date)),
  constraint opportunities_duration check (duration_months is null or duration_months > 0),
  constraint opportunities_salary check ((salary_min is null or salary_min >= 0) and (salary_max is null or salary_max >= 0) and (salary_max is null or salary_min is null or salary_max >= salary_min)),
  constraint opportunities_salary_frequency check (salary_frequency is null or salary_frequency in ('hourly', 'daily', 'weekly', 'monthly', 'annual', 'one_time')),
  constraint opportunities_funding check (funding_coverage in ('full', 'partial', 'not_stated', 'not_applicable')),
  constraint opportunities_positions check (position_count is null or position_count > 0),
  constraint opportunities_sponsorship check (sponsorship_status in ('not_stated', 'possible', 'vacancy_evidence', 'visa_support', 'excluded', 'conflicting')),
  constraint opportunities_lifecycle check (lifecycle_status in ('discovered', 'active', 'closing_soon', 'expired', 'withdrawn', 'inaccessible', 'superseded', 'suppressed')),
  constraint opportunities_publication check (publication_status in ('draft', 'eligible', 'published', 'suppressed', 'fixture')),
  constraint opportunities_evidence check (evidence_status in ('unverified', 'partial', 'sourced', 'conflicting', 'fixture')),
  constraint opportunities_fixture check (not is_fixture or (publication_status = 'fixture' and evidence_status = 'fixture')),
  unique (canonical_duplicate_key)
);

create table public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  source_id uuid not null references public.source_registry (id) on delete restrict,
  source_url text not null,
  canonical_url text,
  external_source_id text,
  relationship_type text not null default 'discovery',
  source_priority smallint not null default 100,
  is_primary boolean not null default false,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_sources_relationship check (relationship_type in ('primary_listing', 'discovery', 'verification', 'sponsor_register', 'archived_copy')),
  constraint opportunity_sources_priority check (source_priority between 1 and 999),
  unique (opportunity_id, source_id, source_url)
);
create unique index opportunity_sources_one_primary_idx on public.opportunity_sources (opportunity_id) where is_primary;

create table public.opportunity_evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  opportunity_source_id uuid references public.opportunity_sources (id) on delete set null,
  source_id uuid not null references public.source_registry (id) on delete restrict,
  source_url text not null,
  canonical_url text,
  evidence_type text not null,
  fact_path text,
  captured_excerpt text not null,
  retrieved_at timestamptz not null default timezone('utc', now()),
  effective_or_published_at timestamptz,
  content_hash text,
  http_metadata jsonb not null default '{}'::jsonb,
  language_code text,
  evidence_version integer not null default 1,
  active boolean not null default true,
  superseded_by_id uuid references public.opportunity_evidence (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_evidence_type check (evidence_type in ('listing', 'requirement', 'benefit', 'document', 'application_step', 'sponsorship', 'country_rule', 'organization', 'fixture_placeholder')),
  constraint opportunity_evidence_excerpt check (char_length(captured_excerpt) between 1 and 4000),
  constraint opportunity_evidence_http_object check (jsonb_typeof(http_metadata) = 'object'),
  constraint opportunity_evidence_version check (evidence_version > 0)
);

create table public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  requirement_category text not null,
  operator text not null,
  normalized_value jsonb not null,
  unit_or_scale text,
  requirement_strength text not null default 'hard',
  missing_user_value_result text not null default 'unknown',
  original_wording text not null,
  evidence_id uuid references public.opportunity_evidence (id) on delete set null,
  confidence_state text not null default 'extracted',
  applicability_condition jsonb not null default '{}'::jsonb,
  schema_version text not null default 'phase4.v1',
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_requirements_category check (requirement_category in ('citizenship', 'country_of_residence', 'age_minimum', 'age_maximum', 'education_level', 'degree_field', 'grade_classification', 'gpa', 'graduation_status', 'years_experience', 'occupation', 'skill', 'certification', 'professional_licence', 'trade_experience', 'language', 'ielts_overall', 'ielts_component', 'other_language_test', 'passport_availability', 'funding_need', 'work_authorization', 'destination_eligibility', 'application_document')),
  constraint opportunity_requirements_operator check (operator in ('equals', 'not_equals', 'in_list', 'not_in_list', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between', 'contains_any', 'contains_all', 'exists', 'not_required')),
  constraint opportunity_requirements_strength check (requirement_strength in ('hard', 'soft', 'informational')),
  constraint opportunity_requirements_missing check (missing_user_value_result in ('unknown', 'not_applicable')),
  constraint opportunity_requirements_confidence check (confidence_state in ('extracted', 'verified', 'uncertain', 'fixture')),
  constraint opportunity_requirements_value check (public.phase4_valid_normalized_value(normalized_value)),
  constraint opportunity_requirements_condition check (public.phase4_valid_condition(applicability_condition))
);

create table public.opportunity_benefits (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  benefit_type text not null,
  coverage_status text not null default 'not_stated',
  amount_min numeric(14,2),
  amount_max numeric(14,2),
  currency_code char(3),
  frequency text,
  original_wording text not null,
  evidence_id uuid references public.opportunity_evidence (id) on delete set null,
  applicability_condition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_benefits_type check (benefit_type in ('tuition', 'stipend', 'salary', 'housing', 'travel', 'health_insurance', 'visa_support', 'relocation_support', 'training', 'dependants_support', 'other')),
  constraint opportunity_benefits_coverage check (coverage_status in ('full', 'partial', 'not_stated', 'not_applicable')),
  constraint opportunity_benefits_amount check ((amount_min is null or amount_min >= 0) and (amount_max is null or amount_max >= 0) and (amount_max is null or amount_min is null or amount_max >= amount_min)),
  constraint opportunity_benefits_frequency check (frequency is null or frequency in ('hourly', 'daily', 'weekly', 'monthly', 'annual', 'one_time')),
  constraint opportunity_benefits_condition check (public.phase4_valid_condition(applicability_condition))
);

create table public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  document_type text not null,
  requirement_status text not null,
  application_stage text,
  deadline_at timestamptz,
  original_wording text not null,
  evidence_id uuid references public.opportunity_evidence (id) on delete set null,
  notes text not null default '',
  applicability_condition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_documents_type check (document_type in ('cv_resume', 'passport', 'transcript', 'degree_certificate', 'result_statement', 'reference_letter', 'recommendation_letter', 'motivation_letter', 'personal_statement', 'research_proposal', 'portfolio', 'language_result', 'professional_certificate', 'trade_certificate', 'nysc_discharge_or_exemption', 'other')),
  constraint opportunity_documents_status check (requirement_status in ('required', 'optional', 'conditional')),
  constraint opportunity_documents_condition check (public.phase4_valid_condition(applicability_condition))
);

create table public.opportunity_application_steps (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  step_order smallint not null,
  title text not null,
  description text not null default '',
  external_url text,
  required_action_or_document text,
  application_stage text,
  deadline_at timestamptz,
  evidence_id uuid references public.opportunity_evidence (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_application_steps_order check (step_order between 1 and 99),
  unique (opportunity_id, step_order)
);

create table public.sponsorship_evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  country_id uuid not null references public.countries (id) on delete restrict,
  evidence_type text not null,
  evidence_scope text not null,
  source_id uuid not null references public.source_registry (id) on delete restrict,
  original_wording text not null,
  retrieved_at timestamptz not null default timezone('utc', now()),
  verified_at timestamptz,
  effective_at timestamptz,
  expires_at timestamptz,
  confidence_input_metadata jsonb not null default '{}'::jsonb,
  is_conflicting boolean not null default false,
  is_superseded boolean not null default false,
  superseded_by_id uuid references public.sponsorship_evidence (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint sponsorship_evidence_type check (evidence_type in ('vacancy_explicit_sponsorship', 'vacancy_explicit_visa_support', 'vacancy_excludes_sponsorship', 'employer_sponsor_register', 'occupation_pathway_eligible', 'employer_relocation_support', 'scholarship_visa_documentation', 'work_authorization_required', 'not_stated', 'conflicting')),
  constraint sponsorship_evidence_scope check (evidence_scope in ('vacancy_specific', 'organization_level', 'country_pathway')),
  constraint sponsorship_evidence_scope_target check ((evidence_scope = 'vacancy_specific' and opportunity_id is not null) or (evidence_scope = 'organization_level' and organization_id is not null) or (evidence_scope = 'country_pathway')),
  constraint sponsorship_evidence_metadata check (jsonb_typeof(confidence_input_metadata) = 'object')
);

create table public.country_rules (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete restrict,
  pathway_type text not null,
  opportunity_type_id uuid references public.opportunity_types (id) on delete restrict,
  applicant_origin_condition jsonb not null default '{}'::jsonb,
  occupation_id uuid references public.occupations (id) on delete set null,
  qualification_level_id uuid references public.qualification_levels (id) on delete set null,
  language_requirement jsonb not null default '{"state":"unknown"}'::jsonb,
  age_requirement jsonb not null default '{"state":"unknown"}'::jsonb,
  experience_requirement jsonb not null default '{"state":"unknown"}'::jsonb,
  financial_requirement jsonb not null default '{"state":"unknown"}'::jsonb,
  licence_requirement jsonb not null default '{"state":"unknown"}'::jsonb,
  sponsorship_evidence_rule jsonb not null default '{"state":"unknown"}'::jsonb,
  rule_status text not null default 'fixture',
  effective_date date,
  expiry_or_review_date date,
  official_source_id uuid references public.source_registry (id) on delete restrict,
  evidence_id uuid references public.opportunity_evidence (id) on delete set null,
  rule_version integer not null default 1,
  last_verified_at timestamptz,
  replaces_rule_id uuid references public.country_rules (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint country_rules_pathway check (pathway_type in ('study', 'research', 'graduate', 'internship', 'professional_work', 'skilled_trade_work')),
  constraint country_rules_status check (rule_status in ('draft', 'fixture', 'verified', 'superseded', 'inactive')),
  constraint country_rules_dates check (expiry_or_review_date is null or effective_date is null or expiry_or_review_date >= effective_date),
  constraint country_rules_version check (rule_version > 0),
  constraint country_rules_origin check (public.phase4_valid_condition(applicant_origin_condition)),
  constraint country_rules_values check (public.phase4_valid_normalized_value(language_requirement) and public.phase4_valid_normalized_value(age_requirement) and public.phase4_valid_normalized_value(experience_requirement) and public.phase4_valid_normalized_value(financial_requirement) and public.phase4_valid_normalized_value(licence_requirement) and public.phase4_valid_normalized_value(sponsorship_evidence_rule)),
  constraint country_rules_production_evidence check (rule_status <> 'verified' or official_source_id is not null)
);

create table public.opportunity_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  version_number integer not null,
  reason text not null,
  schema_version text not null default 'phase4.v1',
  content_hash text,
  snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint opportunity_versions_reason check (reason in ('initial_fixture', 'material_change', 'source_evidence_change', 'lifecycle_change', 'manual_correction')),
  constraint opportunity_versions_snapshot check (jsonb_typeof(snapshot) = 'object'),
  unique (opportunity_id, version_number)
);

create or replace function public.phase4_reject_opportunity_version_update()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'opportunity versions are immutable';
end;
$$;

create trigger opportunity_versions_immutable
before update on public.opportunity_versions
for each row execute function public.phase4_reject_opportunity_version_update();

create or replace function public.phase4_validate_publication()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.publication_status = 'published' then
    if new.is_fixture or new.opportunity_type_id is null or new.title = '' or new.organization_id is null or (new.destination_country_id is null and not new.is_global) or new.application_url is null or new.last_checked_at is null or (new.application_deadline is null and not new.rolling_deadline) or new.evidence_status not in ('sourced') then
      raise exception 'published opportunities require complete non-fixture source-backed data';
    end if;
    if not exists (
      select 1 from public.opportunity_sources os
      join public.source_registry sr on sr.id = os.source_id
      where os.opportunity_id = new.id and os.active and os.is_primary and sr.active and sr.is_allowed and not sr.is_fixture and sr.trust_tier <= 3
    ) then
      raise exception 'published opportunities require an active primary source';
    end if;
    if not exists (
      select 1 from public.opportunity_evidence oe
      join public.opportunity_sources os on os.opportunity_id = oe.opportunity_id and os.source_id = oe.source_id
      join public.source_registry sr on sr.id = os.source_id
      where oe.opportunity_id = new.id and oe.active and os.active and os.is_primary and sr.active and sr.is_allowed and not sr.is_fixture and sr.trust_tier <= 3
    ) then
      raise exception 'published opportunities require active evidence';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.phase4_capture_material_opportunity_version()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.title is distinct from new.title
    or old.organization_id is distinct from new.organization_id
    or old.application_deadline is distinct from new.application_deadline
    or old.application_url is distinct from new.application_url
    or old.lifecycle_status is distinct from new.lifecycle_status
    or old.sponsorship_status is distinct from new.sponsorship_status then
    insert into public.opportunity_versions (opportunity_id, version_number, reason, schema_version, content_hash, snapshot)
    values (new.id, coalesce((select max(version_number) + 1 from public.opportunity_versions where opportunity_id = new.id), 1), 'material_change', new.extraction_schema_version, new.content_hash, to_jsonb(new));
  end if;
  return new;
end;
$$;

create trigger opportunities_publication_guard
before insert or update on public.opportunities
for each row execute function public.phase4_validate_publication();
create trigger opportunities_material_version
after update on public.opportunities
for each row execute function public.phase4_capture_material_opportunity_version();

create index opportunities_active_destination_type_idx on public.opportunities (destination_country_id, opportunity_type_id, application_deadline) where lifecycle_status in ('active', 'closing_soon') and publication_status = 'published';
create index opportunities_organization_idx on public.opportunities (organization_id);
create index opportunities_occupation_idx on public.opportunities (occupation_id) where occupation_id is not null;
create index opportunities_lifecycle_publication_idx on public.opportunities (lifecycle_status, publication_status);
create index opportunities_last_checked_idx on public.opportunities (last_checked_at desc);
create index opportunities_duplicate_key_idx on public.opportunities (canonical_duplicate_key) where canonical_duplicate_key is not null;
create index opportunity_requirements_opportunity_idx on public.opportunity_requirements (opportunity_id, requirement_category);
create index opportunity_benefits_opportunity_idx on public.opportunity_benefits (opportunity_id);
create index opportunity_documents_opportunity_idx on public.opportunity_documents (opportunity_id);
create index opportunity_evidence_opportunity_idx on public.opportunity_evidence (opportunity_id, active);
create index opportunity_sources_source_idx on public.opportunity_sources (source_id, active);
create index sponsorship_evidence_scope_idx on public.sponsorship_evidence (opportunity_id, organization_id, evidence_scope);
create index country_rules_lookup_idx on public.country_rules (country_id, pathway_type, rule_status, effective_date desc);

-- Curated read surface: no internal notes, extraction metadata, raw evidence, fixtures, or suppressed rows.
create view public.safe_active_opportunities as
select
  o.id,
  o.title,
  ot.code as opportunity_type_code,
  ot.display_name as opportunity_type,
  osub.code as opportunity_subtype_code,
  org.official_name as organization_name,
  c.iso_alpha2 as destination_country_code,
  c.name as destination_country,
  o.destination_region_id,
  o.destination_city_id,
  o.is_global,
  o.location_mode,
  o.summary,
  o.application_open_date,
  o.application_deadline,
  o.rolling_deadline,
  o.start_date,
  o.end_date,
  o.duration_months,
  o.application_url,
  o.currency_code,
  o.salary_min,
  o.salary_max,
  o.salary_frequency,
  o.funding_coverage,
  o.position_count,
  o.sponsorship_status,
  o.lifecycle_status,
  o.last_checked_at
from public.opportunities o
join public.opportunity_types ot on ot.id = o.opportunity_type_id
left join public.opportunity_subtypes osub on osub.id = o.opportunity_subtype_id
join public.organizations org on org.id = o.organization_id
left join public.countries c on c.id = o.destination_country_id
where o.publication_status = 'published'
  and o.lifecycle_status in ('active', 'closing_soon')
  and not o.is_fixture
  and exists (
    select 1 from public.opportunity_sources os
    join public.source_registry sr on sr.id = os.source_id
    where os.opportunity_id = o.id and os.active and os.is_primary and sr.active and sr.is_allowed and not sr.is_fixture and sr.trust_tier <= 3
  )
  and exists (
    select 1 from public.opportunity_evidence oe
    join public.opportunity_sources os on os.opportunity_id = oe.opportunity_id and os.source_id = oe.source_id
    join public.source_registry sr on sr.id = os.source_id
    where oe.opportunity_id = o.id and oe.active and os.active and os.is_primary and sr.active and sr.is_allowed and not sr.is_fixture and sr.trust_tier <= 3
  );

-- System/server roles use the raw schema; client roles receive only the curated view.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'countries','country_aliases','country_regions','country_cities','country_modules',
    'opportunity_types','opportunity_subtypes','qualification_levels','study_levels','employment_types','industries',
    'academic_fields','academic_field_aliases','occupations','occupation_aliases','occupation_external_codes',
    'organizations','source_registry','opportunities','opportunity_sources','opportunity_evidence',
    'opportunity_requirements','opportunity_benefits','opportunity_documents','opportunity_application_steps',
    'sponsorship_evidence','country_rules','opportunity_versions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;
revoke all on public.safe_active_opportunities from anon, authenticated;
grant select on public.safe_active_opportunities to anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['countries','country_modules','organizations','source_registry','opportunities','opportunity_evidence','country_rules','opportunity_versions'] loop
    execute format('drop trigger if exists phase4_updated_at on public.%I', table_name);
    execute format('create trigger phase4_updated_at before update on public.%I for each row execute function public.phase4_set_updated_at()', table_name);
  end loop;
end $$;

insert into public.countries (iso_alpha2, iso_alpha3, name, default_currency_code, timezone_identifiers, supported_origin, supported_destination, product_active)
values
  ('CN','CHN','China','CNY',array['Asia/Shanghai'],false,true,true),
  ('GB','GBR','United Kingdom','GBP',array['Europe/London'],false,true,true),
  ('CA','CAN','Canada','CAD',array['America/Toronto'],false,true,true),
  ('AU','AUS','Australia','AUD',array['Australia/Sydney'],false,true,true),
  ('DE','DEU','Germany','EUR',array['Europe/Berlin'],false,true,true),
  ('IE','IRL','Ireland','EUR',array['Europe/Dublin'],false,true,true),
  ('NL','NLD','Netherlands','EUR',array['Europe/Amsterdam'],false,true,true),
  ('US','USA','United States','USD',array['America/New_York'],false,true,true),
  ('NZ','NZL','New Zealand','NZD',array['Pacific/Auckland'],false,true,true),
  ('NG','NGA','Nigeria','NGN',array['Africa/Lagos'],true,false,true)
on conflict (iso_alpha2) do update set name = excluded.name, iso_alpha3 = excluded.iso_alpha3, default_currency_code = excluded.default_currency_code, timezone_identifiers = excluded.timezone_identifiers, supported_origin = excluded.supported_origin, supported_destination = excluded.supported_destination, product_active = excluded.product_active;

insert into public.country_aliases (country_id, alias, normalized_alias)
select id, name, lower(name) from public.countries
on conflict (normalized_alias) do nothing;

insert into public.opportunity_types (code, display_name, description)
values
  ('scholarship','Scholarship','Funding for a course or academic programme.'),
  ('fellowship','Fellowship','A structured academic, research, or professional fellowship.'),
  ('graduate_programme','Graduate programme','A graduate trainee or structured early-career programme.'),
  ('research_position','Research position','A research appointment, assistantship, or position.'),
  ('internship','Internship','A time-bounded work placement.'),
  ('professional_job','Professional job','A professional employment role.'),
  ('skilled_trade_work','Skilled or trade work','A skilled, technical, or trade employment role.')
on conflict (code) do update set display_name = excluded.display_name, description = excluded.description;

insert into public.opportunity_subtypes (opportunity_type_id, code, display_name)
select ot.id, seed.code, seed.display_name
from (values
  ('scholarship','undergraduate_scholarship','Undergraduate scholarship'),
  ('scholarship','masters_scholarship','Master’s scholarship'),
  ('scholarship','doctoral_scholarship','Doctoral scholarship'),
  ('fellowship','postdoctoral_fellowship','Postdoctoral fellowship'),
  ('research_position','research_assistantship','Research assistantship'),
  ('graduate_programme','graduate_trainee_programme','Graduate trainee programme'),
  ('internship','paid_internship','Paid internship'),
  ('professional_job','employer_sponsored_professional_role','Employer-sponsored professional role'),
  ('skilled_trade_work','employer_sponsored_trade_role','Employer-sponsored trade role')
) as seed(type_code, code, display_name)
join public.opportunity_types ot on ot.code = seed.type_code
on conflict (code) do update set display_name = excluded.display_name;

insert into public.qualification_levels (code, display_name, rank) values
  ('secondary','Secondary school',1),('certificate','Certificate',2),('diploma','Diploma',3),('bachelors','Bachelor’s degree',4),('masters','Master’s degree',5),('doctorate','Doctorate',6)
on conflict (code) do update set display_name = excluded.display_name, rank = excluded.rank;
insert into public.study_levels (code, display_name) values
  ('undergraduate','Undergraduate'),('masters','Master’s'),('doctoral','Doctoral'),('postdoctoral','Postdoctoral'),('not_applicable','Not applicable')
on conflict (code) do update set display_name = excluded.display_name;
insert into public.employment_types (code, display_name) values
  ('full_time','Full time'),('part_time','Part time'),('fixed_term','Fixed term'),('internship','Internship'),('graduate_programme','Graduate programme'),('contract','Contract')
on conflict (code) do update set display_name = excluded.display_name;
insert into public.industries (code, display_name) values ('technology','Technology'),('construction','Construction'),('research','Research and academia') on conflict (code) do update set display_name = excluded.display_name;
insert into public.academic_fields (code, display_name) values ('computer_science','Computer science'),('engineering','Engineering'),('research','Research') on conflict (code) do update set display_name = excluded.display_name;
insert into public.occupations (code, display_name, occupation_kind) values ('software_engineer','Software engineer','occupation'),('electrician','Electrician','skilled_trade'),('researcher','Researcher','occupation') on conflict (code) do update set display_name = excluded.display_name;

insert into public.country_modules (country_id, module_code, supported_pathways, recognized_evidence_categories, terminology, external_classification_references, rule_loader_contract, completeness_status, production_active)
select c.id, 'phase4-' || lower(c.iso_alpha2), array['study','research','graduate','internship','professional_work','skilled_trade_work'], array['vacancy_specific','organization_level','country_pathway'], '{}'::jsonb, '{}'::jsonb, 'phase5 adapter must load dated, sourced rules; this module contains no production legal facts.', 'framework_only', false
from public.countries c where c.iso_alpha2 in ('CN','GB','CA','AU','DE','IE','NL','US','NZ')
on conflict (country_id) do update set module_code = excluded.module_code, supported_pathways = excluded.supported_pathways, recognized_evidence_categories = excluded.recognized_evidence_categories, rule_loader_contract = excluded.rule_loader_contract, completeness_status = excluded.completeness_status, production_active = false;

insert into public.source_registry (source_name, source_type, base_url, canonical_domain, country_id, trust_tier, is_official_source, is_allowed, discovery_method, crawl_policy_notes, robots_policy_status, terms_review_status, active, internal_notes, is_fixture)
select 'Fixture placeholder — ' || c.name, 'fixture', 'https://fixtures.invalid/wayfound/' || lower(c.iso_alpha2), 'fixtures.invalid', c.id, 5, false, false, 'fixture', 'Non-production schema fixture only. Not an official source or a production crawling instruction.', 'review_required', 'not_reviewed', false, 'Explicit non-production evidence placeholder.', true
from public.countries c where c.iso_alpha2 in ('CN','DE','CA','AU')
on conflict (base_url) do update set source_name = excluded.source_name, active = false, is_allowed = false, is_official_source = false, is_fixture = true;

insert into public.organizations (official_name, normalized_name, organization_type, country_id, verification_status)
select 'Fixture issuing body — ' || c.name, 'fixture-issuing-body-' || lower(c.iso_alpha2), case when c.iso_alpha2 = 'DE' then 'employer' when c.iso_alpha2 = 'CA' then 'employer' when c.iso_alpha2 = 'AU' then 'research_institution' else 'scholarship_organization' end, c.id, 'unverified'
from public.countries c where c.iso_alpha2 in ('CN','DE','CA','AU')
on conflict (normalized_name) do nothing;

do $$
declare
  china uuid := (select id from public.countries where iso_alpha2 = 'CN');
  germany uuid := (select id from public.countries where iso_alpha2 = 'DE');
  canada uuid := (select id from public.countries where iso_alpha2 = 'CA');
  australia uuid := (select id from public.countries where iso_alpha2 = 'AU');
  scholarship_type uuid := (select id from public.opportunity_types where code = 'scholarship');
  professional_type uuid := (select id from public.opportunity_types where code = 'professional_job');
  trade_type uuid := (select id from public.opportunity_types where code = 'skilled_trade_work');
  fellowship_type uuid := (select id from public.opportunity_types where code = 'fellowship');
  china_org uuid := (select id from public.organizations where normalized_name = 'fixture-issuing-body-cn');
  germany_org uuid := (select id from public.organizations where normalized_name = 'fixture-issuing-body-de');
  canada_org uuid := (select id from public.organizations where normalized_name = 'fixture-issuing-body-ca');
  australia_org uuid := (select id from public.organizations where normalized_name = 'fixture-issuing-body-au');
  china_source uuid := (select id from public.source_registry where base_url = 'https://fixtures.invalid/wayfound/cn');
  germany_source uuid := (select id from public.source_registry where base_url = 'https://fixtures.invalid/wayfound/de');
  canada_source uuid := (select id from public.source_registry where base_url = 'https://fixtures.invalid/wayfound/ca');
  australia_source uuid := (select id from public.source_registry where base_url = 'https://fixtures.invalid/wayfound/au');
  china_opp uuid;
  germany_opp uuid;
  canada_opp uuid;
  australia_opp uuid;
  ev uuid;
begin
  insert into public.opportunities (opportunity_type_id, organization_id, title, normalized_title, destination_country_id, summary, application_deadline, application_url, original_source_url, currency_code, funding_coverage, lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at, canonical_duplicate_key)
  values (scholarship_type, china_org, 'Chinese Government Scholarship-style fixture', 'chinese government scholarship style fixture', china, 'Non-production schema fixture for academic funding requirements.', current_date + 90, 'https://fixtures.invalid/wayfound/cn/apply', 'https://fixtures.invalid/wayfound/cn', 'CNY', 'full', 'discovered', 'fixture', 'fixture', true, timezone('utc', now()), 'fixture:cn:scholarship')
  on conflict (canonical_duplicate_key) do update set updated_at = excluded.updated_at returning id into china_opp;
  insert into public.opportunities (opportunity_type_id, organization_id, title, normalized_title, destination_country_id, summary, application_deadline, application_url, original_source_url, currency_code, salary_min, salary_max, salary_frequency, sponsorship_status, lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at, canonical_duplicate_key)
  values (professional_type, germany_org, 'German sponsored software-role fixture', 'german sponsored software role fixture', germany, 'Non-production schema fixture separating vacancy and employer sponsorship facts.', current_date + 60, 'https://fixtures.invalid/wayfound/de/apply', 'https://fixtures.invalid/wayfound/de', 'EUR', 50000, 70000, 'annual', 'vacancy_evidence', 'discovered', 'fixture', 'fixture', true, timezone('utc', now()), 'fixture:de:professional')
  on conflict (canonical_duplicate_key) do update set updated_at = excluded.updated_at returning id into germany_opp;
  insert into public.opportunities (opportunity_type_id, organization_id, title, normalized_title, destination_country_id, summary, application_deadline, application_url, original_source_url, currency_code, sponsorship_status, lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at, canonical_duplicate_key)
  values (trade_type, canada_org, 'Canadian skilled-work fixture', 'canadian skilled work fixture', canada, 'Non-production schema fixture for trade, certification and conditional document requirements.', current_date + 75, 'https://fixtures.invalid/wayfound/ca/apply', 'https://fixtures.invalid/wayfound/ca', 'CAD', 'not_stated', 'discovered', 'fixture', 'fixture', true, timezone('utc', now()), 'fixture:ca:skilled-trade')
  on conflict (canonical_duplicate_key) do update set updated_at = excluded.updated_at returning id into canada_opp;
  insert into public.opportunities (opportunity_type_id, organization_id, title, normalized_title, destination_country_id, summary, application_deadline, start_date, end_date, application_url, original_source_url, currency_code, funding_coverage, lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at, canonical_duplicate_key)
  values (fellowship_type, australia_org, 'Australian fellowship fixture', 'australian fellowship fixture', australia, 'Non-production schema fixture for research funding, duration and application steps.', current_date + 120, current_date + 180, current_date + 545, 'https://fixtures.invalid/wayfound/au/apply', 'https://fixtures.invalid/wayfound/au', 'AUD', 'partial', 'discovered', 'fixture', 'fixture', true, timezone('utc', now()), 'fixture:au:fellowship')
  on conflict (canonical_duplicate_key) do update set updated_at = excluded.updated_at returning id into australia_opp;

  insert into public.opportunity_sources (opportunity_id, source_id, source_url, relationship_type, source_priority, is_primary)
  values (china_opp, china_source, 'https://fixtures.invalid/wayfound/cn', 'primary_listing', 1, true), (germany_opp, germany_source, 'https://fixtures.invalid/wayfound/de', 'primary_listing', 1, true), (canada_opp, canada_source, 'https://fixtures.invalid/wayfound/ca', 'primary_listing', 1, true), (australia_opp, australia_source, 'https://fixtures.invalid/wayfound/au', 'primary_listing', 1, true)
  on conflict do nothing;
  insert into public.opportunity_evidence (opportunity_id, source_id, source_url, evidence_type, fact_path, captured_excerpt)
  values (china_opp, china_source, 'https://fixtures.invalid/wayfound/cn', 'fixture_placeholder', 'opportunity', 'Fixture placeholder only; not evidence of a live scholarship.'), (germany_opp, germany_source, 'https://fixtures.invalid/wayfound/de', 'fixture_placeholder', 'opportunity', 'Fixture placeholder only; not evidence of a live vacancy.'), (canada_opp, canada_source, 'https://fixtures.invalid/wayfound/ca', 'fixture_placeholder', 'opportunity', 'Fixture placeholder only; not evidence of a live skilled-work role.'), (australia_opp, australia_source, 'https://fixtures.invalid/wayfound/au', 'fixture_placeholder', 'opportunity', 'Fixture placeholder only; not evidence of a live fellowship.')
  on conflict do nothing;

  select id into ev from public.opportunity_evidence where opportunity_id = china_opp limit 1;
  insert into public.opportunity_requirements (opportunity_id, requirement_category, operator, normalized_value, requirement_strength, original_wording, evidence_id, confidence_state)
  values (china_opp, 'education_level', 'in_list', '{"state":"known","values":["bachelors"]}', 'hard', 'Fixture: prior degree requirement.', ev, 'fixture'), (china_opp, 'language', 'exists', '{"state":"known","code":"language_result"}', 'hard', 'Fixture: language documentation requirement.', ev, 'fixture');
  insert into public.opportunity_benefits (opportunity_id, benefit_type, coverage_status, original_wording, evidence_id) values (china_opp, 'tuition', 'full', 'Fixture: tuition coverage representation.', ev), (china_opp, 'stipend', 'not_stated', 'Fixture: stipend is intentionally not asserted.', ev);
  insert into public.opportunity_documents (opportunity_id, document_type, requirement_status, original_wording, evidence_id) values (china_opp, 'transcript', 'required', 'Fixture: transcript document requirement.', ev), (china_opp, 'language_result', 'conditional', 'Fixture: language evidence condition.', ev);

  select id into ev from public.opportunity_evidence where opportunity_id = germany_opp limit 1;
  insert into public.opportunity_requirements (opportunity_id, requirement_category, operator, normalized_value, requirement_strength, original_wording, evidence_id, confidence_state) values (germany_opp, 'occupation', 'equals', '{"state":"known","code":"software_engineer"}', 'hard', 'Fixture: software occupation.', ev, 'fixture'), (germany_opp, 'years_experience', 'greater_than_or_equal', '{"state":"known","min":3}', 'hard', 'Fixture: experience representation.', ev, 'fixture'), (germany_opp, 'language', 'exists', '{"state":"unknown"}', 'informational', 'Fixture: language details intentionally unknown.', ev, 'fixture');
  insert into public.sponsorship_evidence (opportunity_id, organization_id, country_id, evidence_type, evidence_scope, source_id, original_wording) values (germany_opp, germany_org, germany, 'vacancy_explicit_sponsorship', 'vacancy_specific', germany_source, 'Fixture: vacancy-specific sponsorship statement placeholder.'), (null, germany_org, germany, 'employer_sponsor_register', 'organization_level', germany_source, 'Fixture: employer-register status placeholder; it does not prove vacancy sponsorship.');

  select id into ev from public.opportunity_evidence where opportunity_id = canada_opp limit 1;
  insert into public.opportunity_requirements (opportunity_id, requirement_category, operator, normalized_value, requirement_strength, original_wording, evidence_id, confidence_state) values (canada_opp, 'trade_experience', 'greater_than_or_equal', '{"state":"known","min":2}', 'hard', 'Fixture: trade experience representation.', ev, 'fixture'), (canada_opp, 'professional_licence', 'exists', '{"state":"known","code":"licence"}', 'hard', 'Fixture: licence representation.', ev, 'fixture');
  insert into public.opportunity_documents (opportunity_id, document_type, requirement_status, original_wording, evidence_id, applicability_condition) values (canada_opp, 'trade_certificate', 'conditional', 'Fixture: trade certificate can be conditionally requested.', ev, '{"origin_country_codes":["NG"]}');
  insert into public.sponsorship_evidence (opportunity_id, organization_id, country_id, evidence_type, evidence_scope, source_id, original_wording) values (canada_opp, canada_org, canada, 'work_authorization_required', 'vacancy_specific', canada_source, 'Fixture: work authorization evidence is distinct from sponsorship confirmation.');

  select id into ev from public.opportunity_evidence where opportunity_id = australia_opp limit 1;
  insert into public.opportunity_requirements (opportunity_id, requirement_category, operator, normalized_value, requirement_strength, original_wording, evidence_id, confidence_state) values (australia_opp, 'education_level', 'in_list', '{"state":"known","values":["doctorate"]}', 'hard', 'Fixture: doctoral qualification representation.', ev, 'fixture'), (australia_opp, 'degree_field', 'exists', '{"state":"known","code":"research"}', 'hard', 'Fixture: research field representation.', ev, 'fixture');
  insert into public.opportunity_benefits (opportunity_id, benefit_type, coverage_status, amount_min, amount_max, currency_code, frequency, original_wording, evidence_id) values (australia_opp, 'stipend', 'partial', 1000, 1500, 'AUD', 'monthly', 'Fixture: bounded funding range.', ev);
  insert into public.opportunity_application_steps (opportunity_id, step_order, title, description, external_url, evidence_id) values (australia_opp, 1, 'Prepare application', 'Fixture application step only.', 'https://fixtures.invalid/wayfound/au/apply', ev), (australia_opp, 2, 'Submit through official channel', 'Fixture application step only; no automatic submission exists.', 'https://fixtures.invalid/wayfound/au/apply', ev);

  insert into public.opportunity_versions (opportunity_id, version_number, reason, snapshot)
  select id, 1, 'initial_fixture', jsonb_build_object('fixture', true, 'title', title, 'schema_version', 'phase4.v1') from public.opportunities where is_fixture
  on conflict (opportunity_id, version_number) do nothing;
  insert into public.country_rules (country_id, pathway_type, applicant_origin_condition, rule_status, official_source_id, rule_version)
  values (china, 'study', '{}'::jsonb, 'fixture', china_source, 1), (germany, 'professional_work', '{}'::jsonb, 'fixture', germany_source, 1), (canada, 'skilled_trade_work', '{}'::jsonb, 'fixture', canada_source, 1), (australia, 'research', '{}'::jsonb, 'fixture', australia_source, 1);
end $$;

create or replace function public.phase4_capture_related_opportunity_version()
returns trigger language plpgsql set search_path = public as $$
declare
  related_opportunity_id uuid;
  related_snapshot jsonb;
begin
  if tg_op = 'DELETE' then
    related_opportunity_id := old.opportunity_id;
    related_snapshot := to_jsonb(old);
  else
    related_opportunity_id := new.opportunity_id;
    related_snapshot := to_jsonb(new);
  end if;
  if related_opportunity_id is not null then
    insert into public.opportunity_versions (opportunity_id, version_number, reason, schema_version, snapshot)
    values (
      related_opportunity_id,
      coalesce((select max(version_number) + 1 from public.opportunity_versions where opportunity_id = related_opportunity_id), 1),
      case when tg_table_name = 'sponsorship_evidence' then 'source_evidence_change' else 'material_change' end,
      'phase4.v1',
      jsonb_build_object('related_table', tg_table_name, 'operation', tg_op, 'record', related_snapshot)
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger opportunity_requirements_material_version
after insert or update or delete on public.opportunity_requirements
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger opportunity_benefits_material_version
after insert or update or delete on public.opportunity_benefits
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger opportunity_documents_material_version
after insert or update or delete on public.opportunity_documents
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger opportunity_application_steps_material_version
after insert or update or delete on public.opportunity_application_steps
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger opportunity_sources_material_version
after insert or update or delete on public.opportunity_sources
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger opportunity_evidence_material_version
after insert or update or delete on public.opportunity_evidence
for each row execute function public.phase4_capture_related_opportunity_version();
create trigger sponsorship_evidence_material_version
after insert or update or delete on public.sponsorship_evidence
for each row execute function public.phase4_capture_related_opportunity_version();

comment on table public.source_registry is 'Internal source configuration. Client roles cannot read notes, policy state, or operational metadata.';
comment on table public.sponsorship_evidence is 'Vacancy-specific and employer-level sponsorship facts remain distinct; neither is a final confidence score.';
comment on table public.country_rules is 'Dated, versioned, source-linked country rule framework. Phase 4 fixtures are non-production and are not factual rule claims.';
comment on table public.opportunity_versions is 'Append-only material opportunity versions. Client roles have no write access.';
comment on view public.safe_active_opportunities is 'Only non-fixture published active/closing records with a primary source and active evidence. Internal provenance remains server-only.';
