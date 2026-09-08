# WAYFOUND Approved Design Source of Truth

Status: Approved direction and mandatory implementation reference

## 1. Locked project decisions

- Brand direction: Direction A — Trusted Navigator.
- Product design approach: mobile-first, responsive at every breakpoint.
- Every product surface must be completely usable on a phone: public pages, authentication, onboarding, Opportunity Passport, matching, opportunity details, document upload, application preparation, IELTS practice, interview practice, payments, settings, alerts and account management.
- Desktop must be deliberately composed for desktop; it must not look like a stretched mobile screen.
- Mobile must be deliberately composed for touch; it must not be a scaled-down desktop grid.
- The approved desktop and mobile dashboard reference images are part of this source of truth.
- Do not replace the approved design with default shadcn components, generic dashboard cards, arbitrary gradients or a generic “vibe-coded” SaaS aesthetic.

## 2. Approved reference files

- `wayfound-approved-landing-page.png`: original Direction A brand reference.
- `wayfound-approved-dashboard-desktop.png`: approved cool desktop dashboard.
- `wayfound-approved-dashboard-mobile.png`: approved mobile dashboard reference.

During implementation, load these references before styling the related surfaces and visually compare the built pages against them at the target viewport sizes.

## 3. Brand character

WAYFOUND must feel trustworthy, optimistic, globally relevant, African-aware, practical and human. It must not resemble a travel agency, visa agent, scholarship blog or generic AI wrapper.

Core brand line: **Find where you fit.**

Supporting phrases used by the approved visual system:

- **A brighter tomorrow. A wider you.**
- **Your next step is a bigger story.**
- **Bigger opportunities ahead.**

## 4. Colour tokens

| Token       |     Value | Use                                              |
| ----------- | --------: | ------------------------------------------------ |
| `navy-900`  | `#071A2B` | Deepest navigation and illustration shadows      |
| `navy-800`  | `#102A43` | Sidebar, primary headings, dark hero surfaces    |
| `teal-600`  | `#079C9B` | Primary actions, active navigation, match values |
| `teal-500`  | `#0EA5A4` | Progress paths, icons and branded highlights     |
| `teal-100`  | `#DDF5F4` | Soft tags, icon discs and selected backgrounds   |
| `amber-500` | `#F5A623` | Next action, route endpoints and urgent emphasis |
| `amber-100` | `#FFF1D6` | Next Best Action surface                         |
| `cloud`     | `#F6F8FA` | Application background                           |
| `surface`   | `#FFFFFF` | Cards and navigation surfaces                    |
| `ink`       | `#17212B` | Primary body text                                |
| `slate`     | `#647486` | Secondary and metadata text                      |
| `mist`      | `#DCE4EA` | Borders and separators                           |

Rules:

- Navy and white establish trust and structure.
- Teal is the primary interactive colour.
- Amber is scarce and reserved for one priority action, deadline urgency or route endpoint per composition.
- Do not introduce royal blue, violet, lime, emerald, cream or gold into Direction A.
- Do not use large decorative gradients outside the approved dark Opportunity Path artwork.

## 5. Typography

- Primary UI font: Inter or a metrically similar highly readable sans-serif.
- Display/headings: Sora, using Inter as a fallback.
- Headings are bold, compact and high contrast.
- Body copy is calm and readable, never overly small.
- Handwritten route captions use one selected handwritten display face or custom vector lettering. Use it only for the two approved desktop route messages and limited campaign artwork.
- Do not scatter handwritten typography throughout the interface.

Recommended scale:

- Desktop page greeting: 46–54 px, 700–800 weight.
- Desktop major card heading: 28–34 px, 700.
- Mobile greeting: 32–40 px, 750–800.
- Mobile major card heading: 24–30 px, 700.
- Section heading: 22–28 px desktop; 20–24 px mobile.
- Body: 15–18 px.
- Metadata: never below 12 px.

## 6. Logo

- Wordmark: uppercase `WAYFOUND`, white on dark surfaces and navy on light surfaces.
- Mark: turquoise location pin connected to a curved navy path, with small amber and teal endpoint dots.
- The route-pin mark must remain recognizable at favicon and bottom-navigation sizes.
- Required exports: full horizontal light, full horizontal dark, mark-only light, mark-only dark, favicon and app icon.
- Recreate the logo as vector artwork. Do not embed the AI-generated raster logo in production.

## 7. Desktop dashboard composition

Target reference viewport: 1680 × 945 (16:9). The page must remain responsive from 1024 px upward.

### 7.1 Sidebar

- Fixed left sidebar, approximately 260–280 px wide.
- Background: deep navy with subtle depth, not flat black.
- Top: route-pin logo plus white WAYFOUND wordmark.
- Navigation order: Home, Opportunities, My Applications, Readiness, Saved, Messages, Profile.
- Active Home item: teal/navy blended surface with clearly visible white icon and text.
- Icons: thin, consistent outline icons; do not mix styles.
- The lower-left corner contains a mandatory brand signature:
  - A teal location pin near the lower-left edge.
  - A curved/dotted teal route rising toward the right.
  - Handwritten white text set over three lines: **“A brighter tomorrow. A wider you.”**
  - Preserve breathing room around it; it is not a button.

### 7.2 Top bar

- Wide, low-contrast search field aligned left within the content area.
- Search placeholder: “Search opportunities, skills or countries…”
- Right side: notification bell with amber unread dot, divider, user avatar, “Hi, Amara”, encouragement line and chevron.
- Light background with a thin bottom border.

### 7.3 Greeting and upper route signature

- Main greeting: “Good morning, Amara”, with `Amara` in teal.
- Supporting text: “A brighter tomorrow. A wider you.” in slate.
- Mandatory upper-right decorative signature:
  - Begins with a teal circular route node.
  - Curved teal stroke leading toward the handwritten caption.
  - Exact handwritten caption: **“Your next step is a bigger story.”**
  - Continues as a dotted curved blue/teal route.
  - Ends at a teal location pin.
  - This element must be implemented as a custom responsive SVG; do not approximate it with a straight CSS border.

### 7.4 Your Opportunity Path hero card

- Dominant upper-left card, spanning roughly 55% of the usable dashboard width.
- Deep navy cinematic surface with a subtle navy-to-teal atmosphere.
- Required title: “Your Opportunity Path”.
- Supporting text: “Complete a few more steps to unlock even more opportunities.”
- Readiness state: “78% ready”, with the percentage in luminous teal.
- Horizontal four-stage route: Profile completed, Skills & experience, Documents, Application practice.
- Completed checkpoints: teal circles with white checkmarks.
- Remaining checkpoint: outlined pale circle.
- Main button: warm amber, “Continue setup”, right arrow.
- Artwork: a tasteful custom illustration of a person viewed from behind on a mountain/path landscape with a winding teal route toward sunrise. It must feel aspirational and editorial, not like generic stock photography.
- Production asset instruction: create this artwork deliberately using ImageGen, then optimize it as AVIF/WebP; alternatively commission/recreate it as layered vector art. Do not crop the reference screenshot and use it as a production background.
- Provide a CSS gradient fallback while the image loads.

### 7.5 Next Best Action card

- Placed immediately to the right of the Opportunity Path card.
- Warm amber-tinted background, not saturated orange.
- Label: “Next Best Action”.
- Main instruction: “Complete your profile”.
- Supporting copy: “A complete profile helps you get better matches and more opportunities.”
- Includes a simplified amber ID/profile illustration with three short attention lines.
- Button: amber “Continue setup” with arrow.
- This is the only amber-dominant card on the dashboard.

### 7.6 Right utility rail

- Two small stacked cards only, avoiding dashboard clutter.
- Applications card: teal document icon disc, “Applications”, “2 active”, short supporting line and chevron.
- IELTS Practice card: teal progress-bars icon disc, “IELTS Practice”, “Band 6.5”, short supporting line, small rising teal bars and chevron.

### 7.7 Top Matches For You

- One wide white section below the primary cards.
- Heading left: “Top Matches For You”.
- “View all” link right with teal arrow.
- Exactly three visible opportunity cards at the reference desktop width:
  1. Chinese Government Scholarship — Scholarship — China — 92% Match.
  2. Software Engineer — Job — Germany — 88% Match.
  3. Skilled Worker — Skilled Work — Canada — 85% Match.
- Each card contains: destination image, pale category chip, bookmark icon, title, destination with pin icon, prominent teal match percentage, “Match” label, deadline row and right chevron.
- Use real opportunity images only when legally usable; otherwise use purpose-made destination illustrations or licensed imagery.
- Cards should have thin mist borders, restrained shadow and 10–12 px radius.

## 8. Mobile dashboard composition

Primary target: 390 × 844 CSS pixels. Validate at 360, 390, 412 and 430 px widths.

### 8.1 Header

- White header with route-pin logo, WAYFOUND wordmark, bell with amber unread dot and circular avatar.
- No hamburger menu on the primary dashboard.

### 8.2 Greeting

- “Good morning, Amara”, with `Amara` in teal.
- Supporting line: “A brighter tomorrow. A wider you.”

### 8.3 Mobile Opportunity Path card

- Deep navy full-width hero card.
- Title: “Your Opportunity Path”.
- Supporting sentence as on desktop.
- Large “78% ready”.
- Curved teal route with three completed checkmark checkpoints and one current-ring checkpoint, ending at an amber location pin.
- Small current-state speech bubble: “Almost there!”
- Small uppercase route caption: “Bigger opportunities ahead”.
- Teal primary button: “Continue setup”.
- This mobile route graphic replaces the desktop’s wide mountain/person composition when space is limited. Use a purpose-built responsive SVG, not a cropped desktop illustration.

### 8.4 Mobile Next Best Action

- Compact horizontal amber-tinted strip.
- Amber profile icon on the left.
- Label: “Next Best Action”.
- Main instruction: “Complete your profile”.
- Chevron on the right.
- Entire card is a large touch target.

### 8.5 Mobile opportunity carousel

- Heading: “Top Matches For You”, with “View all” on the right.
- Horizontal swipe carousel with snap points.
- First two cards mostly visible; a sliver of the third card signals horizontal scrolling.
- Opportunity-card contents mirror desktop but simplify metadata and remove the deadline above the fold.
- Cards use large images, two-line titles, destination, teal match score, bookmark and circular arrow action.

### 8.6 Bottom navigation

- Fixed bottom navigation with Home, Explore, Applications, Prepare and Profile.
- Home is teal with a short underline indicator.
- Minimum 44 × 44 px touch areas.
- Respect iOS and Android safe-area insets.
- Labels must remain visible; do not use icon-only navigation.

## 9. Responsive transformation rules

- `>= 1280px`: full desktop composition with sidebar, primary hero, Next Best Action and two-card utility rail.
- `1024–1279px`: narrower sidebar, utility rail moves beneath upper cards if necessary, three match cards remain where practical.
- `768–1023px`: sidebar collapses to compact rail or top navigation; two-column content; handwritten upper route simplifies but remains visible.
- `< 768px`: mobile composition, bottom navigation, horizontal match carousel, mobile SVG route card.
- Never create horizontal page overflow. Only the explicitly designed opportunity carousel may scroll horizontally.
- Critical actions must not require hover.

## 10. Illustration and asset plan

Create or commission the following final assets before visual completion:

1. Vector WAYFOUND route-pin logo family.
2. Desktop Opportunity Path landscape artwork.
3. Desktop upper handwritten route SVG containing “Your next step is a bigger story.”
4. Desktop lower-left sidebar route SVG containing “A brighter tomorrow. A wider you.”
5. Mobile Opportunity Path responsive route SVG with checkpoints, speech bubble and amber destination pin.
6. Next Best Action profile/ID illustration.
7. Opportunity image treatment or legally usable destination-image set.
8. Empty-state route illustrations for no matches, no applications and incomplete profile.

When ImageGen is used:

- Supply the approved references and locked palette.
- Generate artwork only, without UI text baked into the image unless the text is part of the handwritten route artwork.
- Inspect output before inclusion.
- Optimize raster assets and provide responsive sizes.
- Add meaningful alt text; decorative route art should use empty alt text.

## 11. Component inventory

- `AppShell`
- `DesktopSidebar`
- `MobileBottomNav`
- `TopSearchBar`
- `UserMenu`
- `GreetingHeader`
- `DesktopRouteSignature`
- `SidebarRouteSignature`
- `OpportunityPathCard`
- `OpportunityPathIllustration`
- `MobileProgressRoute`
- `NextBestActionCard`
- `UtilitySummaryCard`
- `MatchSection`
- `OpportunityCard`
- `OpportunityCarousel`
- `CategoryChip`
- `MatchScore`
- `DeadlineBadge`
- `BookmarkButton`
- `LoadingSkeleton`
- `EmptyState`
- `ErrorState`

## 12. Interaction requirements

- Clear hover, pressed, focus-visible, loading and disabled states.
- Keyboard accessible desktop navigation.
- Screen-reader labels for icon-only actions such as bookmark and notifications.
- WCAG AA colour contrast for body text and actions.
- Reduced-motion support for route progress animation.
- Opportunity cards open a detailed match explanation.
- Next Best Action is generated from the most consequential incomplete task.
- Progress routes animate only once and never obstruct interaction.

## 13. Implementation build plan for the approved shell

### Phase 1 — Tokens and assets

- Add colour, typography, radius, spacing and shadow tokens.
- Build the vector logo.
- Create the two desktop handwritten route SVGs.
- Create the mobile route SVG.
- Generate or create the desktop Opportunity Path artwork and fallback.

### Phase 2 — Responsive shell

- Build desktop sidebar, top bar and mobile bottom navigation.
- Establish responsive breakpoints, safe areas and content widths.
- Verify navigation at all target widths.

### Phase 3 — Dashboard components

- Build greeting, Opportunity Path, Next Best Action, utility cards and opportunity cards.
- Build desktop match grid and mobile snap carousel from the same data model.
- Add realistic loading, empty and error states.

### Phase 4 — Functional data

- Connect profile readiness, next-best-action logic, matches, applications and IELTS status.
- Replace all mock values with authenticated user data.

### Phase 5 — Visual QA

- Compare at 1680 × 945, 1440 × 900, 1280 × 800, 1024 × 768, 430 × 932, 390 × 844 and 360 × 800.
- Verify the two handwritten desktop route elements are present and correctly placed.
- Verify the mobile route motif is present in the Opportunity Path card.
- Verify amber remains scarce and teal remains the primary interactive colour.
- Verify touch targets, text wrapping, carousel behaviour and safe areas.
- Reject the implementation if it falls back to generic component-library defaults or loses the approved visual hierarchy.

## 14. Non-negotiable acceptance checklist

- [ ] Direction A palette is exact.
- [ ] Desktop dashboard matches the approved composition and character.
- [ ] Mobile dashboard matches the approved mobile-first character.
- [ ] “Your next step is a bigger story.” appears with its curved route above the desktop cards.
- [ ] “A brighter tomorrow. A wider you.” appears with its curved route in the desktop sidebar’s lower-left area.
- [ ] The mobile Opportunity Path route preserves the storytelling motif.
- [ ] Opportunity Path artwork is custom-created, responsive and optimized.
- [ ] Desktop is not crowded.
- [ ] Mobile does not feel compressed.
- [ ] No generic shadcn/default UI has replaced the approved art direction.
- [ ] Every product screen is fully usable on mobile.
- [ ] All mock statistics, opportunities and user details are replaced with real or clearly labeled demo data before public release.
