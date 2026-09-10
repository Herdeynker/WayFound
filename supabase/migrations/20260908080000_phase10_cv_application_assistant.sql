-- Phase 10: private CV intelligence and evidence-grounded application drafting.
-- Raw CV text and provider prompts/responses are deliberately not persisted.

alter table public.audit_events drop constraint if exists audit_events_type;
alter table public.audit_events add constraint audit_events_type check (
  event_type in (
    'account_registered', 'account_login', 'account_logout', 'account_logout_all',
    'email_verification_requested', 'password_recovery_requested', 'password_reset',
    'magic_link_requested', 'oauth_started', 'oauth_cancelled', 'consent_recorded',
    'data_export_requested', 'account_deletion_requested', 'account_deletion_cancelled',
    'application_status_changed', 'cv_analysis_completed', 'assistant_draft_generated',
    'assistant_draft_approved', 'assistant_draft_exported'
  )
);

create table public.cv_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  document_id uuid references public.document_metadata(id) on delete set null,
  document_version_id uuid references public.document_versions(id) on delete set null,
  profile_version_id uuid references public.profile_versions(id) on delete set null,
  status text not null default 'completed' check (status in ('completed','failed')),
  alignment_score smallint check (alignment_score between 0 and 100),
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  schema_version text not null default 'phase10.cv.v1' check (char_length(schema_version) between 1 and 80),
  safe_error_code text check (safe_error_code is null or char_length(safe_error_code) <= 80),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (user_id, input_fingerprint),
  unique (id, user_id)
);

create table public.cv_analysis_findings (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.cv_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  finding_kind text not null check (finding_kind in ('missing','inconsistent','weak','aligned')),
  section_name text not null check (char_length(section_name) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 1000),
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assistant_fact_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  status text not null default 'collecting' check (status in ('collecting','approved','revoked')),
  schema_version text not null default 'phase10.facts.v1' check (char_length(schema_version) between 1 and 80),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  constraint assistant_fact_sets_approval_check check (
    (status = 'approved' and approved_at is not null) or (status <> 'approved')
  )
);

create table public.assistant_source_facts (
  id uuid primary key,
  fact_set_id uuid not null references public.assistant_fact_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('passport','cv','opportunity','user_evidence')),
  label text not null check (char_length(label) between 1 and 120),
  fact_value text not null check (char_length(fact_value) between 1 and 1200),
  evidence_label text not null check (char_length(evidence_label) between 1 and 160),
  evidence_url text check (evidence_url is null or (char_length(evidence_url) <= 1000 and evidence_url ~ '^https://')),
  approved_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (fact_set_id, label, fact_value),
  unique (id, fact_set_id)
);

create table public.assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  fact_set_id uuid not null references public.assistant_fact_sets(id) on delete restrict,
  kind text not null check (kind in ('tailored_cv','cover_letter','motivation_letter','personal_statement','essay','study_plan','impact_statement','recruiter_message')),
  title text not null check (char_length(title) between 1 and 160),
  tone text not null check (tone in ('clear','confident','warm','formal','concise')),
  word_limit integer not null check (word_limit between 50 and 2000),
  status text not null default 'collecting' check (status in ('collecting','generating','draft','approved','failed')),
  current_revision_id uuid,
  approved_revision_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key),
  unique (id, user_id)
);

create table public.assistant_generation_requests (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.assistant_drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  status text not null default 'reserved' check (status in ('reserved','generating','completed','failed')),
  attempt_count smallint not null default 1 check (attempt_count between 1 and 3),
  safe_error_code text check (safe_error_code is null or char_length(safe_error_code) <= 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (user_id, idempotency_key),
  unique (id, user_id)
);

create table public.assistant_draft_revisions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.assistant_drafts(id) on delete cascade,
  generation_request_id uuid not null references public.assistant_generation_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  content text not null check (char_length(content) between 1 and 50000),
  word_count integer not null check (word_count between 1 and 2000),
  grounding_status text not null check (grounding_status in ('verified','rejected')),
  validation_result jsonb not null default '{}'::jsonb check (
    jsonb_typeof(validation_result) = 'object' and pg_column_size(validation_result) <= 16384
  ),
  provider_name text not null check (char_length(provider_name) between 1 and 80),
  model_version text not null check (char_length(model_version) between 1 and 120),
  schema_version text not null default 'phase10.draft.v1' check (char_length(schema_version) between 1 and 80),
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (draft_id, revision_number),
  unique (generation_request_id),
  unique (id, draft_id)
);

alter table public.assistant_drafts
  add constraint assistant_drafts_current_revision_fkey foreign key (current_revision_id, id)
    references public.assistant_draft_revisions(id, draft_id) on delete restrict,
  add constraint assistant_drafts_approved_revision_fkey foreign key (approved_revision_id, id)
    references public.assistant_draft_revisions(id, draft_id) on delete restrict;

create table public.assistant_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_request_id uuid not null references public.assistant_generation_requests(id) on delete restrict,
  units integer not null default 1 check (units between 1 and 10),
  estimated_cost_microunits bigint not null default 0 check (estimated_cost_microunits >= 0),
  provider_name text not null check (char_length(provider_name) between 1 and 80),
  model_version text not null check (char_length(model_version) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  unique (generation_request_id)
);

create table public.assistant_exports (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.assistant_drafts(id) on delete cascade,
  revision_id uuid not null references public.assistant_draft_revisions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  export_format text not null check (export_format in ('pdf','docx')),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default timezone('utc', now())
);

create index cv_analyses_user_created_idx on public.cv_analyses(user_id, created_at desc);
create index cv_findings_analysis_idx on public.cv_analysis_findings(analysis_id, sort_order);
create index assistant_fact_sets_user_updated_idx on public.assistant_fact_sets(user_id, updated_at desc);
create index assistant_source_facts_set_idx on public.assistant_source_facts(fact_set_id, created_at);
create index assistant_drafts_user_updated_idx on public.assistant_drafts(user_id, updated_at desc);
create index assistant_requests_user_created_idx on public.assistant_generation_requests(user_id, created_at desc);
create index assistant_revisions_draft_idx on public.assistant_draft_revisions(draft_id, revision_number desc);
create index assistant_usage_user_created_idx on public.assistant_usage_ledger(user_id, created_at desc);
create index assistant_exports_user_created_idx on public.assistant_exports(user_id, created_at desc);

create or replace function public.phase10_application_owned(candidate_application_id uuid, candidate_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.applications where id = candidate_application_id and user_id = candidate_user_id);
$$;

create or replace function public.phase10_validate_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
declare owning_application uuid; owning_user uuid; owning_opportunity uuid;
begin
  if tg_table_name = 'cv_analysis_findings' then
    select application_id, user_id into owning_application, owning_user from public.cv_analyses where id = new.analysis_id;
  elsif tg_table_name = 'assistant_source_facts' then
    select application_id, user_id into owning_application, owning_user from public.assistant_fact_sets where id = new.fact_set_id;
  elsif tg_table_name = 'assistant_generation_requests' then
    select application_id, user_id into owning_application, owning_user from public.assistant_drafts where id = new.draft_id;
  elsif tg_table_name in ('assistant_draft_revisions','assistant_exports') then
    select application_id, user_id into owning_application, owning_user from public.assistant_drafts where id = new.draft_id;
  else
    owning_application := new.application_id;
    owning_user := new.user_id;
  end if;
  if owning_user is null or owning_user <> new.user_id or not public.phase10_application_owned(owning_application, new.user_id) then
    raise exception 'phase10 owner must match the application owner';
  end if;
  if tg_table_name in ('assistant_fact_sets','assistant_drafts') then
    select opportunity_id into owning_opportunity from public.applications where id = new.application_id and user_id = new.user_id;
    if owning_opportunity is null or owning_opportunity <> new.opportunity_id then
      raise exception 'phase10 opportunity must match the owned application';
    end if;
  end if;
  return new;
end;
$$;

create trigger phase10_cv_analysis_owner before insert or update on public.cv_analyses for each row execute function public.phase10_validate_ownership();
create trigger phase10_cv_finding_owner before insert or update on public.cv_analysis_findings for each row execute function public.phase10_validate_ownership();
create trigger phase10_fact_set_owner before insert or update on public.assistant_fact_sets for each row execute function public.phase10_validate_ownership();
create trigger phase10_source_fact_owner before insert or update on public.assistant_source_facts for each row execute function public.phase10_validate_ownership();
create trigger phase10_draft_owner before insert or update on public.assistant_drafts for each row execute function public.phase10_validate_ownership();
create trigger phase10_request_owner before insert or update on public.assistant_generation_requests for each row execute function public.phase10_validate_ownership();
create trigger phase10_revision_owner before insert or update on public.assistant_draft_revisions for each row execute function public.phase10_validate_ownership();
create trigger phase10_export_owner before insert or update on public.assistant_exports for each row execute function public.phase10_validate_ownership();

create trigger phase10_fact_sets_updated_at before update on public.assistant_fact_sets for each row execute function public.phase3_set_updated_at();
create trigger phase10_drafts_updated_at before update on public.assistant_drafts for each row execute function public.phase3_set_updated_at();
create trigger phase10_requests_updated_at before update on public.assistant_generation_requests for each row execute function public.phase3_set_updated_at();

create or replace function public.phase10_reject_history_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists(select 1 from auth.users where id = old.user_id) then return old; end if;
  raise exception 'phase10 history is immutable';
end;
$$;
create trigger phase10_cv_analyses_immutable before update or delete on public.cv_analyses for each row execute function public.phase10_reject_history_mutation();
create trigger phase10_cv_findings_immutable before update or delete on public.cv_analysis_findings for each row execute function public.phase10_reject_history_mutation();
create trigger phase10_source_facts_immutable before update or delete on public.assistant_source_facts for each row execute function public.phase10_reject_history_mutation();
create trigger phase10_revisions_immutable before update or delete on public.assistant_draft_revisions for each row execute function public.phase10_reject_history_mutation();
create trigger phase10_usage_immutable before update or delete on public.assistant_usage_ledger for each row execute function public.phase10_reject_history_mutation();
create trigger phase10_exports_immutable before update or delete on public.assistant_exports for each row execute function public.phase10_reject_history_mutation();

create or replace function public.phase10_reserve_generation(candidate_draft_id uuid, request_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); result_id uuid; current_status text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 10));
  select id, status into result_id, current_status from public.assistant_generation_requests
    where user_id = current_user_id and idempotency_key = request_key for update;
  if result_id is not null then
    if current_status = 'failed' then
      update public.assistant_generation_requests
        set status = 'reserved', attempt_count = attempt_count + 1, safe_error_code = null
        where id = result_id and attempt_count < 3;
      if not found then raise exception 'retry limit reached'; end if;
      update public.assistant_drafts set status = 'generating' where id = candidate_draft_id and user_id = current_user_id;
    end if;
    return result_id;
  end if;
  if not exists (
    select 1 from public.assistant_drafts d join public.assistant_fact_sets f on f.id = d.fact_set_id
    where d.id = candidate_draft_id and d.user_id = current_user_id and f.user_id = current_user_id
      and f.status = 'approved' and not exists (
        select 1 from public.assistant_source_facts sf where sf.fact_set_id = f.id and sf.approved_at is null
      )
  ) then raise exception 'owned draft with approved source facts required'; end if;
  if (select count(*) from public.assistant_generation_requests
      where user_id = current_user_id and created_at >= date_trunc('day', timezone('utc', now()))
        and created_at < date_trunc('day', timezone('utc', now())) + interval '1 day') >= 10 then
    raise exception 'daily generation quota reached';
  end if;
  insert into public.assistant_generation_requests(draft_id, user_id, idempotency_key)
    values(candidate_draft_id, current_user_id, request_key) returning id into result_id;
  update public.assistant_drafts set status = 'generating' where id = candidate_draft_id and user_id = current_user_id;
  return result_id;
end;
$$;

create or replace function public.phase10_approve_revision(candidate_draft_id uuid, candidate_revision_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); changed integer;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  update public.assistant_drafts set approved_revision_id = candidate_revision_id, status = 'approved'
    where id = candidate_draft_id and user_id = current_user_id
      and exists(select 1 from public.assistant_draft_revisions where id = candidate_revision_id and draft_id = candidate_draft_id and user_id = current_user_id);
  get diagnostics changed = row_count;
  if changed = 0 then raise exception 'owned draft revision required'; end if;
  insert into public.audit_events(user_id, event_type, metadata)
    values(current_user_id, 'assistant_draft_approved', jsonb_build_object('draft_id', candidate_draft_id, 'revision_id', candidate_revision_id));
  return true;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array[
    'cv_analyses','cv_analysis_findings','assistant_fact_sets','assistant_source_facts',
    'assistant_drafts','assistant_generation_requests','assistant_draft_revisions',
    'assistant_usage_ledger','assistant_exports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

create policy phase10_cv_analyses_select_own on public.cv_analyses for select to authenticated using (user_id = auth.uid());
create policy phase10_cv_findings_select_own on public.cv_analysis_findings for select to authenticated using (user_id = auth.uid());
create policy phase10_fact_sets_select_own on public.assistant_fact_sets for select to authenticated using (user_id = auth.uid());
create policy phase10_source_facts_select_own on public.assistant_source_facts for select to authenticated using (user_id = auth.uid());
create policy phase10_drafts_select_own on public.assistant_drafts for select to authenticated using (user_id = auth.uid());
create policy phase10_requests_select_own on public.assistant_generation_requests for select to authenticated using (user_id = auth.uid());
create policy phase10_revisions_select_own on public.assistant_draft_revisions for select to authenticated using (user_id = auth.uid());
create policy phase10_usage_select_own on public.assistant_usage_ledger for select to authenticated using (user_id = auth.uid());
create policy phase10_exports_select_own on public.assistant_exports for select to authenticated using (user_id = auth.uid());

grant select on public.cv_analyses, public.cv_analysis_findings, public.assistant_fact_sets,
  public.assistant_source_facts, public.assistant_drafts, public.assistant_generation_requests,
  public.assistant_draft_revisions, public.assistant_usage_ledger, public.assistant_exports to authenticated;
revoke all on function public.phase10_application_owned(uuid, uuid), public.phase10_validate_ownership(), public.phase10_reject_history_mutation() from public, anon, authenticated;
revoke all on function public.phase10_reserve_generation(uuid, uuid), public.phase10_approve_revision(uuid, uuid) from public, anon;
grant execute on function public.phase10_reserve_generation(uuid, uuid), public.phase10_approve_revision(uuid, uuid) to authenticated;

comment on table public.cv_analyses is 'Private bounded CV findings; raw CV text is never stored.';
comment on table public.assistant_source_facts is 'Immutable user-approved facts required before grounded generation.';
comment on table public.assistant_draft_revisions is 'Immutable evidence-grounded application draft history.';
comment on table public.assistant_usage_ledger is 'Append-only AI usage and estimated cost ledger; no prompts or document contents.';

