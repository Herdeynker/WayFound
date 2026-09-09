# Phase 7: matching, readiness and Next Best Action

Phase 7 is a server-only, deterministic evaluation foundation. It does not create a feed, search, filtering, opportunity details, notifications, automatic applications, marketing page, or adaptive scoring. Phase 8 is the only consumer-facing discovery UI phase.

## Evaluation and candidate boundary

Only a bounded set of at most 100 non-fixture, active, non-suppressed candidates is considered for an evaluation. Selection uses confirmed goals and destination preference; it never creates an unbounded user-by-opportunity cross join. Expired, withdrawn, inaccessible, suppressed and fixture opportunities are excluded. Phase 6 publication decisions are consumed as an input and never recomputed here.

Every immutable result stores its user, confirmed Passport version, opportunity and opportunity version, applicable country-rule versions, confidence assessment, algorithm version, scoring configuration version, fingerprint and UTC evaluation time. The fingerprint contains material version inputs, not a timestamp: identical inputs are idempotent; a Passport, opportunity, country rule, confidence, algorithm or configuration change creates a new result. Failed server jobs can safely retry using the same fingerprint.

Requirements have distinct `met`, `not_met`, `unknown`, `not_applicable`, `conflicting`, and `manual_confirmation_required` states. Missing data is unknown, never false or zero. Hard failures yield `not_currently_eligible`; unknown hard requirements yield `more_information_needed`; manual/conflicting hard requirements yield `manual_confirmation_required`. Soft requirements are fit signals only, informational requirements do not affect eligibility, and documented waivers only apply when their stated condition is met. Unverified country rules are not invented or treated as confirmed.

## Score, ranking and explanations

`phase7.scoring.v1` centrally defines bounded weights for soft requirements, goal, destination, study/occupation, sponsorship clarity and readiness. The score is a fit indicator—not an admission, employment or visa probability—and cannot mask a hard failure or Phase 6 safety limitation. Ranking uses eligibility first, then score and stable identifiers; urgency never overrides safety. Each result persists score components plus ordered reasons referencing normalized requirements and available source evidence.

## Readiness and action

Readiness is `ready`, `missing`, `in_progress`, `expired`, `unknown`, `conditional`, or `not_applicable`. It records preparation only: a file or document status never claims official validity. NYSC is evaluated only where an opportunity explicitly requires it. A deterministic, evidence-based Next Best Action is saved with a stable type, rationale and priority. Users can acknowledge, complete or dismiss an action; neither action nor feedback changes eligibility or scoring.

## Privacy and Phase 8 contract

All Phase 7 tables have RLS. Core history is server-written and immutable; authenticated users can read only their own results. Ownership predicates are kept directly inside RLS policies; no Phase 7 ownership RPC is exposed. Feedback is owner-only, constrained, idempotent and limited to 4KB object metadata. It excludes raw CV, document contents and sensitive analytics. Phase 8 may read user-owned result/reason/readiness/action records through the supplied stable identifiers, but must not reinterpret scores as guarantees or bypass RLS.
