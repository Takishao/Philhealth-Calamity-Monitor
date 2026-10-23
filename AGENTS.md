# PhilHealth Calamity Monitor: continuation guide

## Purpose and owner goals

An illustrative local calamity claims and budget monitor, audited against the owner's paper-derived specification. Preserve the Fastify/SQLite/vanilla JavaScript stack. The owner wants a complete module audit, logo-derived palette, consistent budget condition coloring, usable workflows, reproducible startup and honest evidence. No real PhilHealth or patient data.

## Run, test, build and seed

Repository: `/Users/takishao/Desktop/Philhealth-Calamity-Monitor`.
Verified environment: macOS 27.2 Apple silicon, Node 26.8.2, npm 11.19.1. Supported Node 22+.

```sh
cd ~/Desktop/Philhealth-Calamity-Monitor
./start.sh
```

URL: http://localhost:3000. Start script installs locked dependencies if absent, runs additive demo seeding, starts the server. Manual: `cd philhealth && npm ci && npm run seed && npm start`. No build step; native frontend modules are served directly.

Demo usernames: `cfb` (Central Finance), `act` (accounting), `exe` (executive approver), `aud` (read-only auditor), `adm` (administrator), `ros_iva`, `ros_vii`, `ros_xi` (regional staff), `rvp_vii` (regional approver). All passwords: `demo1234`. Illustrative local credentials only.

```sh
cd ~/Desktop/Philhealth-Calamity-Monitor/philhealth
npm test
npm run check:emoji
npm audit
```

Tests: 22 domain/API/presentation tests plus 1 isolated guard regression test (23 total). Test databases are in memory. No-emoji scan runs before all tests. Schema changes are sequential SQL migrations; do not modify applied migrations. Local database is ignored by Git.

Reset: stop server, move `philhealth/backend/data/calamity.db` and any `-wal`/`-shm` companions to a backup directory, then run `./start.sh`. Do not delete real data. Seed is additive and never resets existing records. Demo as-of date defaults to 2026-10-15, adjustable by `adm`. New activity after that date requires a deliberate as-of-date update for forecasting/aging.

`.env.example` lists optional shell variables; there is no dotenv loader. `PORT=3000`, `HOST=127.0.0.1`; `TRUST_PROXY=1` only behind a trusted proxy. Local Secure cookies require localhost (127.0.0.1 browser visits redirect). The frontend is not the legacy Live Server prototype.

## Stack and folder map

- `philhealth/package.json`, lockfile: Fastify 5, better-sqlite3, Argon2, Zod, csv-parse, ExcelJS, PDFKit, lucide-static. uuid override addresses ExcelJS's old transitive dependency; exports tested with the override.
- `philhealth/backend/server.js`: application factory, auth/API routes, static files.
- `philhealth/backend/db.js`, `demo.js`, `seed.js`, `migrations/*.sql`: database lifecycle and illustrative fixtures.
- `philhealth/backend/events.js`: M1 event dates/circular/ceiling/allocations/revisions/closure.
- `philhealth/backend/modules.js`: M2 providers, requests, amendments and decision history; M8 evidence export.
- `philhealth/backend/workflow.js`, `rules.js`, `routes/schemas.js`: M3 claim encoding, CSV preview/atomic commit, history, payments, reconciliation and permissions.
- `philhealth/backend/finance.js`: M4 shared totals, M5 status thresholds/aging/z-score, M6 moving average forecast and regional projections.
- `philhealth/backend/exceptions.js`: M5 derived exception scan. Returned and denied records join the queue in finance.js.
- `philhealth/backend/server.js` analytics route: M6 scenarios and advisory proportional fund allocation.
- `philhealth/backend/reports.js`: M7 six reports, CSV/XLSX/PDF; all share snapshot totals.
- `philhealth/backend/auth.js`, immutable SQL triggers: M8 sessions, CSRF, login lockout, hash-chain audit.
- `philhealth/backend/metrics.js`: retained operational KPIs and guarded regression utility.
- `philhealth/frontend/js/app.js`, `context.js`, `api.js`, `ui.js`: navigation, event selection, requests, accessible DOM/table/icon helpers and shared modal actions.
- `philhealth/frontend/js/theme.js`: blocking head script for Automatic/Light/Dark, localStorage persistence, live OS changes and cross-tab synchronization.
- `philhealth/frontend/js/dropdowns.js`: shared rounded popover/listbox enhancement over native select values/events, keyboard navigation and dialog support.
- `philhealth/frontend/js/chart.js`, `chart-math.js`: responsive SVG rendering and presentation-only geometry; financial calculations remain on the server.
- `philhealth/frontend/js/views/*.js`: dashboard, claim workflow, settings and remaining module screens.
- `philhealth/frontend/styles/style.css`, `assets/`: tokens, responsive layout, supplied logo, Lucide sprite, favicons.
- `philhealth/backend/test/*.test.js`, `scripts/check-no-emoji*.mjs`: domain/API/security/export/icon and guard checks.
- Root `frontend/` and `backend/data/mock-api.js`: preserved legacy mock prototype. Do not use for financial reporting or authentication. Its decorative symbols were also replaced.
- `AUDIT.md`, `DESIGN.md`, `README.md`: baseline/current audit, contrast evidence and user instructions.

## Condensed source-of-truth specification

Cost centers are event, region, provider and case type on each claim. Regular actual-versus-budget reporting is required.

| Module | Required behavior |
|---|---|
| M1 | Event ID, dates, circular, event ceiling, regional ceilings; sum allocations cannot exceed event ceiling, including revisions |
| M2 | Provider requests, chosen Route A/B, approver, decision timestamp, amendments and append-only decision history |
| M3 | Required Event ID, region, provider, case type, status/history; entry/CSV validation; approved-to-payment matching |
| M4 | Automatically derived committed, paid, remaining, utilization, unpaid and variance |
| M5 | One late/returned/denied/duplicate/unusual/unmatched queue and configurable threshold alerts |
| M6 | Population z-score, aging, moving average, forecast/breach, scenarios and advisory fund allocation |
| M7 | Event-scoped dashboard/trend/regions and six reports in PDF, Excel, CSV |
| M8 | Authenticated role-aware server permissions, append-only audit ledger, viewer and evidence export; read-only auditor |

All amounts are integer centavos in storage and API. UI formats pesos with two decimal places. With B=ceiling, A=approved/committed, P=sum actual payments:

- Remaining = B - A.
- Utilization percent = A / B * 100.
- Paid utilization percent = P / B * 100.
- Approved but unpaid = A - P.
- Variance = A - B; variance percent = (A - B) / B * 100. Negative means under budget.
- For zero ceiling, percentages return zero to avoid non-finite output; nonzero projected commitment still triggers over-ceiling detection.
- Worked illustrative Typhoon Sample: B=PHP50M, A=PHP40M, P=PHP32M; remaining PHP10M, utilization 80% (warning), paid utilization 64%, unpaid PHP8M, variance -PHP10M/-20% (under budget). Stored values multiply pesos by 100.

Statuses: Submitted, Under Review, Approved, Paid, Returned (RTH), Denied, Resubmitted. Preserve legacy extra Reconciled status. Reject duplicate reference or event/provider/token/discharge-date/amount combination, negative/unsafe amounts, invalid calendar dates and filing dates outside event period. Payments cannot exceed the approved unpaid balance; partial payments remain visible.

Six reports: Budget versus Actual Variance, Claims Status Summary, Claims Aging, Exceptions Register, Payment Reconciliation, Regional Summary. Every export includes the same dashboard totals footer. Regional users receive regional totals in both dashboard and exports; national event ceiling stays available in event metadata.

| Technique | Location and declared assumption |
|---|---|
| Variance and ratio | finance.js, exact formulas above |
| Aging | Filing date (or legacy creation date) to configured as-of date; aging threshold configurable |
| Z-score | Population standard deviation within selected event; zero variance returns zero; configurable threshold |
| Moving average | Last three weekly approved commitment amounts; empty weeks zero; eight observed weeks and four projected weeks |
| Scenario | Percentage change to projected future weekly commitments; existing commitments unchanged |
| Allocation | Remaining nonnegative funds distributed proportionally to approved-but-unpaid regional demand; advisory, never automatically applied |

Threshold settings: warning_pct=80, danger_pct=90, critical_pct=100, strictly increasing and configurable by administrator. Normal below warning; warning at/above warning; danger at/above danger; critical at/above critical OR forecast above ceiling. Over-ceiling label when observed utilization is at least 100 or projected ceiling is breached. Regional over-allocation alerts are critical. Alert order is critical, danger, warning. Delivery is dashboard only; explicit future adapter comment in modules.js. Do not implement email/SMS.

## Design system and icons

Current branding: `philhealth/frontend/assets/philhealth-symbol.png`, owner-supplied 900x900 RGBA, copied without modification. Shared `js/brand.js` combines this symbol with live text: PhilHealth (bold) and Your partner in health (smaller italic). SVG viewBox 278 108 358 675 excludes transparent margins without editing or stretching the PNG; the opaque pixel bounds were measured as (284,114)-(630,777). Header symbol is 40x76px; login 46x87px. Keep the white brand surface and dark-green text readable in both themes. Previous wordmark assets are retained unused. Historical palette sampling of the earlier 330x121 asset found yellow #FCD116 (2484 pixels), green #009246 (969). Transparent pixels excluded. See DESIGN.md for contrast ratios.

Current control tokens: --radius-button 12px, --radius-input and --radius-panel alias it; --radius-card 16px. Spacing: --space-1/2/3/4/6/8 = 4/8/12/16/24/32px. Use these tokens for all controls and layout gaps; no hardcoded button radii.

Current colors: brand --primary #006B33, --secondary #FCD116, --accent #009246. Light surfaces are neutral --bg #EEF1F4, --canvas #F8FAFC, --surface #FFFFFF, --surface-raised #EDF1F5, --text #18212B, --muted #52606D, --border #7B8794. Dark surfaces are neutral --bg #101418, --canvas #151B22, --surface #1D2630, --surface-raised #263340, --text #EFF3F7, --muted #C0CAD4, --border #7C8A99. The former green theme is removed. Status colors remain separate and have light/dark foreground/background token pairs. All colors, including charts/messages/hover/focus, come from the stylesheet tokens. See DESIGN.md for current measured pairs.

Theme preference: localStorage phcm-theme stores automatic/light/dark. theme.js runs synchronously before CSS and sets data-theme, data-theme-choice and color-scheme on html. Automatic follows prefers-color-scheme live; explicit choices remain fixed. Do not reintroduce body.dark toggles or blanket svg styles. Dropdowns preserve underlying native select values and change events for existing business forms. The shared enhancement also handles dynamically opened modals.

Only icon library: locally installed `lucide-static` 1.61.0, ISC license copied to assets. Local SVG sprite: icons.svg; circle-check, triangle-alert, circle-alert, octagon-alert and chevron-down. `ui.js` icon() and badge() helpers provide SVGs; decorative SVG gets aria-hidden=true and focusable=false; meaning is conveyed by adjacent visible label, or aria-label for standalone meaningful icons. No Unicode symbol stand-ins or CDNs. Favicons use the supplied logo mark: ICO, embedded-raster SVG, PNG sizes, apple-touch 180px. Maintain aspect ratio.

Accessibility: color plus SVG icon plus visible status text; AA text contrast 4.5:1, large text/UI 3:1; visible focus, semantic controls, labeled inputs, keyboard navigation, skip link, sortable/filterable/paginated/sticky-header tables, empty/error states and destructive confirmation. Charts include text descriptions and exact monetary text. SVG line styling and dash patterns distinguish actual/forecast/ceiling without color alone.

## Rules

- Work on branches, use small commits; never push to main. Current branch: ux-and-module-audit. No push has been performed.
- Never use emojis in UI, code, data, docs, exports or commit messages. Use icons from the chosen icon library only. Run the emoji check before finishing any session.
- Use illustrative data only and label it. Do not enter real patient or PhilHealth figures.
- No email/SMS implementation; preserve extension point.
- Do not delete features without asking. Preserve the legacy prototype, operational KPIs and theme switch.
- Do not rewrite the stack. Add SQL migrations rather than changing applied migrations.
- All reports and dashboard must share snapshot totals and event/region scope.
- Audit log and request histories have no update/delete API; SQL triggers also reject changes. Do not bypass them.
- Do not reset or overwrite user data. Seed is additive; back up before reset.

## Current status

Dropdown highlight follow-up (2026-10-23): menus size to their longest label within the viewport, preventing avoidable multi-line event names. Shared options use a 40px minimum row height, 1px selection border, 2px inset keyboard focus ring and 4px separation; long labels may still wrap on small screens rather than lose content. These values are shared CSS tokens.

Corrected brand asset (2026-10-23): shared brand.js now uses the owner's revised symbol plus live PhilHealth / Your partner in health typography on every header and login. PNG preserved unchanged; transparent padding handled with measured SVG viewBox. Earlier wordmark assets retained but no longer displayed.

Logo follow-up (2026-10-23): replaced shared header/login branding on every tab with the exact owner-supplied high-resolution PNG; transparent image preserved byte-for-byte, accurate intrinsic dimensions and height:auto. Existing theme colors and favicon mark remain unchanged.

UI consistency follow-up (2026-10-23): completed shared 12px controls, rounded/clipped dropdown panels, centered pagination/action groups, neutral persisted Automatic/Light/Dark themes before first paint, responsive SVG amount/date axes and legend, token-based messages/spacing and readable settings/KPI labels. No financial/data behavior changed. Browser: eight Finance tabs in three modes plus Administration/login/regional forms (35 combinations), and final three-theme modal checks; zero checked text-contrast failures. Theme persistence verified in browser; live OS change and blocked-storage behavior covered by isolated tests. Mobile chart measured 368.9px wide by 280px high at a 443px CSS viewport, 12px labels within bounds, scrollWidth=443. All new icons use existing local Lucide. Tests now 23 total.

| Module | Status | Evidence |
|---|---|---|
| M1 | Done | events.js, module view, creation and revision ceiling tests |
| M2 | Done with policy question | modules.js, migrations 004/005, request/decision/amendment tests; official Route A/B criteria absent |
| M3 | Done | workflow.js, schemas, claimError, claims view; validated CSV preview and atomic commit, partial/full payment tests |
| M4 | Done | finance.js financials/snapshot; exact worked-example tests |
| M5 | Done | exceptions.js, snapshot queue/alerts, threshold/aging/z-score tests |
| M6 | Done with declared assumptions | live commitments, moving average/breach, scenarios, proportional advisory allocation; see technique table |
| M7 | Done | eight cards, trend, three regional bars, six report exporters, totals equality tests |
| M8 | Done | server-side roles, CSRF/session protections, immutable hash chain, viewer and complete evidence export |

| Table II item | Status | Reason |
|---|---|---|
| Problem 1 | Missing source | Wording not supplied; cannot map evidence honestly |
| Problem 2 | Missing source | Wording not supplied |
| Problem 3 | Missing source | Wording not supplied |
| Problem 4 | Missing source | Wording not supplied |
| Problem 5 | Missing source | Wording not supplied |

Known issues/open questions: obtain Table II text; confirm Route A/B chains and routing criteria; approve forecasting horizon/population/allocation assumptions before treating them as policy. Legacy seed claims lack some newer provider/date fields and include old illustrative exception rows; new entry is strict. Legacy root prototype intentionally remains mock-only. Audit viewer shows latest 100 records with client pagination; evidence export contains all. PDF is a readable plain-text table export, not an official PhilHealth form. This is a verified local illustrative application, not a production deployment/security certification.

No-emoji migration: 20 emoji/decorative-symbol occurrences found and replaced/removed; zero commit-message occurrences. Final scanner output must stay zero. It scans project text and Unicode escapes, excluding ignored dependencies, Git internals and binary assets. It also scans the complete commit-message history. Guard regression test checks literal, escaped and commit-message cases in a temporary repository.

## Definition of done

- [ ] Run from a fresh terminal using only README; verify localhost login and selected-event dashboard.
- [ ] Run npm test, npm audit and frontend/backend syntax checks; explain any failures.
- [ ] Run the emoji check; no emojis in UI, code, data, docs, exports or commit messages; use only local Lucide icons.
- [ ] Verify formulas, payments, six report totals and regional/event isolation after every financial change.
- [ ] Verify server-side role denial, independent approvals and append-only audit history.
- [ ] Check normal/warning/danger/critical states, mobile/tablet/desktop, both themes, contrast and keyboard controls.
- [ ] Verify local SVG icons, favicon and apple-touch assets work without a CDN.
- [ ] Label all samples illustrative and document policy assumptions without inventing the missing paper.
- [ ] Commit small reviewed changes on a branch, never push to main.
- [ ] Update the Current status section and AUDIT.md at the end of every session.

Update the Current status section and AUDIT.md at the end of every session.
