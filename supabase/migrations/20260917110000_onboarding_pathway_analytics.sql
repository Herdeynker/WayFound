-- Privacy-safe onboarding pathway analytics. Focus-path state itself remains
-- inside the existing owner-protected onboarding_progress.draft JSON column.

alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_event_type_check;

alter table public.product_analytics_events
  add constraint product_analytics_events_event_type_check check (event_type in (
    'registration', 'onboarding_started', 'onboarding_stage_viewed',
    'onboarding_stage_completed', 'onboarding_stage_abandoned', 'onboarding_resumed',
    'onboarding_completed', 'optional_field_deferred', 'review_edit_requested',
    'onboarding_focus_path_viewed', 'onboarding_focus_path_selected',
    'onboarding_focus_path_changed', 'onboarding_exploring_selected',
    'onboarding_deferred_path', 'first_useful_match', 'opportunity_saved',
    'application_workspace_created', 'application_submitted', 'outcome_recorded',
    'alert_opened', 'upgrade_completed', 'ai_exported', 'return_session'
  ));

comment on constraint product_analytics_events_event_type_check on public.product_analytics_events is
  'Allows only privacy-safe product events; focus-path events never include form answers or personal data.';
