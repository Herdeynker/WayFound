# WAYFOUND Phase 4 opportunity data model

## Scope and safety boundary

Phase 4 supplies the normalized, server-operated opportunity model. It does not crawl sources, calculate matching or confidence scores, publish a user feed, create an approval queue, or claim a current country rule. The four seeded records are explicitly non-production fixtures and are excluded from the public-safe view.

## Taxonomy and lifecycle

Stable opportunity type codes are `scholarship`, `fellowship`, `graduate_programme`, `research_position`, `internship`, `professional_job`, and `skilled_trade_work`. Display names may change; codes are the durable identifiers. Subtypes extend the taxonomy without application switch statements.

Lifecycle is distinct from publication: `discovered`, `active`, `closing_soon`, `expired`, `withdrawn`, `inaccessible`, `superseded`, and `suppressed` describe record state. `draft`, `eligible`, `published`, `suppressed`, and `fixture` describe publication state. Expiry preserves the record and its version history.

## Requirements, unknown values and conditions

Requirements store a category, structured operator, normalized value, hard/soft/informational meaning, original wording, evidence link, and bounded applicability condition. A normalized value is explicitly `known` or `unknown`; absence is never silently treated as false or zero. Conditions accept only origin-country, study-level, occupation, dependant, and documented-waiver selectors. They are data, never executable code.

Benefits, documents, and application steps retain original wording and evidence. “Funded” is not normalized to “fully funded”; benefit coverage remains `not_stated` until evidence supports a stronger statement.

Document requirements distinguish required, optional, and conditional states, and support the Passport-compatible CV/resume, passport, transcript, degree/result, reference/recommendation, motivation/personal statement, research proposal, portfolio, language, professional/trade certificate, and explicitly scoped NYSC types. NYSC is never universal. Application steps are ordered records with a descriptive stage, optional external URL, deadline, and evidence reference; no submission automation is present.

Organizations are not automatically verified because they have a website. Organization verification is separate from vacancy-specific sponsorship evidence and remains server-operated.

## Sources, evidence and sponsorship

`source_registry` holds policy and operational metadata that is server-only. Trust tier 1 is primary official, 2 verified institutional/employer, 3 approved authoritative registry, 4 approved secondary discovery, and 5 unverified discovery lead. Tiers order source priority; they are not confidence scores.

Each opportunity can retain several sources and evidence excerpts. Excerpts are capped and point to the structured fact they support rather than copying source pages. A published safe record requires an active, allowed, non-fixture primary source from trust tier 1–3; a tier 4 or 5 discovery lead cannot become its primary evidence. Sponsorship evidence has an explicit scope: `vacancy_specific`, `organization_level`, or `country_pathway`. An employer register entry therefore cannot become proof that a vacancy sponsors.

## Country rules and extensions

`country_modules` contains structural modules for China, the United Kingdom, Canada, Australia, Germany, Ireland, the Netherlands, the United States, and New Zealand. They contain pathways, terminology slots, classification-reference slots and an adapter contract only. All begin `framework_only` and are not production-active.

`country_rules` is dated, versioned, source-linked, replaceable and deactivatable. A production-verified rule requires an official source. Phase 5 adapters must add dated official evidence and set verified coverage only after an authoritative review. To add a destination safely: add its ISO country record, a framework-only module, authoritative source records, mapped classifications, then source-linked dated rules; do not encode rules in application code.

## Versioning, duplicates and safe reads

Material opportunity updates create immutable append-only versions. The duplicate key uses canonical URL when available, otherwise normalized organization, title, destination, type and external source ID. It prevents obvious duplicates while retaining separate source/evidence records.

Changes to requirements, benefits, documents, application steps, sources, evidence, and sponsorship evidence also append a version containing the changed record. Timestamp-only updates do not create an opportunity version. Versions retain a reason, schema version, optional content hash, and prior snapshots for later comparison.

`safe_active_opportunities` is the sole client-readable surface. It excludes fixtures, suppressed/non-active records, internal notes, raw extraction metadata and provenance. Raw Phase 4 tables have RLS enabled, no client policies, and no client grants. Future Phase 5 server adapters use privileged server-only paths.

## Fixture handling

The China scholarship, German professional role, Canadian skilled-work role and Australian fellowship demonstrate representational coverage only. Their `.invalid` URLs, fixture source type, disabled registry status, `fixture` publication state and fixture evidence make them impossible to appear in production-safe queries.

## Production data required before activation

Before a country module or rule becomes production-active, a server-side Phase 5/6 process must attach current authoritative sources, jurisdiction, evidence excerpts, source hash/version where practical, effective and verified dates, and completeness status. It must preserve uncertainty and stale status. AI output may propose structured fields in a later phase but can never be primary evidence. Phase 5 adapters are expected to create source, source-link, evidence, and draft opportunity records through server-only paths; they must not bypass the publication guard.
