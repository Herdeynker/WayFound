-- Phase 13 forward-only account-cleanup compatibility. Ordinary browser roles
-- still have no update/delete grants; removing delete triggers permits the
-- existing auth.users cascade to remove private IELTS history on account deletion.

drop trigger if exists ielts_responses_immutable on public.ielts_attempt_responses;
drop trigger if exists ielts_feedback_immutable on public.ielts_feedback;
drop trigger if exists ielts_study_plans_immutable on public.ielts_study_plans;

create trigger ielts_responses_immutable before update on public.ielts_attempt_responses
for each row execute function public.phase13_immutable_history();
create trigger ielts_feedback_immutable before update on public.ielts_feedback
for each row execute function public.phase13_immutable_history();
create trigger ielts_study_plans_immutable before update on public.ielts_study_plans
for each row execute function public.phase13_immutable_history();

comment on function public.phase13_immutable_history() is
  'Rejects rewrites of IELTS response, feedback and study-plan history. Deletes remain service-only for account cleanup.';
