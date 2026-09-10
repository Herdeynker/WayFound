-- Phase 9: private document versioning and user-owned application workspaces.
-- This is deliberately forward-only: Phase 3 document_metadata remains the
-- document library parent record while versions hold immutable file history.

alter table public.document_metadata
  add column if not exists category text not null default 'other',
  add column if not exists expires_on date,
  add column if not exists current_version_id uuid;

alter table public.document_metadata
  add constraint document_metadata_category_check check (
    category in ('identity','education','employment','language','professional','trade','portfolio','application','other')
  ) not valid;
alter table public.document_metadata validate constraint document_metadata_category_check;

alter table public.audit_events drop constraint if exists audit_events_type;
alter table public.audit_events add constraint audit_events_type check (
  event_type in (
    'account_registered', 'account_login', 'account_logout', 'account_logout_all',
    'email_verification_requested', 'password_recovery_requested', 'password_reset',
    'magic_link_requested', 'oauth_started', 'oauth_cancelled', 'consent_recorded',
    'data_export_requested', 'account_deletion_requested', 'account_deletion_cancelled',
    'application_status_changed'
  )
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_metadata(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 240),
  mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  version_number integer not null check (version_number > 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, version_number),
  unique (document_id, idempotency_key),
  unique (id, user_id)
);

alter table public.document_metadata
  add constraint document_metadata_current_version_fkey foreign key (current_version_id) references public.document_versions(id) on delete set null;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  match_evaluation_id uuid references public.match_evaluations(id) on delete set null,
  status text not null default 'interested',
  official_deadline date,
  internal_deadline date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, opportunity_id),
  constraint applications_status_check check (status in ('interested','preparing','ready','submitted','assessment','interview','offer','accepted','rejected','withdrawn')),
  constraint applications_deadline_check check (internal_deadline is null or official_deadline is null or internal_deadline <= official_deadline)
);

create table public.application_checklist_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  opportunity_document_id uuid references public.opportunity_documents(id) on delete set null,
  document_type text,
  title text not null check (char_length(title) between 1 and 240),
  requirement_state text not null default 'required' check (requirement_state in ('required','optional','conditional','informational')),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  sort_order smallint not null default 0 check (sort_order between 0 and 999),
  due_at date,
  completed_at timestamptz,
  document_version_id uuid references public.document_versions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, opportunity_document_id),
  unique (id, application_id)
);

create table public.application_document_links (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  checklist_item_id uuid references public.application_checklist_items(id) on delete set null,
  linked_at timestamptz not null default timezone('utc', now()),
  unique (application_id, document_version_id, checklist_item_id)
);

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 8000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('interested','preparing','ready','submitted','assessment','interview','offer','accepted','rejected','withdrawn')),
  note text not null default '' check (char_length(note) <= 1000),
  idempotency_key uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (application_id, idempotency_key)
);

create table public.application_reminders (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_at timestamptz not null,
  message text not null check (char_length(message) between 1 and 240),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, reminder_at, message)
);

create index document_versions_user_created_idx on public.document_versions(user_id, created_at desc);
create index applications_user_updated_idx on public.applications(user_id, updated_at desc);
create index application_checklist_application_idx on public.application_checklist_items(application_id, sort_order);
create index application_notes_application_idx on public.application_notes(application_id, created_at desc);
create index application_reminders_user_pending_idx on public.application_reminders(user_id, reminder_at) where status = 'pending';

create or replace function public.phase9_document_version_owner_consistent()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.document_metadata where id = new.document_id and user_id = new.user_id) then
    raise exception 'document version owner must match document owner';
  end if;
  return new;
end;
$$;
create trigger phase9_document_versions_owner before insert or update on public.document_versions for each row execute function public.phase9_document_version_owner_consistent();

create or replace function public.phase9_current_document_version_is_consistent()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.current_version_id is not null and not exists (
    select 1 from public.document_versions
    where id = new.current_version_id and document_id = new.id and user_id = new.user_id
  ) then
    raise exception 'current document version must belong to its document owner';
  end if;
  return new;
end;
$$;
create trigger phase9_document_metadata_current_version before insert or update of current_version_id on public.document_metadata for each row execute function public.phase9_current_document_version_is_consistent();

create or replace function public.phase9_document_versions_immutable()
returns trigger language plpgsql set search_path = public as $$ begin raise exception 'document versions are immutable'; end; $$;
create trigger phase9_document_versions_immutable before update or delete on public.document_versions for each row execute function public.phase9_document_versions_immutable();

create or replace function public.phase9_owner_of_application(candidate_application_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.applications where id = candidate_application_id and user_id = auth.uid());
$$;

create or replace function public.phase9_document_version_is_owned(candidate_version_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.document_versions where id = candidate_version_id and user_id = auth.uid());
$$;

create or replace function public.phase9_application_status_transition_allowed(from_value text, to_value text)
returns boolean language sql immutable set search_path = public as $$
  select (from_value = to_value)
    or (from_value = 'interested' and to_value in ('preparing','withdrawn'))
    or (from_value = 'preparing' and to_value in ('ready','submitted','withdrawn'))
    or (from_value = 'ready' and to_value in ('preparing','submitted','withdrawn'))
    or (from_value = 'submitted' and to_value in ('assessment','rejected','withdrawn'))
    or (from_value = 'assessment' and to_value in ('interview','offer','rejected','withdrawn'))
    or (from_value = 'interview' and to_value in ('offer','rejected','withdrawn'))
    or (from_value = 'offer' and to_value in ('accepted','rejected','withdrawn'));
$$;

create or replace function public.phase9_create_application_workspace(candidate_match_id uuid, request_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); result_id uuid; candidate_opportunity_id uuid; official_due date;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select me.opportunity_id into candidate_opportunity_id from public.match_evaluations me
    where me.id = candidate_match_id and me.user_id = current_user_id;
  if candidate_opportunity_id is null or not exists (select 1 from public.safe_active_opportunities where id = candidate_opportunity_id) then
    raise exception 'safe owned match required';
  end if;
  select application_deadline into official_due from public.safe_active_opportunities where id = candidate_opportunity_id;
  insert into public.applications (user_id, opportunity_id, match_evaluation_id, official_deadline)
    values (current_user_id, candidate_opportunity_id, candidate_match_id, official_due)
    on conflict (user_id, opportunity_id) do update set updated_at = public.applications.updated_at
    returning id into result_id;
  insert into public.application_status_events (application_id, user_id, from_status, to_status, note, idempotency_key)
    select result_id, current_user_id, null, 'interested', 'Workspace created from a saved match.', request_key
    where not exists (
      select 1 from public.application_status_events
      where application_id = result_id and from_status is null and to_status = 'interested'
    )
    on conflict (application_id, idempotency_key) do nothing;
  insert into public.application_checklist_items (application_id, opportunity_document_id, document_type, title, requirement_state, explanation, sort_order, due_at)
    select result_id, od.id, od.document_type, coalesce(nullif(od.original_wording,''), od.document_type), od.requirement_status, od.notes, od.sort_order, od.deadline_at
    from public.opportunity_documents od where od.opportunity_id = candidate_opportunity_id
    on conflict (application_id, opportunity_document_id) do nothing;
  return result_id;
end;
$$;

create or replace function public.phase9_transition_application_status(candidate_application_id uuid, target_status text, optional_note text, request_key uuid)
returns text language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); previous_status text; prior_event text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select status into previous_status from public.applications where id = candidate_application_id and user_id = current_user_id for update;
  if previous_status is null then raise exception 'owned application required'; end if;
  select to_status into prior_event from public.application_status_events where application_id = candidate_application_id and idempotency_key = request_key;
  if prior_event is not null then return prior_event; end if;
  if not public.phase9_application_status_transition_allowed(previous_status, target_status) then raise exception 'invalid application status transition'; end if;
  update public.applications set status = target_status, updated_at = timezone('utc', now()) where id = candidate_application_id;
  insert into public.application_status_events (application_id, user_id, from_status, to_status, note, idempotency_key)
    values (candidate_application_id, current_user_id, previous_status, target_status, left(coalesce(optional_note,''),1000), request_key);
  insert into public.audit_events (user_id, event_type, metadata)
    values (current_user_id, 'application_status_changed', jsonb_build_object('application_id', candidate_application_id, 'from', previous_status, 'to', target_status));
  return target_status;
end;
$$;

create or replace function public.phase9_immutable_status_event()
returns trigger language plpgsql set search_path = public as $$ begin raise exception 'application status history is immutable'; end; $$;
create trigger phase9_status_events_immutable before update or delete on public.application_status_events for each row execute function public.phase9_immutable_status_event();

create trigger phase9_applications_updated_at before update on public.applications for each row execute function public.phase3_set_updated_at();
create trigger phase9_checklist_updated_at before update on public.application_checklist_items for each row execute function public.phase3_set_updated_at();
create trigger phase9_notes_updated_at before update on public.application_notes for each row execute function public.phase3_set_updated_at();
create trigger phase9_reminders_updated_at before update on public.application_reminders for each row execute function public.phase3_set_updated_at();

do $$ declare table_name text; begin
  foreach table_name in array array['document_versions','applications','application_checklist_items','application_document_links','application_notes','application_status_events','application_reminders'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

create policy document_versions_select_own on public.document_versions for select to authenticated using (user_id = auth.uid());
create policy document_versions_insert_own on public.document_versions for insert to authenticated with check (user_id = auth.uid());
create policy applications_select_own on public.applications for select to authenticated using (user_id = auth.uid());
create policy checklist_own_application on public.application_checklist_items for all to authenticated using (public.phase9_owner_of_application(application_id)) with check (public.phase9_owner_of_application(application_id) and (document_version_id is null or public.phase9_document_version_is_owned(document_version_id)));
create policy document_links_own_application on public.application_document_links for all to authenticated using (public.phase9_owner_of_application(application_id)) with check (public.phase9_owner_of_application(application_id) and public.phase9_document_version_is_owned(document_version_id));
create policy notes_own_application on public.application_notes for all to authenticated using (user_id = auth.uid() and public.phase9_owner_of_application(application_id)) with check (user_id = auth.uid() and public.phase9_owner_of_application(application_id));
create policy status_events_select_own on public.application_status_events for select to authenticated using (user_id = auth.uid() and public.phase9_owner_of_application(application_id));
create policy reminders_own_application on public.application_reminders for all to authenticated using (user_id = auth.uid() and public.phase9_owner_of_application(application_id)) with check (user_id = auth.uid() and public.phase9_owner_of_application(application_id));

grant select, insert on public.document_versions to authenticated;
grant select, insert, update, delete on public.application_checklist_items, public.application_document_links, public.application_notes, public.application_reminders to authenticated;
grant select on public.applications, public.application_status_events to authenticated;
grant execute on function public.phase9_create_application_workspace(uuid, uuid), public.phase9_transition_application_status(uuid, text, text, uuid) to authenticated;

comment on table public.document_versions is 'Private append-only document file versions. Storage objects remain in the private user-documents bucket.';
comment on table public.applications is 'Private user application workspaces created only from an owned, safe match.';
comment on table public.application_status_events is 'Immutable, idempotent history written through Phase 9 transition function.';
comment on table public.application_reminders is 'Private reminder schedule only. Delivery is intentionally deferred to Phase 11.';
