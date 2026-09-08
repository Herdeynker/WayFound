# Phase 3 — Opportunity Passport architecture

Working onboarding state is stored in `onboarding_progress` as a validated, user-owned draft so interrupted edits can resume without pretending that each keystroke is a confirmed matching profile. Review confirmation writes the normalized records (`user_goals`, education, employment, skills, certifications, trade, language and destinations) and appends an immutable `profile_versions` snapshot.

CV upload is intentionally narrow in this phase. Files are stored in the private `user-documents` bucket under a user-owned folder, with a metadata row and no public URL. MIME, extension, size and basic file signatures are checked before storage. Parsing has a strict provider/schema boundary and returns an honest disabled state until an AI provider is configured. No CV text is logged and no suggestion writes directly to profile records.

Completion is deterministic and pathway-specific. It describes profile completeness only; it does not claim eligibility, sponsorship or a match. Conditional section rules are centralized so a multi-goal Passport receives the union of relevant questions without duplicating sections.
