-- WAYFOUND Phase 13: governed original/licensed IELTS preparation foundation.
-- Content answer keys and provider operations remain server-only. Practice bands
-- are always unofficial estimates and recordings remain in private user storage.

create table public.ielts_content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  test_type text not null,
  skill text not null,
  activity_kind text not null,
  title text not null,
  instructions text not null,
  duration_seconds integer not null,
  content jsonb not null,
  answer_key jsonb not null default '{}'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  provenance_type text not null,
  provenance_title text not null,
  provenance_author text not null,
  provenance_url text,
  licence_status text not null,
  licence_reference text,
  content_version integer not null default 1,
  status text not null default 'draft',
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ielts_content_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 100),
  constraint ielts_content_test_type_check check (test_type in ('academic', 'general', 'both')),
  constraint ielts_content_skill_check check (skill in ('reading', 'writing', 'speaking')),
  constraint ielts_content_activity_check check (activity_kind in ('diagnostic', 'practice')),
  constraint ielts_content_title_check check (char_length(title) between 3 and 160),
  constraint ielts_content_instruction_check check (char_length(instructions) between 10 and 2000),
  constraint ielts_content_duration_check check (duration_seconds between 60 and 7200),
  constraint ielts_content_payload_check check (
    jsonb_typeof(content) = 'object' and pg_column_size(content) <= 32768
    and jsonb_typeof(answer_key) = 'object' and pg_column_size(answer_key) <= 8192
    and jsonb_typeof(rubric) = 'object' and pg_column_size(rubric) <= 8192
  ),
  constraint ielts_content_provenance_check check (provenance_type in ('original', 'licensed')),
  constraint ielts_content_provenance_text_check check (
    char_length(provenance_title) between 3 and 200 and char_length(provenance_author) between 2 and 160
  ),
  constraint ielts_content_url_check check (provenance_url is null or provenance_url ~ '^https://'),
  constraint ielts_content_licence_check check (
    licence_status in ('pending', 'approved', 'rejected', 'expired')
    and (provenance_type = 'original' or nullif(trim(licence_reference), '') is not null)
  ),
  constraint ielts_content_version_check check (content_version between 1 and 1000000),
  constraint ielts_content_status_check check (status in ('draft', 'active', 'retired')),
  constraint ielts_content_activation_check check (
    (status = 'active' and licence_status = 'approved' and activated_at is not null)
    or (status <> 'active' and activated_at is null)
  ),
  constraint ielts_content_answer_scope_check check (
    (skill = 'reading' and answer_key <> '{}'::jsonb)
    or (skill <> 'reading' and answer_key = '{}'::jsonb)
  )
);

create index ielts_content_active_idx on public.ielts_content_items(test_type, skill, activity_kind, slug)
  where status = 'active' and licence_status = 'approved';

create table public.ielts_official_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  resource_url text not null unique,
  test_type text not null default 'both',
  display_order smallint not null,
  status text not null default 'active',
  checked_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ielts_resources_title_check check (char_length(title) between 3 and 160),
  constraint ielts_resources_publisher_check check (char_length(publisher) between 2 and 120),
  constraint ielts_resources_url_check check (resource_url ~ '^https://(www\.)?ielts\.org/' and char_length(resource_url) <= 1000),
  constraint ielts_resources_test_type_check check (test_type in ('academic', 'general', 'both')),
  constraint ielts_resources_order_check check (display_order between 1 and 100),
  constraint ielts_resources_status_check check (status in ('active', 'retired'))
);

create table public.ielts_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  test_type text not null,
  target_band numeric(2,1) not null,
  test_date date,
  recording_retention_days smallint not null default 30,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ielts_profiles_test_type_check check (test_type in ('academic', 'general')),
  constraint ielts_profiles_target_check check (
    target_band between 1.0 and 9.0 and mod((target_band * 10)::integer, 5) = 0
  ),
  constraint ielts_profiles_date_check check (test_date is null or test_date >= created_at::date),
  constraint ielts_profiles_retention_check check (recording_retention_days between 1 and 365)
);

create table public.ielts_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid not null references public.ielts_content_items(id) on delete restrict,
  content_version integer not null,
  attempt_kind text not null,
  skill text not null,
  status text not null default 'in_progress',
  idempotency_key uuid not null,
  duration_seconds integer not null,
  elapsed_seconds integer not null default 0,
  score_raw numeric(6,2),
  score_max numeric(6,2),
  estimated_band numeric(2,1),
  is_unofficial_estimate boolean not null default true,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ielts_attempt_kind_check check (attempt_kind in ('diagnostic', 'practice')),
  constraint ielts_attempt_skill_check check (skill in ('reading', 'writing', 'speaking')),
  constraint ielts_attempt_status_check check (status in ('in_progress', 'interrupted', 'completed', 'abandoned')),
  constraint ielts_attempt_duration_check check (duration_seconds between 60 and 7200),
  constraint ielts_attempt_elapsed_check check (elapsed_seconds between 0 and duration_seconds),
  constraint ielts_attempt_score_check check (
    (score_raw is null and score_max is null and estimated_band is null)
    or (score_raw between 0 and score_max and score_max > 0 and estimated_band between 1.0 and 9.0
      and mod((estimated_band * 10)::integer, 5) = 0)
  ),
  constraint ielts_attempt_unofficial_check check (is_unofficial_estimate),
  constraint ielts_attempt_completion_check check (
    (status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null)
  ),
  unique(user_id, idempotency_key)
);

create index ielts_attempts_user_history_idx on public.ielts_attempts(user_id, started_at desc);
create index ielts_attempts_resume_idx on public.ielts_attempts(user_id, status, updated_at desc)
  where status in ('in_progress', 'interrupted');

create table public.ielts_attempt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  response_text text not null,
  is_correct boolean,
  awarded_score numeric(6,2) not null default 0,
  maximum_score numeric(6,2) not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ielts_responses_key_check check (question_key ~ '^[a-z0-9_-]{1,80}$'),
  constraint ielts_responses_text_check check (char_length(response_text) between 1 and 12000),
  constraint ielts_responses_score_check check (
    maximum_score > 0 and awarded_score between 0 and maximum_score
  ),
  unique(attempt_id, question_key)
);

create index ielts_responses_user_idx on public.ielts_attempt_responses(user_id, created_at desc);

create table public.ielts_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  estimated_band numeric(2,1) not null,
  dimensions jsonb not null,
  strengths text[] not null default '{}',
  recommendations text[] not null default '{}',
  summary text not null,
  schema_version text not null,
  provider_name text not null,
  model_version text not null,
  input_fingerprint text not null,
  is_unofficial_estimate boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ielts_feedback_skill_check check (skill in ('writing', 'speaking')),
  constraint ielts_feedback_band_check check (
    estimated_band between 1.0 and 9.0 and mod((estimated_band * 10)::integer, 5) = 0
  ),
  constraint ielts_feedback_dimensions_check check (
    jsonb_typeof(dimensions) = 'array' and jsonb_array_length(dimensions) between 2 and 8
    and pg_column_size(dimensions) <= 8192
  ),
  constraint ielts_feedback_lists_check check (
    cardinality(strengths) between 0 and 8 and cardinality(recommendations) between 1 and 8
  ),
  constraint ielts_feedback_summary_check check (char_length(summary) between 10 and 2000),
  constraint ielts_feedback_schema_check check (schema_version = 'phase13.feedback.v1'),
  constraint ielts_feedback_provider_check check (
    char_length(provider_name) between 2 and 80 and char_length(model_version) between 2 and 120
  ),
  constraint ielts_feedback_fingerprint_check check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint ielts_feedback_unofficial_check check (is_unofficial_estimate)
);

create index ielts_feedback_user_idx on public.ielts_feedback(user_id, created_at desc);

create table public.ielts_speaking_recordings (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.document_metadata(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  transcript text not null,
  retention_expires_at timestamptz not null,
  status text not null default 'uploaded',
  created_at timestamptz not null default timezone('utc', now()),
  constraint ielts_recording_transcript_check check (char_length(transcript) between 20 and 12000),
  constraint ielts_recording_retention_check check (
    retention_expires_at > created_at and retention_expires_at <= created_at + interval '366 days'
  ),
  constraint ielts_recording_status_check check (status in ('uploaded', 'feedback_ready', 'deleted'))
);

create index ielts_recordings_user_expiry_idx on public.ielts_speaking_recordings(user_id, retention_expires_at);

create table public.ielts_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_attempt_id uuid not null unique references public.ielts_attempts(id) on delete cascade,
  plan_version text not null default 'phase13.study.v1',
  weak_areas text[] not null,
  recommendation jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ielts_study_plan_version_check check (plan_version = 'phase13.study.v1'),
  constraint ielts_study_plan_weak_check check (
    cardinality(weak_areas) between 1 and 3 and weak_areas <@ array['reading','writing','speaking']::text[]
  ),
  constraint ielts_study_plan_payload_check check (
    jsonb_typeof(recommendation) = 'object' and pg_column_size(recommendation) <= 8192
    and recommendation - array['headline','next_steps','minutes_per_day']::text[] = '{}'::jsonb
  )
);

create index ielts_study_plans_user_idx on public.ielts_study_plans(user_id, created_at desc);

create view public.safe_active_ielts_content
with (security_invoker = true)
as
select id, slug, test_type, skill, activity_kind, title, instructions,
       duration_seconds, content, rubric, provenance_type, provenance_title,
       provenance_author, provenance_url, licence_status, content_version
from public.ielts_content_items
where status = 'active' and licence_status = 'approved';

create view public.safe_active_ielts_resources
with (security_invoker = true)
as
select id, title, publisher, resource_url, test_type, display_order, checked_at
from public.ielts_official_resources
where status = 'active';

create or replace function public.phase13_validate_content_activation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'active' and new.licence_status <> 'approved' then
    raise exception 'active IELTS content requires approved provenance and licence status';
  end if;
  if new.status = 'active' and new.activated_at is null then new.activated_at := timezone('utc', now()); end if;
  if new.status <> 'active' then new.activated_at := null; end if;
  return new;
end;
$$;

create trigger ielts_content_activation_guard
before insert or update on public.ielts_content_items
for each row execute function public.phase13_validate_content_activation();

create or replace function public.phase13_validate_owned_child()
returns trigger language plpgsql set search_path = public as $$
declare attempt_owner uuid; attempt_skill text; candidate_attempt_id uuid;
begin
  candidate_attempt_id := case when tg_table_name = 'ielts_study_plans'
    then (to_jsonb(new)->>'source_attempt_id')::uuid
    else (to_jsonb(new)->>'attempt_id')::uuid end;
  select user_id, skill into attempt_owner, attempt_skill from public.ielts_attempts where id = candidate_attempt_id;
  if attempt_owner is null or attempt_owner <> new.user_id then raise exception 'IELTS attempt owner mismatch'; end if;
  if tg_table_name = 'ielts_feedback' and attempt_skill <> new.skill then
    raise exception 'IELTS feedback skill mismatch';
  end if;
  if tg_table_name = 'ielts_speaking_recordings' then
    if attempt_skill <> 'speaking' then raise exception 'recording requires a speaking attempt'; end if;
    if not exists (
      select 1 from public.document_versions v
      join public.document_metadata d on d.id = v.document_id
      where v.id = new.document_version_id and v.document_id = new.document_id
        and v.user_id = new.user_id and d.user_id = new.user_id
    ) then raise exception 'recording document owner mismatch'; end if;
  end if;
  return new;
end;
$$;

create trigger ielts_responses_owner_guard before insert or update on public.ielts_attempt_responses
for each row execute function public.phase13_validate_owned_child();
create trigger ielts_feedback_owner_guard before insert or update on public.ielts_feedback
for each row execute function public.phase13_validate_owned_child();
create trigger ielts_recordings_owner_guard before insert or update on public.ielts_speaking_recordings
for each row execute function public.phase13_validate_owned_child();
create trigger ielts_study_plans_owner_guard before insert or update on public.ielts_study_plans
for each row execute function public.phase13_validate_owned_child();

create or replace function public.phase13_immutable_history()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'IELTS history is immutable';
end;
$$;

create trigger ielts_responses_immutable before update or delete on public.ielts_attempt_responses
for each row execute function public.phase13_immutable_history();
create trigger ielts_feedback_immutable before update or delete on public.ielts_feedback
for each row execute function public.phase13_immutable_history();
create trigger ielts_study_plans_immutable before update or delete on public.ielts_study_plans
for each row execute function public.phase13_immutable_history();

create or replace function public.phase13_protect_attempt_history()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'completed' and new is distinct from old then raise exception 'completed IELTS attempt is immutable'; end if;
  if new.user_id <> old.user_id or new.content_item_id <> old.content_item_id
    or new.content_version <> old.content_version or new.attempt_kind <> old.attempt_kind
    or new.skill <> old.skill or new.idempotency_key <> old.idempotency_key
    or new.duration_seconds <> old.duration_seconds or new.started_at <> old.started_at
  then raise exception 'IELTS attempt identity is immutable'; end if;
  return new;
end;
$$;

create trigger ielts_attempt_history_guard before update on public.ielts_attempts
for each row execute function public.phase13_protect_attempt_history();

create or replace function public.phase13_start_attempt(
  candidate_content_id uuid,
  candidate_attempt_kind text,
  candidate_idempotency_key uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); content_row public.ielts_content_items; attempt_id uuid;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  select * into content_row from public.ielts_content_items
    where id = candidate_content_id and status = 'active' and licence_status = 'approved';
  if content_row.id is null then raise exception 'approved active IELTS content is required'; end if;
  if candidate_attempt_kind <> content_row.activity_kind then raise exception 'attempt type does not match content'; end if;
  if not exists (
    select 1 from public.ielts_profiles p where p.user_id = owner_id
      and (content_row.test_type = 'both' or p.test_type = content_row.test_type)
  ) then raise exception 'IELTS setup does not match this content'; end if;
  select id into attempt_id from public.ielts_attempts
    where user_id = owner_id and idempotency_key = candidate_idempotency_key;
  if attempt_id is not null then return attempt_id; end if;
  insert into public.ielts_attempts(
    user_id, content_item_id, content_version, attempt_kind, skill,
    idempotency_key, duration_seconds
  ) values(
    owner_id, content_row.id, content_row.content_version, content_row.activity_kind,
    content_row.skill, candidate_idempotency_key, content_row.duration_seconds
  ) returning id into attempt_id;
  return attempt_id;
end;
$$;

create or replace function public.phase13_set_attempt_interrupted(
  candidate_attempt_id uuid,
  candidate_elapsed_seconds integer
)
returns boolean language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  update public.ielts_attempts set
    status = 'interrupted',
    elapsed_seconds = greatest(elapsed_seconds, least(duration_seconds, candidate_elapsed_seconds)),
    updated_at = timezone('utc', now())
  where id = candidate_attempt_id and user_id = owner_id and status in ('in_progress', 'interrupted');
  return found;
end;
$$;

create or replace function public.phase13_submit_reading(
  candidate_attempt_id uuid,
  candidate_answers jsonb,
  candidate_elapsed_seconds integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := auth.uid();
  attempt_row public.ielts_attempts;
  content_row public.ielts_content_items;
  answer_entry record;
  supplied text;
  correct_count integer := 0;
  total_count integer := 0;
  band numeric(2,1);
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(candidate_answers) <> 'object'
    or jsonb_array_length(jsonb_path_query_array(candidate_answers, '$.keyvalue()')) > 40
    or pg_column_size(candidate_answers) > 8192 then raise exception 'invalid reading answers'; end if;
  select * into attempt_row from public.ielts_attempts
    where id = candidate_attempt_id and user_id = owner_id for update;
  if attempt_row.id is null or attempt_row.skill <> 'reading' then raise exception 'owned reading attempt required'; end if;
  if attempt_row.status = 'completed' then
    return jsonb_build_object('attemptId', attempt_row.id, 'score', attempt_row.score_raw,
      'maximum', attempt_row.score_max, 'estimatedBand', attempt_row.estimated_band, 'duplicate', true);
  end if;
  if attempt_row.status not in ('in_progress', 'interrupted') then raise exception 'attempt cannot be completed'; end if;
  select * into content_row from public.ielts_content_items
    where id = attempt_row.content_item_id and content_version = attempt_row.content_version;
  if content_row.id is null or content_row.status <> 'active' or content_row.licence_status <> 'approved'
    then raise exception 'approved content version is unavailable'; end if;
  for answer_entry in select key, value #>> '{}' as expected from jsonb_each(content_row.answer_key)
  loop
    total_count := total_count + 1;
    supplied := nullif(trim(candidate_answers ->> answer_entry.key), '');
    if supplied is not null and lower(supplied) = lower(answer_entry.expected) then correct_count := correct_count + 1; end if;
    insert into public.ielts_attempt_responses(
      attempt_id, user_id, question_key, response_text, is_correct, awarded_score, maximum_score
    ) values(
      attempt_row.id, owner_id, answer_entry.key, coalesce(left(supplied, 120), '[unanswered]'),
      supplied is not null and lower(supplied) = lower(answer_entry.expected),
      case when supplied is not null and lower(supplied) = lower(answer_entry.expected) then 1 else 0 end, 1
    );
  end loop;
  if total_count = 0 then raise exception 'reading answer key is empty'; end if;
  band := (round((3.0 + 6.0 * correct_count::numeric / total_count::numeric) * 2) / 2)::numeric(2,1);
  update public.ielts_attempts set
    status = 'completed', elapsed_seconds = least(duration_seconds, greatest(0, candidate_elapsed_seconds)),
    score_raw = correct_count, score_max = total_count, estimated_band = band,
    completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = attempt_row.id;
  insert into public.ielts_study_plans(user_id, source_attempt_id, weak_areas, recommendation)
  values(owner_id, attempt_row.id,
    case when correct_count::numeric / total_count < 0.75 then array['reading','writing','speaking'] else array['writing','speaking'] end,
    jsonb_build_object(
      'headline', case when correct_count::numeric / total_count < 0.5
        then 'Build reading accuracy before increasing speed.'
        when correct_count::numeric / total_count < 0.75 then 'Balance careful reading with timed practice.'
        else 'Maintain reading strength and complete writing and speaking practice.' end,
      'next_steps', case when correct_count::numeric / total_count < 0.5
        then jsonb_build_array('Review evidence words in each question.', 'Complete one short timed reading task.', 'Add writing and speaking samples.')
        when correct_count::numeric / total_count < 0.75
        then jsonb_build_array('Review incorrect answers.', 'Repeat a timed reading task.', 'Add writing and speaking samples.')
        else jsonb_build_array('Complete a writing task.', 'Complete a speaking task.', 'Review progress weekly.') end,
      'minutes_per_day', case when correct_count::numeric / total_count < 0.75 then 30 else 25 end
    )
  ) on conflict (source_attempt_id) do nothing;
  return jsonb_build_object('attemptId', attempt_row.id, 'score', correct_count,
    'maximum', total_count, 'estimatedBand', band, 'duplicate', false);
end;
$$;

create trigger ielts_profiles_updated_at before update on public.ielts_profiles
for each row execute function public.phase2_set_updated_at();
create trigger ielts_content_updated_at before update on public.ielts_content_items
for each row execute function public.phase2_set_updated_at();
create trigger ielts_resources_updated_at before update on public.ielts_official_resources
for each row execute function public.phase2_set_updated_at();

alter table public.ielts_content_items enable row level security;
alter table public.ielts_official_resources enable row level security;
alter table public.ielts_profiles enable row level security;
alter table public.ielts_attempts enable row level security;
alter table public.ielts_attempt_responses enable row level security;
alter table public.ielts_feedback enable row level security;
alter table public.ielts_speaking_recordings enable row level security;
alter table public.ielts_study_plans enable row level security;

create policy ielts_content_active_read on public.ielts_content_items for select to authenticated
using (status = 'active' and licence_status = 'approved');
create policy ielts_resources_active_read on public.ielts_official_resources for select to authenticated
using (status = 'active');
create policy ielts_profiles_select_own on public.ielts_profiles for select to authenticated using (user_id = auth.uid());
create policy ielts_profiles_insert_own on public.ielts_profiles for insert to authenticated with check (user_id = auth.uid());
create policy ielts_profiles_update_own on public.ielts_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ielts_profiles_delete_own on public.ielts_profiles for delete to authenticated using (user_id = auth.uid());
create policy ielts_attempts_select_own on public.ielts_attempts for select to authenticated using (user_id = auth.uid());
create policy ielts_responses_select_own on public.ielts_attempt_responses for select to authenticated using (user_id = auth.uid());
create policy ielts_feedback_select_own on public.ielts_feedback for select to authenticated using (user_id = auth.uid());
create policy ielts_recordings_select_own on public.ielts_speaking_recordings for select to authenticated using (user_id = auth.uid());
create policy ielts_plans_select_own on public.ielts_study_plans for select to authenticated using (user_id = auth.uid());

revoke all on public.ielts_content_items, public.ielts_official_resources, public.ielts_profiles,
  public.ielts_attempts, public.ielts_attempt_responses, public.ielts_feedback,
  public.ielts_speaking_recordings, public.ielts_study_plans from anon, authenticated;
grant select on public.ielts_content_items, public.ielts_official_resources,
  public.safe_active_ielts_content, public.safe_active_ielts_resources to authenticated;
grant select, insert, update, delete on public.ielts_profiles to authenticated;
grant select on public.ielts_attempts, public.ielts_attempt_responses, public.ielts_feedback,
  public.ielts_speaking_recordings, public.ielts_study_plans to authenticated;

revoke all on function public.phase13_validate_content_activation() from public, anon, authenticated;
revoke all on function public.phase13_validate_owned_child() from public, anon, authenticated;
revoke all on function public.phase13_immutable_history() from public, anon, authenticated;
revoke all on function public.phase13_protect_attempt_history() from public, anon, authenticated;
revoke all on function public.phase13_start_attempt(uuid,text,uuid) from public, anon;
revoke all on function public.phase13_set_attempt_interrupted(uuid,integer) from public, anon;
revoke all on function public.phase13_submit_reading(uuid,jsonb,integer) from public, anon;
grant execute on function public.phase13_start_attempt(uuid,text,uuid) to authenticated;
grant execute on function public.phase13_set_attempt_interrupted(uuid,integer) to authenticated;
grant execute on function public.phase13_submit_reading(uuid,jsonb,integer) to authenticated;

insert into public.ielts_content_items(
  slug, test_type, skill, activity_kind, title, instructions, duration_seconds,
  content, answer_key, rubric, provenance_type, provenance_title,
  provenance_author, provenance_url, licence_status, status, activated_at
) values
(
  'academic-city-shade-diagnostic', 'academic', 'reading', 'diagnostic',
  'City shade and cooler streets',
  'Read the original passage, then answer every question. The timer continues if you leave and resume.',
  720,
  '{"passage":"On a warm afternoon, two neighbouring streets can feel surprisingly different. A road lined with mature trees often stays cooler because leaves block some solar radiation and release water vapour. Researchers studying urban heat stress also note that shade is most useful when it reaches pavements and building walls during the hottest hours. Yet tree planting is not a complete solution. Young trees need years of care, roots need adequate soil, and some species struggle during drought. Cities therefore combine planting with pale roof materials, shaded public transport stops and drinking-water points. The most effective plans use local temperature measurements rather than assuming every district has the same needs. They also consult residents about walking routes, outdoor work and places where older people gather. This evidence-led approach helps limited budgets reach streets where heat exposure is greatest.","questions":[{"id":"q1","prompt":"What process, in addition to blocking sunlight, helps trees cool streets?","options":["Reflecting traffic noise","Releasing water vapour","Heating building walls"]},{"id":"q2","prompt":"Why are young trees not an immediate complete solution?","options":["They require years of care","They remove drinking-water points","They prevent local measurement"]},{"id":"q3","prompt":"Which additional measure is mentioned?","options":["Dark roof materials","Unshaded transport stops","Pale roof materials"]},{"id":"q4","prompt":"What should guide where limited budgets are used?","options":["Evidence about local heat exposure","One rule for every district","Only the age of buildings"]}]}',
  '{"q1":"Releasing water vapour","q2":"They require years of care","q3":"Pale roof materials","q4":"Evidence about local heat exposure"}',
  '{"method":"one point per correct answer","band_note":"WAYFOUND practice estimate only; not an IELTS conversion"}',
  'original', 'WAYFOUND original city-shade diagnostic', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
),
(
  'general-community-workshop-diagnostic', 'general', 'reading', 'diagnostic',
  'Community repair workshop notice',
  'Read the original community notice, then answer every question before the timer ends.',
  600,
  '{"passage":"Riverside Community Centre will hold a free repair workshop on Saturday from 10:00 to 14:00. Residents may bring one small household electrical item or one piece of clothing for assessment. Volunteer repairers will explain the fault and, where possible, help the owner complete a safe repair. Items must be clean and small enough for one person to carry. The workshop cannot accept microwave ovens, gas appliances or equipment with leaking batteries. Booking is recommended because each hourly session has twelve places. People without an online account can reserve a place by calling the centre before Thursday evening. Replacement parts are not provided, but volunteers can suggest suitable local suppliers. Children may attend with an adult and can join a supervised sewing activity.","questions":[{"id":"q1","prompt":"How many items may each resident bring?","options":["One","Two","Any number"]},{"id":"q2","prompt":"Which item is not accepted?","options":["A clean shirt","A leaking battery device","A small radio"]},{"id":"q3","prompt":"When should telephone bookings be made?","options":["Before Thursday evening","After Saturday","Only at 10:00"]},{"id":"q4","prompt":"What is available for children?","options":["An unsupervised repair bench","A supervised sewing activity","Free replacement parts"]}]}',
  '{"q1":"One","q2":"A leaking battery device","q3":"Before Thursday evening","q4":"A supervised sewing activity"}',
  '{"method":"one point per correct answer","band_note":"WAYFOUND practice estimate only; not an IELTS conversion"}',
  'original', 'WAYFOUND original community-workshop diagnostic', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
),
(
  'academic-library-trends-writing', 'academic', 'writing', 'practice',
  'Library visits and digital access',
  'Write at least 150 words describing the main trends and relevant comparisons in the original scenario.',
  1200,
  '{"prompt":"A city library recorded 42,000 in-person visits and 18,000 digital loans in 2022. In 2023, visits rose to 46,000 and digital loans to 29,000. In 2024, visits were 45,000 while digital loans reached 41,000. Summarise the main features and make relevant comparisons.","minimum_words":150}',
  '{}',
  '{"dimensions":["task_response","coherence","lexical_resource","grammar"],"scale":"1.0-9.0 in 0.5 steps","unofficial":true}',
  'original', 'WAYFOUND original library-trends writing task', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
),
(
  'general-training-request-writing', 'general', 'writing', 'practice',
  'Request a training schedule change',
  'Write at least 150 words. Explain the situation, request a change and suggest a practical alternative.',
  1200,
  '{"prompt":"You enrolled in a weekend professional course, but your work schedule has changed. Write to the course coordinator. Explain the change, request a different session and suggest a suitable alternative.","minimum_words":150}',
  '{}',
  '{"dimensions":["task_response","coherence","lexical_resource","grammar"],"scale":"1.0-9.0 in 0.5 steps","unofficial":true}',
  'original', 'WAYFOUND original schedule-change writing task', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
),
(
  'shared-learning-speaking', 'both', 'speaking', 'practice',
  'Describe a useful learning experience',
  'Record one to two minutes. Then review or enter a transcript before requesting basic feedback.',
  120,
  '{"prompt":"Describe a learning experience that helped you solve a practical problem. Say what you learned, how you used it and why the experience mattered to you.","preparation_seconds":60,"speaking_seconds":120}',
  '{}',
  '{"dimensions":["fluency","coherence","lexical_resource","grammar"],"excludes":["pronunciation without audio analysis"],"unofficial":true}',
  'original', 'WAYFOUND original useful-learning speaking task', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
),
(
  'neighbourhood-change-reading', 'both', 'reading', 'practice',
  'A neighbourhood changes its journey',
  'Complete this short original timed reading practice after your diagnostic.',
  540,
  '{"passage":"When a neighbourhood market moved two streets east, many traders worried that regular customers would not follow. The local association placed simple maps at bus stops and asked traders to update customers for three weeks before the move. On opening day, volunteers stood along the old route and directed visitors. Sales were initially lower, but by the fourth week most traders reported activity close to previous levels. The association concluded that repeated, practical directions mattered more than a single large announcement.","questions":[{"id":"q1","prompt":"What did the association place at bus stops?","options":["Maps","Tickets","Price lists"]},{"id":"q2","prompt":"When did activity recover for most traders?","options":["Opening day","The fourth week","Before the move"]},{"id":"q3","prompt":"What did the association consider most effective?","options":["One large announcement","Repeated practical directions","Lower prices"]}]}',
  '{"q1":"Maps","q2":"The fourth week","q3":"Repeated practical directions"}',
  '{"method":"one point per correct answer","band_note":"WAYFOUND practice estimate only; not an IELTS conversion"}',
  'original', 'WAYFOUND original neighbourhood-change practice', 'WAYFOUND editorial team', null,
  'approved', 'active', timezone('utc', now())
);

insert into public.ielts_official_resources(title, publisher, resource_url, test_type, display_order, checked_at)
values
  ('IELTS preparation resources', 'IELTS', 'https://ielts.org/take-a-test/preparation-resources', 'both', 10, timezone('utc', now())),
  ('Official sample test questions', 'IELTS', 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions', 'both', 20, timezone('utc', now())),
  ('IELTS Academic sample questions', 'IELTS', 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test', 'academic', 30, timezone('utc', now())),
  ('IELTS General Training sample questions', 'IELTS', 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test', 'general', 40, timezone('utc', now()));

comment on table public.ielts_content_items is 'Governed IELTS-style practice authored by WAYFOUND or covered by an approved licence. Answer keys are not exposed through the safe view.';
comment on table public.ielts_feedback is 'Immutable unofficial estimated practice feedback. It is not an official IELTS result.';
comment on table public.ielts_speaking_recordings is 'Owner-scoped links to private user-document versions with explicit retention expiry.';
