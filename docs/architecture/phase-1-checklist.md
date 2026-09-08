# WAYFOUND Phase 1 coverage checklist

This checklist maps the Phase 1 implementation brief to concrete files, tests and visual evidence. Phase 1 is limited to the Direction A visual foundation, responsive authenticated shell and static dashboard fixtures. Authentication, database-backed product workflows and the landing page remain out of scope.

| Requirement                             | Implementation                                                              | Verification                                  | Status   |
| --------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- | -------- |
| Direction A semantic tokens             | `src/app/globals.css`, `tailwind.config.ts`                                 | token tests, format/lint/build                | Complete |
| Vector WAYFOUND logo family             | `src/components/wayfound-logo.tsx`                                          | logo component tests, rendered screenshots    | Complete |
| Desktop sidebar and signature           | `src/components/dashboard-shell.tsx`, `src/components/route-signatures.tsx` | shell tests, desktop screenshots              | Complete |
| Desktop search and user bar             | `src/components/dashboard-shell.tsx`                                        | accessible-name tests, desktop screenshots    | Complete |
| Mobile header and bottom navigation     | `src/components/dashboard-shell.tsx`                                        | mobile navigation tests, viewport screenshots | Complete |
| Exact route-signature messages          | `src/components/route-signatures.tsx`                                       | exact-text component tests                    | Complete |
| Desktop/mobile Opportunity Path         | `src/components/dashboard-shell.tsx`                                        | fixture/content tests, responsive screenshots | Complete |
| Reusable accessible primitives          | `src/components/ui.tsx`                                                     | component tests and keyboard checks           | Complete |
| Typed static dashboard fixtures         | `src/features/dashboard/dashboard-fixtures.ts`                              | fixture tests and source audit                | Complete |
| Desktop dashboard composition           | `src/components/dashboard-shell.tsx`                                        | 1280/1680 screenshots                         | Complete |
| Mobile carousel and safe-area nav       | `src/components/dashboard-shell.tsx`, `src/app/globals.css`                 | 360/390/412/430 Playwright tests              | Complete |
| Focus, reduced motion and touch targets | `src/app/globals.css`, UI primitives                                        | Playwright keyboard/overflow checks           | Complete |
| No Phase 2/landing-page work            | route and source scope audit                                                | route list and text search                    | Complete |

## Visual acceptance evidence

Final screenshots are captured under `artifacts/phase-1/` at 1680×945, 1280×800, 390×844, 360×800 and 430×932. The approved landing-page image is used only as a brand reference and is not implemented as a route.
