create table if not exists public.phase0_migration_check (
  id boolean primary key default true check (id = true),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.phase0_migration_check enable row level security;

comment on table public.phase0_migration_check is 'Phase 0-only migration workflow sentinel; not product data.';
