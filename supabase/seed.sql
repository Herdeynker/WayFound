insert into public.phase0_migration_check (id)
values (true)
on conflict (id) do nothing;
