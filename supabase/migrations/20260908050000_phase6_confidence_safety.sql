-- Phase 6: immutable, server-only confidence and safety assessments.
create table public.confidence_assessments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  opportunity_version_id uuid references public.opportunity_versions(id) on delete restrict,
  assessment_type text not null,
  algorithm_version text not null,
  input_fingerprint text not null,
  source_confidence smallint not null check (source_confidence between 0 and 100),
  sponsorship_confidence smallint not null check (sponsorship_confidence between 0 and 100),
  sponsorship_outcome text not null check (sponsorship_outcome in ('explicitly_confirmed','strong_vacancy_indication','possible_not_confirmed','organization_capability_only','not_stated','explicitly_unavailable','conflicting','insufficient_evidence')),
  decision text not null check (decision in ('allow','limited','more_evidence','suppress','inaccessible','expired','withdrawn','recheck')),
  staleness_state text not null check (staleness_state in ('fresh','stale','superseded','unknown')),
  recheck_required boolean not null default false,
  assessed_at timestamptz not null default timezone('utc', now()),
  unique (opportunity_id, assessment_type, algorithm_version, input_fingerprint)
);
create table public.confidence_factors (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.confidence_assessments(id) on delete cascade,
  factor_code text not null check (factor_code in ('source_trust','primary_evidence','evidence_sufficiency','freshness','domain_consistency','redirect_consistency','deadline_quality','payment_risk','contradiction','lifecycle','sponsorship_scope','retrieval_failure')),
  direction text not null check (direction in ('positive','negative','neutral','critical')),
  value smallint not null check (value between -100 and 100),
  reason text not null check (char_length(reason) between 1 and 500),
  evidence_id uuid references public.opportunity_evidence(id) on delete set null,
  source_id uuid references public.source_registry(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, factor_code, evidence_id)
);
create index confidence_assessments_opportunity_current_idx on public.confidence_assessments(opportunity_id, assessed_at desc);
create index confidence_assessments_decision_idx on public.confidence_assessments(decision, assessed_at desc);
create index confidence_factors_assessment_idx on public.confidence_factors(assessment_id);
alter table public.confidence_assessments enable row level security;
alter table public.confidence_factors enable row level security;
revoke all on public.confidence_assessments, public.confidence_factors from anon, authenticated;
create or replace function public.phase6_reject_confidence_mutation() returns trigger language plpgsql set search_path = public as $$ begin raise exception 'Confidence history is immutable'; end; $$;
create trigger confidence_assessments_immutable before update or delete on public.confidence_assessments for each row execute function public.phase6_reject_confidence_mutation();
create trigger confidence_factors_immutable before update or delete on public.confidence_factors for each row execute function public.phase6_reject_confidence_mutation();
