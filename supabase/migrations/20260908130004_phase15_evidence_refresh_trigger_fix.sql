-- Phase 15 live-pilot repair: Phase 4 attached its generic updated_at trigger
-- to two immutable/provenance tables that do not have an updated_at column.
-- Initial evidence inserts work, but a later evidence refresh fails when the
-- prior row is deactivated. Keep timestamps in their purpose-built columns.

drop trigger if exists phase4_updated_at on public.opportunity_evidence;
drop trigger if exists phase4_updated_at on public.opportunity_versions;

comment on table public.opportunity_evidence is
  'Append-oriented source evidence. retrieved_at and created_at record provenance timing; refreshed evidence supersedes prior rows without an updated_at column.';

comment on table public.opportunity_versions is
  'Immutable material history. created_at records version time; rows have no mutable updated_at field.';
