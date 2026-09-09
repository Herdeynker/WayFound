# Phase 6 confidence and safety

Phase 6 is an internal, server-only confidence and safety engine. It does not match users, calculate eligibility, rank recommendations, or expose a feed; those remain Phase 7 and later.

Each immutable assessment records versioned opportunity input, bounded source and sponsorship confidence values, staleness, decision, and factor-level evidence. Values describe evidence quality, not admission, employment, sponsorship, visa, or application-success probability.

Critical conditions win: suspicious payment requests suppress; explicit withdrawal/expiry controls lifecycle; conflicting or insufficient evidence requires limitation or more evidence. An inaccessible record rechecks after one or two failures and becomes inaccessible only after three confirmed failures.

Sponsorship evidence is scope-aware. Vacancy-specific confirmation differs from visa or relocation assistance. Employer-register evidence means organization capability only; it never proves a vacancy sponsors. Stale, superseded, copied-secondary, or inactive evidence does not provide current corroboration.

Assessments are idempotent by opportunity, type, algorithm version and input fingerprint. Material evidence, trust, deadline, lifecycle, or algorithm changes produce a new historical assessment; timestamp-only refreshes do not. Browser roles have no access or write grants to confidence internals.
