-- Phase 9 prerequisite repair: Phase 7 history must stay rewrite-proof without
-- blocking auth-user cascade deletion. Authenticated users retain SELECT-only
-- access; service-owned and account-cascade deletes remain possible.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'match_evaluations',
    'match_country_rule_versions',
    'match_requirement_results',
    'match_score_components',
    'match_readiness_items',
    'match_reasons'
  ] loop
    execute format('drop trigger if exists phase7_%I_immutable on public.%I', table_name, table_name);
    execute format(
      'create trigger phase7_%I_immutable before update on public.%I for each row execute function public.phase7_reject_match_history_mutation()',
      table_name,
      table_name
    );
  end loop;
end $$;

comment on function public.phase7_reject_match_history_mutation() is
  'Blocks history rewrites. Ordinary users have no mutation grants; account-deletion cascades are allowed to complete.';
