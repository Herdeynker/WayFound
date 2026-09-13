-- Phase 15 forward-only correction: qualify publication-function columns that can collide
-- with RETURNS TABLE output variables under PL/pgSQL's strict ambiguity checks.

create or replace function public.phase15_publish_candidate(
  candidate_lead uuid,
  candidate_source uuid,
  candidate_type_code text,
  candidate_title text,
  candidate_normalized_title text,
  candidate_organization text,
  candidate_destination_code text,
  candidate_is_global boolean,
  candidate_summary text,
  candidate_canonical_url text,
  candidate_application_url text,
  candidate_deadline date,
  candidate_rolling boolean,
  candidate_funding text,
  candidate_sponsorship text,
  candidate_content_hash text,
  candidate_duplicate_key text,
  candidate_evidence_excerpt text,
  candidate_decision_fingerprint text
)
returns table(opportunity_id uuid, opportunity_version_id uuid, confidence_assessment_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare source_row public.source_registry%rowtype;
declare type_id uuid;
declare country_id uuid;
declare saved_organization_id uuid;
declare saved_opportunity_id uuid;
declare saved_source_id uuid;
declare saved_evidence_id uuid;
declare saved_version_id uuid;
declare saved_confidence_id uuid;
declare was_created boolean := false;
declare canonical_host text;
declare application_host text;
begin
  if candidate_content_hash !~ '^[a-f0-9]{64}$' or candidate_decision_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid candidate fingerprint'; end if;
  if candidate_canonical_url !~ '^https://' or candidate_application_url !~ '^https://' then raise exception 'Unsafe candidate URL'; end if;
  if char_length(candidate_title) not between 1 and 500 or char_length(candidate_organization) not between 1 and 500 or char_length(candidate_evidence_excerpt) not between 1 and 4000 then raise exception 'Invalid candidate bounds'; end if;
  if candidate_deadline is null and not candidate_rolling then raise exception 'Deadline treatment is required'; end if;
  if candidate_deadline is not null and candidate_deadline < current_date then raise exception 'Expired candidate cannot be published'; end if;

  select sr.* into source_row from public.source_registry sr where sr.id = candidate_source for update;
  if not found or not source_row.active or not source_row.is_allowed or not source_row.is_official_source or source_row.is_fixture or source_row.trust_tier > 3 or source_row.robots_policy_status <> 'allowed' or source_row.terms_review_status <> 'approved' then
    raise exception 'Verified official source is required';
  end if;
  canonical_host := public.phase15_url_host(candidate_canonical_url);
  application_host := public.phase15_url_host(candidate_application_url);
  if not (canonical_host = source_row.canonical_domain or canonical_host = any(source_row.allowed_domains)) then raise exception 'Canonical URL is outside verified source domains'; end if;
  if not (application_host = source_row.canonical_domain or application_host = any(source_row.allowed_domains)) then raise exception 'Application URL is outside verified source domains'; end if;

  select ot.id into type_id from public.opportunity_types ot where ot.code = candidate_type_code;
  if type_id is null then raise exception 'Unknown opportunity type'; end if;
  if candidate_destination_code is not null then
    select c.id into country_id from public.countries c where c.iso_alpha2 = candidate_destination_code and c.supported_destination;
    if country_id is null then raise exception 'Unsupported destination'; end if;
  elsif not candidate_is_global then
    raise exception 'Destination or documented global scope is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('phase15:publish:' || candidate_duplicate_key));
  insert into public.organizations(official_name, normalized_name, organization_type, country_id, official_domain, official_website_url, verification_status)
  values (candidate_organization, lower(regexp_replace(candidate_organization, '[^a-zA-Z0-9]+', ' ', 'g')), 'other', country_id, canonical_host, 'https://' || canonical_host || '/', 'verified')
  on conflict (normalized_name) do update set official_name = excluded.official_name
  returning organizations.id into saved_organization_id;

  select o.id into saved_opportunity_id from public.opportunities o
  where o.canonical_duplicate_key = candidate_duplicate_key
     or o.canonical_url = candidate_canonical_url
     or o.application_url = candidate_application_url
  order by o.created_at limit 1 for update;

  if saved_opportunity_id is null then
    insert into public.opportunities(
      opportunity_type_id, organization_id, title, normalized_title, destination_country_id,
      is_global, summary, application_deadline, rolling_deadline, application_url,
      canonical_url, original_source_url, funding_coverage, sponsorship_status,
      lifecycle_status, publication_status, evidence_status, is_fixture, last_checked_at,
      extraction_schema_version, content_hash, canonical_duplicate_key
    ) values (
      type_id, saved_organization_id, candidate_title, candidate_normalized_title, country_id,
      candidate_is_global, candidate_summary, candidate_deadline, candidate_rolling,
      candidate_application_url, candidate_canonical_url, candidate_canonical_url,
      candidate_funding, candidate_sponsorship, 'active', 'draft', 'unverified', false,
      timezone('utc', now()), 'phase15.v1', candidate_content_hash, candidate_duplicate_key
    ) returning opportunities.id into saved_opportunity_id;
    was_created := true;
  else
    update public.opportunities o set
      title = candidate_title, normalized_title = candidate_normalized_title,
      organization_id = saved_organization_id, destination_country_id = country_id,
      is_global = candidate_is_global, summary = candidate_summary,
      application_deadline = candidate_deadline, rolling_deadline = candidate_rolling,
      application_url = candidate_application_url, canonical_url = candidate_canonical_url,
      funding_coverage = candidate_funding, sponsorship_status = candidate_sponsorship,
      lifecycle_status = 'active', last_checked_at = timezone('utc', now()),
      extraction_schema_version = 'phase15.v1', content_hash = candidate_content_hash,
      canonical_duplicate_key = candidate_duplicate_key, updated_at = timezone('utc', now())
    where o.id = saved_opportunity_id;
  end if;

  insert into public.opportunity_sources(opportunity_id, source_id, source_url, canonical_url, relationship_type, source_priority, is_primary)
  values (saved_opportunity_id, candidate_source, candidate_canonical_url, candidate_canonical_url, 'primary_listing', 1, true)
  on conflict on constraint opportunity_sources_opportunity_id_source_id_source_url_key
  do update set active = true, last_seen_at = timezone('utc', now()), is_primary = true
  returning opportunity_sources.id into saved_source_id;

  select oe.id into saved_evidence_id from public.opportunity_evidence oe
  where oe.opportunity_id = saved_opportunity_id and oe.source_id = candidate_source
    and oe.content_hash = candidate_content_hash and oe.fact_path = 'opportunity.listing' and oe.active
  order by oe.created_at desc limit 1;
  if saved_evidence_id is null then
    update public.opportunity_evidence oe set active = false
      where oe.opportunity_id = saved_opportunity_id and oe.source_id = candidate_source and oe.fact_path = 'opportunity.listing' and oe.active;
    insert into public.opportunity_evidence(
      opportunity_id, opportunity_source_id, source_id, source_url, canonical_url,
      evidence_type, fact_path, captured_excerpt, content_hash, http_metadata, language_code
    ) values (
      saved_opportunity_id, saved_source_id, candidate_source, candidate_canonical_url,
      candidate_canonical_url, 'listing', 'opportunity.listing', candidate_evidence_excerpt,
      candidate_content_hash, '{}'::jsonb, 'en'
    ) returning opportunity_evidence.id into saved_evidence_id;
  end if;

  select ov.id into saved_version_id from public.opportunity_versions ov
    where ov.opportunity_id = saved_opportunity_id order by ov.version_number desc limit 1;
  if saved_version_id is null then
    insert into public.opportunity_versions(opportunity_id, version_number, reason, schema_version, content_hash, snapshot)
    select o.id, 1, 'initial_ingestion', o.extraction_schema_version, o.content_hash, to_jsonb(o)
      from public.opportunities o where o.id = saved_opportunity_id
    returning opportunity_versions.id into saved_version_id;
  end if;

  insert into public.confidence_assessments(
    opportunity_id, opportunity_version_id, assessment_type, algorithm_version, input_fingerprint,
    source_confidence, sponsorship_confidence, sponsorship_outcome, decision, staleness_state, recheck_required
  ) values (
    saved_opportunity_id, saved_version_id, 'publication', 'phase15.v1', candidate_content_hash,
    greatest(70, 100 - ((source_row.trust_tier - 1) * 12)),
    case when candidate_sponsorship in ('vacancy_evidence','visa_support') then 90 when candidate_sponsorship = 'excluded' then 100 else 40 end,
    case when candidate_sponsorship = 'vacancy_evidence' then 'explicitly_confirmed'
         when candidate_sponsorship = 'visa_support' then 'strong_vacancy_indication'
         when candidate_sponsorship = 'excluded' then 'explicitly_unavailable'
         else 'not_stated' end,
    case when candidate_sponsorship in ('vacancy_evidence','visa_support','excluded') then 'allow' else 'limited' end,
    'fresh', false
  ) on conflict do nothing
  returning confidence_assessments.id into saved_confidence_id;
  if saved_confidence_id is null then
    select ca.id into saved_confidence_id from public.confidence_assessments ca
      where ca.opportunity_id = saved_opportunity_id and ca.assessment_type = 'publication'
        and ca.algorithm_version = 'phase15.v1' and ca.input_fingerprint = candidate_content_hash;
  end if;

  update public.opportunities o set publication_status = 'published', evidence_status = 'sourced',
    lifecycle_status = case when candidate_deadline is not null and candidate_deadline <= current_date + 14 then 'closing_soon' else 'active' end,
    last_checked_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where o.id = saved_opportunity_id;

  insert into public.opportunity_deduplication_decisions(lead_id, opportunity_id, decision, match_basis, decision_fingerprint, safe_reason)
  values (candidate_lead, saved_opportunity_id, case when was_created then 'new' else 'exact_duplicate' end,
    case when was_created then 'normalized_facts' else 'canonical_duplicate_key' end,
    candidate_decision_fingerprint, case when was_created then 'validated_new_opportunity' else 'existing_opportunity_refreshed' end)
  on conflict (decision_fingerprint) do nothing;

  insert into public.opportunity_recheck_schedules(opportunity_id, source_id, cadence_hours, next_check_at)
  values (saved_opportunity_id, candidate_source, case when candidate_type_code in ('professional_job','graduate_programme','skilled_trade_work') then 6 else 24 end,
    timezone('utc', now()) + case when candidate_type_code in ('professional_job','graduate_programme','skilled_trade_work') then interval '6 hours' else interval '24 hours' end)
  on conflict on constraint opportunity_recheck_schedules_pkey
  do update set source_id = excluded.source_id, cadence_hours = excluded.cadence_hours,
    next_check_at = excluded.next_check_at, state = 'scheduled', updated_at = timezone('utc', now());

  update public.opportunity_discovery_leads l set processing_status = 'published', updated_at = timezone('utc', now()) where l.id = candidate_lead;
  return query select saved_opportunity_id, saved_version_id, saved_confidence_id, was_created;
end;
$$;

revoke execute on function public.phase15_publish_candidate(uuid, uuid, text, text, text, text, text, boolean, text, text, text, date, boolean, text, text, text, text, text, text) from public, anon, authenticated;
