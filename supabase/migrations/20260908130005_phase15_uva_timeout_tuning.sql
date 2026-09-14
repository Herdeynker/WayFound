-- Phase 15 live-pilot operational tuning. The verified UvA origin regularly
-- responds beyond the original ten-second default while remaining reachable.
-- Keep the request bounded at the registry's enforced maximum.

update public.source_registry
set request_timeout_ms = 30000,
    updated_at = timezone('utc', now())
where canonical_domain = 'werkenbij.uva.nl'
  and is_official_source
  and not is_fixture;
