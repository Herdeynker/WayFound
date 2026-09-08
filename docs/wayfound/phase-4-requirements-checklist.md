# Phase 4 requirement checklist

| Requirement | Database / domain implementation | Test evidence | Remote verification evidence | Documentation | Status |
| --- | --- | --- | --- | --- | --- |
| Stable global opportunity taxonomy | `opportunity_types`, `opportunity_subtypes`, `OPPORTUNITY_TYPE_CODES` | unit taxonomy test | seven required type codes seeded | opportunity model: Taxonomy | Complete |
| Normalized opportunity record | `opportunities`, guarded lifecycle/publication states and duplicate key | integration creation/constraint tests | foreign keys, check constraints and indexes inspected | opportunity model: Lifecycle | Complete |
| Cross-country representational coverage | explicit China, Germany, Canada and Australia fixture records | integration fixture assertions | four fixture records inspected | opportunity model: Fixture handling | Complete |
| Country and origin model | country, alias, region, city, module, field and occupation relations | module/origin assertions | nine framework-only destinations and Nigeria origin verified | opportunity model: Country rules | Complete |
| Framework-only country modules | `country_modules` with inactive coverage | integration module assertion | no active production module or rule found | opportunity model: Country rules | Complete |
| Extensible academic and occupation classifications | `academic_fields`, aliases, occupations, aliases and external codes | FK/normalization tests | constraints and indexes inspected | opportunity model: Country rules | Complete |
| Requirements preserve uncertainty | bounded known/unknown JSON and applicability-condition checks | invalid and valid condition tests | functions/check constraints inspected | opportunity model: Requirements | Complete |
| Benefits, documents and application steps | separate normalized relation tables with original wording/evidence links | integration lifecycle/version tests | tables, constraints and indexes inspected | opportunity model: Requirements | Complete |
| Provenance and source registry | `source_registry`, `opportunity_sources`, `opportunity_evidence` | source/evidence rejection and publication tests | source trust restriction inspected | opportunity model: Sources | Complete |
| Sponsorship evidence stays scoped | `sponsorship_evidence.evidence_scope` enum | fixture and constraint assertions | scope constraint inspected | opportunity model: Sources | Complete |
| Publication requires evidence | `phase4_validate_publication` trigger | missing-evidence publication rejection | safe-view plan and fixture exclusion verified | opportunity model: Sources | Complete |
| Safe public read surface | explicit-field `safe_active_opportunities` view | safe-view visibility and expired-record tests | view inspected; planner uses active index | opportunity model: Safe reads | Complete |
| Fixture records cannot publish | fixture state, invalid URLs, disabled source registry and safe-view filter | safe fixture count is zero | remote safe fixture count is zero | opportunity model: Fixture handling | Complete |
| Append-only material versioning | `opportunity_versions` plus parent/child change triggers | version count and immutable-update tests | version trigger functions inspected | opportunity model: Versioning | Complete |
| Duplicate preparation without destructive merge | canonical URL / normalized fallback duplicate key | unit duplicate-key test | unique index inspected | opportunity model: Versioning | Complete |
| RLS and server-only writes | RLS on all 28 raw Phase 4 tables; no client policies or grants | anonymous and authenticated write/read denial tests; Phase 2–3 User A/User B regressions | all 28 tables report RLS enabled, zero policies | opportunity model: Safe reads | Complete |
| No fabricated immigration rules | no active country rule seed; dated source-linked `country_rules` only | module/rule assertions | no production rule activated | opportunity model: Country rules | Complete |
| No Phase 5 feature scope | no crawler, ingestion, matching, scoring, approval queue or feed | source-scope audit and existing UI regressions | migration contains schema only | opportunity model: Scope boundary | Complete |
