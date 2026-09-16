# WAYFOUND Phase 16 — Personalized discovery experience

Status: delivered and verified against the linked WAYFOUND development project.

## Scope and numbering decision

This phase follows the newer founder-approved Phase 16 brief in the implementation task. The older roadmap names Phase 16 “Interview Studio”; Interview Studio is not part of this change and no Phase 17 functionality is introduced.

## Result hierarchy

The dashboard and Opportunities route consume the existing Phase 7 match evaluations first. When fewer than three safe matches are available, the presenter fills the remaining capacity from the Phase 4–6 `safe_active_opportunities` surface. These cards are labelled **Based on your goals** or **Explore more opportunities** and never receive a fabricated fit score. The full route provides For You, Latest, Closing Soon and Explore All tabs with bounded, deterministic ordering. Dismissed/suppressed/expired/withdrawn rows remain excluded by the existing safe view and feedback boundary.

Incomplete Passports may see verified broader opportunities, but the UI says “Complete your Passport to calculate your match.” A genuine empty safe view remains an honest empty state.

## Data flow and security

Onboarding drafts continue to autosave into the existing user-owned records. Confirmation creates the immutable Passport snapshot consumed by Phase 7. The dashboard reads only the safe opportunity view and owner-scoped match/reason/feedback rows. No browser code can publish, score, resolve sources or invoke discovery workers.

`user_walkthrough_state` stores versioned first-use completion/dismissal state. `user_checklist_state` stores only presentation state; checklist completion is derived from goals, Passport versions, matches, saves, documents and notification preferences. `opportunity_user_states` stores saved/dismissed state for verified opportunities that do not yet have a Phase 7 match. All three user-owned tables have owner RLS and immutable ownership guards. Hosted anonymous, owner, cross-user and forged-owner checks pass.

## Walkthrough and checklist

The tour is a small accessible dialog with real desktop-sidebar, mobile-navigation and account targets. It supports Next, Back, Skip, Finish, progress, Escape, focus restoration and reduced motion. Completion is server-persisted and versioned; account settings can request a restart. The checklist is collapsible, dismissible and reopenable, and every incomplete item links to its authoritative action.

## Destination media

Destination photographs are controlled local assets with provenance in `public/images/destinations/ATTRIBUTION.md` and governed metadata in `destination_media`. Selection is destination-level and never presented as employer or university evidence. Unknown destinations receive a neutral placeholder. Only controlled `/images/` paths or approved HTTPS hosts are accepted. The Netherlands records currently visible through the hosted safe view use the locally optimized Amsterdam image sourced from Wikimedia Commons and released under CC0.

## Discovery and operational limits

Phase 15 remains the sole discovery pipeline: Brave is server-only, private leads stay private, official-source resolution/publication gates remain authoritative, and the existing 25/day, 750/month and 20-results/query limits remain unchanged. Phase 16 consumed no additional Brave quota. The hosted safe view contains two real, non-fixture, non-synthetic published opportunities; temporary test records were suppressed and are explicitly excluded from the safe surface. No real notification or payment was sent by automated tests.

## Hosted database verification

The linked development project is `lzhnneiavofdwvbbnbvm`. Migrations `20260908140000_phase16_personalized_discovery.sql` and `20260908140001_phase16_netherlands_destination_media.sql` are recorded remotely. A final linked dry run reported the database up to date, and linked database lint reported no schema errors. The generated TypeScript schema was refreshed from the hosted project.

## Production evidence

Behavioral and visual regression evidence is isolated beneath `artifacts/phase-16/regression/`; no earlier canonical evidence was overwritten. Six additional screenshots beneath `artifacts/phase-16/live/` were captured from `next start` against the hosted safe view with a temporary, fully cleaned test account. They prove real hosted cards, controlled destination photography, desktop/mobile layout, opportunity navigation and honest match-pending language without fixtures or invented scores.

## Accessibility and performance decisions

Cards use bounded queries and `next/image` with explicit dimensions and lazy loading below the fold. The tour uses native buttons, a modal focus loop and reduced-motion handling. The dashboard retains Direction A structure, adapts the narrow desktop grid and keeps mobile navigation reachable. Required 360/390/412/430, tablet, desktop, zoom and keyboard evidence remains a release gate.
