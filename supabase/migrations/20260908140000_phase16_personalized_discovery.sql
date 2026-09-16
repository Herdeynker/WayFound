-- Phase 16: personalized discovery presentation state and governed destination media.
-- Opportunity facts remain in the Phase 4–7 safe publication/matching boundary.

create table if not exists public.destination_media (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region_name text,
  city_name text,
  asset_path text not null check (asset_path like '/images/%'),
  provider text not null check (length(trim(provider)) between 2 and 120),
  original_source_url text not null check (original_source_url like 'https://%'),
  photographer text,
  licence text not null check (length(trim(licence)) between 2 and 120),
  attribution text,
  alt_text text not null check (length(trim(alt_text)) between 5 and 240),
  focal_point text not null default 'center' check (focal_point in ('center','top','bottom','left','right')),
  width integer not null check (width > 0 and width <= 10000),
  height integer not null check (height > 0 and height <= 10000),
  verified_at timestamptz not null default now(),
  priority integer not null default 0 check (priority between -100 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, region_name, city_name, asset_path)
);

create index if not exists destination_media_lookup_idx
  on public.destination_media (country_code, is_active, priority desc);

create table if not exists public.opportunity_user_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  state text not null check (state in ('saved', 'dismissed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create index if not exists opportunity_user_states_lookup_idx
  on public.opportunity_user_states (user_id, state, updated_at desc);

create table if not exists public.user_walkthrough_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null check (version ~ '^v[0-9]+$'),
  started_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (completed_at is null or dismissed_at is null)
);

create table if not exists public.user_checklist_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dismissed_at timestamptz,
  collapsed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.destination_media enable row level security;
alter table public.opportunity_user_states enable row level security;
alter table public.user_walkthrough_state enable row level security;
alter table public.user_checklist_state enable row level security;

revoke all on table public.destination_media from anon, authenticated;
revoke all on table public.opportunity_user_states from anon;
grant select, insert, update, delete on table public.opportunity_user_states to authenticated;
revoke all on table public.user_walkthrough_state from anon;
revoke all on table public.user_checklist_state from anon;
grant select, insert, update on table public.user_walkthrough_state to authenticated;
grant select, insert, update on table public.user_checklist_state to authenticated;

drop policy if exists user_walkthrough_state_owner on public.user_walkthrough_state;
create policy user_walkthrough_state_owner on public.user_walkthrough_state
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_checklist_state_owner on public.user_checklist_state;
create policy user_checklist_state_owner on public.user_checklist_state
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists opportunity_user_states_owner on public.opportunity_user_states;
create policy opportunity_user_states_owner on public.opportunity_user_states
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.phase16_prevent_user_state_owner_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user ownership cannot change';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_walkthrough_state_owner_guard on public.user_walkthrough_state;
create trigger user_walkthrough_state_owner_guard
before update on public.user_walkthrough_state
for each row execute function public.phase16_prevent_user_state_owner_change();

drop trigger if exists opportunity_user_states_owner_guard on public.opportunity_user_states;
create trigger opportunity_user_states_owner_guard
before update on public.opportunity_user_states
for each row execute function public.phase16_prevent_user_state_owner_change();

drop trigger if exists user_checklist_state_owner_guard on public.user_checklist_state;
create trigger user_checklist_state_owner_guard
before update on public.user_checklist_state
for each row execute function public.phase16_prevent_user_state_owner_change();

insert into public.destination_media
  (country_code, city_name, asset_path, provider, original_source_url, photographer, licence, attribution, alt_text, width, height, priority)
values
  ('CN', 'Beijing', '/images/destinations/beijing-tiananmen.jpg', 'Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Tiananmen_Square_(54137046675).jpg', 'Xiquinho Silva', 'CC BY 2.0', 'Xiquinho Silva / Wikimedia Commons / CC BY 2.0', 'Tiananmen Gate in Beijing, China', 1680, 945, 10),
  ('DE', 'Berlin', '/images/destinations/berlin-brandenburg-gate.jpg', 'Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Berlin_-_0266_-_16052015_-_Brandenburger_Tor.jpg', 'Pierre-Selim Huard', 'CC BY 4.0', 'Pierre-Selim Huard / Wikimedia Commons / CC BY 4.0', 'Brandenburg Gate in Berlin, Germany', 1680, 945, 10),
  ('CA', 'Toronto', '/images/destinations/toronto-skyline.jpg', 'Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Toronto_Skyline,_Ontario_Canada.jpg', 'Peter Glyn', 'CC0', 'Peter Glyn / Wikimedia Commons / CC0', 'Toronto skyline in Ontario, Canada', 1680, 945, 10)
on conflict (country_code, region_name, city_name, asset_path) do update set updated_at = now(), is_active = true;

comment on table public.destination_media is 'Governed, licensed destination media; never opportunity evidence or employer imagery.';
comment on table public.opportunity_user_states is 'Per-user saved or dismissed state for verified opportunities without a Phase 7 match.';
comment on table public.user_walkthrough_state is 'Authoritative per-user versioned first-use walkthrough state.';
comment on table public.user_checklist_state is 'Presentation state only; checklist completion is derived from authoritative product records.';
