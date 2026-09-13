-- Preserve each registered source's configured monitoring cadence when a direct-source
-- refresh is scheduled. This is forward-only because the original Phase 15 migration
-- has already been applied to the linked development project.

create or replace function public.phase15_record_direct_source_lead(
  candidate_source uuid,
  candidate_url text,
  candidate_title text,
  candidate_fingerprint text
)
returns table(lead_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare source_row public.source_registry%rowtype;
declare candidate_domain text;
declare saved_id uuid;
declare inserted boolean;
begin
  select * into source_row
  from public.source_registry
  where id = candidate_source
  for update;

  if not found or not source_row.active or not source_row.is_allowed or source_row.is_fixture
    or source_row.robots_policy_status <> 'allowed'
    or source_row.terms_review_status <> 'approved' then
    raise exception 'Source is not eligible for direct monitoring';
  end if;

  candidate_domain := public.phase15_url_host(candidate_url);
  if candidate_url !~ '^https://' or candidate_fingerprint !~ '^[a-f0-9]{64}$'
    or char_length(candidate_title) not between 1 and 500 then
    raise exception 'Invalid direct-source lead';
  end if;
  if not (candidate_domain = source_row.canonical_domain or candidate_domain = any(source_row.allowed_domains)) then
    raise exception 'Direct-source URL is outside the registered domains';
  end if;

  insert into public.opportunity_discovery_leads(
    provider, result_url, canonical_url, result_domain, result_title,
    bounded_snippet, result_position, processing_status, idempotency_fingerprint
  ) values (
    'direct_source', candidate_url, candidate_url, candidate_domain, candidate_title,
    '', 1, 'source_verified', candidate_fingerprint
  )
  on conflict (idempotency_fingerprint) do update set
    last_discovered_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  returning id, (xmax = 0) into saved_id, inserted;

  update public.source_registry
  set last_monitor_attempt_at = timezone('utc', now()),
      next_eligible_run_at = timezone('utc', now())
        + make_interval(hours => greatest(1, least(168, coalesce(refresh_frequency_hours, 24)))),
      updated_at = timezone('utc', now())
  where id = candidate_source;

  return query select saved_id, inserted;
end;
$$;

revoke execute on function public.phase15_record_direct_source_lead(uuid, text, text, text)
  from public, anon, authenticated;
