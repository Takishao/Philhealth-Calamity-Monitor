# PhilHealth Calamity Monitor: continuation guide

## Aiven PostgreSQL migration (active task, started 2026-11-03)

Goal: run this app locally at http://localhost:3000 against the owner's existing Aiven PostgreSQL service. The Aiven service is already set up. Only this app changes. Read `HANDOFF.md` before touching code. It has the folder map, gaps, open questions and the step plan.

Paths:
- Working copy, edit here: `/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor`
- Original, read only: `/Users/takishao/Downloads/Philhealth-Calamity-Monitor-main`. It holds the earlier Aiven docs and scripts to copy from.

Rules for this task:
- The database driver change is the one approved exception to the stack rule below. Keep SQLite as the default driver for tests and offline work (`DB_DRIVER=sqlite`). Add Aiven as `DB_DRIVER=postgres`.
- Work on a new branch `aiven-postgres`. Small commits. Never push to main.
- Use verified TLS with the supplied CA (`ssl: { ca, rejectUnauthorized: true }`). Never disable certificate checks.
- Keep secrets out of Git. `DATABASE_URL` and `AIVEN_CA_CERT_PATH` live in an untracked `.env`. Never print or commit them.
- Do not alter, delete, truncate or reset existing Aiven tables or rows. Add new tables only, with an `app_` prefix, after the owner approves and a backup exists.
- Never run local SQLite migrations or the SQLite demo seed against PostgreSQL. The owner explicitly authorized the separate guarded seed-postgres-demo.js for illustrative testing.
- Do not guess the open field mappings in `HANDOFF.md`. Ask the owner.
- Keep API response shapes, integer centavo amounts and ISO date strings unchanged so the frontend needs no edits.
- Database calls become asynchronous with `pg`. Every caller needs `await`. Use parameterized queries only (`$1`, `$2`).
- Existing tests must keep passing on SQLite. Add PostgreSQL integration tests that skip when `DATABASE_URL` is missing.
- Environment variables: `DATABASE_URL`, `AIVEN_CA_CERT_PATH`, `DB_DRIVER`, `SEED_DEMO`, `PORT`, `HOST`, `TRUST_PROXY`.
- At the end of each session, update the Current status section and `AUDIT.md`.


## Purpose and owner goals

An illustrative local calamity claims and budget monitor, audited against the owner's paper-derived specification. Preserve the Fastify and vanilla JavaScript stack. The database driver change to Aiven PostgreSQL is the one approved exception, see the Aiven section. The owner wants a complete module audit, logo-derived palette, consistent budget condition coloring, usable workflows, reproducible startup and honest evidence. No real PhilHealth or patient data.

## Run, test, build and seed

Repository: `/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor`.
Verified environment: macOS 27.2 Apple silicon, Node 26.8.2, npm 11.19.1. Supported Node 22+.

```sh
cd '/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor'
./start.sh
```

URL: http://localhost:3000. Start script installs locked dependencies if absent, loads philhealth/.env and starts the server. SQLite seeds only when SEED_DEMO=1. PostgreSQL never seeds automatically. Manual: `cd philhealth && npm ci && npm run seed && npm start`. No build step. Native frontend modules are served directly.

Demo usernames: `cfb` (Central Finance), `act` (accounting), `exe` (executive approver), `aud` (read-only auditor), `adm` (administrator), `ros_iva`, `ros_vii`, `ros_xi` (regional staff), `rvp_vii` (regional approver). All passwords: `demo1234`. Illustrative local credentials only.

```sh
cd '/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor'/philhealth
npm test
npm run check:emoji
npm audit
```

Tests: 22 domain/API/presentation tests plus 1 isolated guard regression test (23 total). Test databases are in memory. No-emoji scan runs before all tests. Schema changes are sequential SQL migrations. Do not modify applied migrations. Local database is ignored by Git.

Reset: stop server, move `philhealth/backend/data/calamity.db` and any `-wal`/`-shm` companions to a backup directory, then run `./start.sh`. Do not delete real data. Seed is additive and never resets existing records. Demo as-of date defaults to 2026-10-15, adjustable by `adm`. New activity after that date requires a deliberate as-of-date update for forecasting/aging.

`.env.example` lists optional shell variables. Node loads the untracked philhealth/.env using --env-file-if-exists. There is no dotenv dependency. `PORT=3000`, `HOST=127.0.0.1`. `TRUST_PROXY=1` only behind a trusted proxy. Local Secure cookies require localhost (127.0.0.1 browser visits redirect). The frontend is not the legacy Live Server prototype.

## Stack and folder map

- `philhealth/package.json`, lockfile: Fastify 5, better-sqlite3, Argon2, Zod, csv-parse, ExcelJS, PDFKit, lucide-static. uuid override addresses ExcelJS's old transitive dependency. Exports tested with the override.
- `philhealth/backend/server.js`: application factory, auth/API routes, static files.
- `philhealth/backend/db.js`, `demo.js`, `seed.js`, `migrations/*.sql`: database lifecycle and illustrative fixtures.
- `philhealth/backend/events.js`: M1 event dates/circular/ceiling/allocations/revisions/closure.
- `philhealth/backend/modules.js`: M2 providers, requests, amendments and decision history. M8 evidence export.
- `philhealth/backend/workflow.js`, `rules.js`, `routes/schemas.js`: M3 claim encoding, CSV preview/atomic commit, history, payments, reconciliation and permissions.
- `philhealth/backend/finance.js`: M4 shared totals, M5 status thresholds/aging/z-score, M6 moving average forecast and regional projections.
- `philhealth/backend/exceptions.js`: M5 derived exception scan. Returned and denied records join the queue in finance.js.
- `philhealth/backend/server.js` analytics route: M6 scenarios and advisory proportional fund allocation.
- `philhealth/backend/reports.js`: M7 six reports, CSV/XLSX/PDF. All share snapshot totals.
- `philhealth/backend/auth.js`, immutable SQL triggers: M8 sessions, CSRF, login lockout, hash-chain audit.
- `philhealth/backend/metrics.js`: retained operational KPIs and guarded regression utility.
- `philhealth/frontend/js/app.js`, `context.js`, `api.js`, `ui.js`: navigation, event selection, requests, accessible DOM/table/icon helpers and shared modal actions.
- `philhealth/frontend/js/theme.js`: blocking head script for Automatic/Light/Dark, localStorage persistence, live OS changes and cross-tab synchronization.
- `philhealth/frontend/js/dropdowns.js`: shared rounded popover/listbox enhancement over native select values/events, keyboard navigation and dialog support.
- `philhealth/frontend/js/chart.js`, `chart-math.js`: responsive SVG rendering and presentation-only geometry. Financial calculations remain on the server.
- `philhealth/frontend/js/views/*.js`: dashboard, claim workflow, settings and remaining module screens.
- `philhealth/frontend/styles/style.css`, `assets/`: tokens, responsive layout, supplied logo, Lucide sprite, favicons.
- `philhealth/backend/test/*.test.js`, `scripts/check-no-emoji*.mjs`: domain/API/security/export/icon and guard checks.
- Root `frontend/` and `backend/data/mock-api.js`: preserved legacy mock prototype. Do not use for financial reporting or authentication. Its decorative symbols were also replaced.
- `AUDIT.md`, `DESIGN.md`, `README.md`: baseline/current audit, contrast evidence and user instructions.

## Condensed source-of-truth specification

Cost centers are event, region, provider and case type on each claim. Regular actual-versus-budget reporting is required.

| Module | Required behavior |
|---|---|
| M1 | Event ID, dates, circular, event ceiling, regional ceilings. Sum allocations cannot exceed event ceiling, including revisions |
| M2 | Provider requests, chosen Route A/B, approver, decision timestamp, amendments and append-only decision history |
| M3 | Required Event ID, region, provider, case type, status/history. Entry/CSV validation. Approved-to-payment matching |
| M4 | Automatically derived committed, paid, remaining, utilization, unpaid and variance |
| M5 | One late/returned/denied/duplicate/unusual/unmatched queue and configurable threshold alerts |
| M6 | Population z-score, aging, moving average, forecast/breach, scenarios and advisory fund allocation |
| M7 | Event-scoped dashboard/trend/regions and six reports in PDF, Excel, CSV |
| M8 | Authenticated role-aware server permissions, append-only audit ledger, viewer and evidence export. Read-only auditor |

All amounts are integer centavos in storage and API. UI formats pesos with two decimal places. With B=ceiling, A=approved/committed, P=sum actual payments:

- Remaining = B - A.
- Utilization percent = A / B * 100.
- Paid utilization percent = P / B * 100.
- Approved but unpaid = A - P.
- Variance = A - B. Variance percent = (A - B) / B * 100. Negative means under budget.
- For zero ceiling, percentages return zero to avoid non-finite output. Nonzero projected commitment still triggers over-ceiling detection.
- Worked illustrative Typhoon Sample: B=PHP50M, A=PHP40M, P=PHP32M. Remaining PHP10M, utilization 80% (warning), paid utilization 64%, unpaid PHP8M, variance -PHP10M/-20% (under budget). Stored values multiply pesos by 100.

Statuses: Submitted, Under Review, Approved, Paid, Returned (RTH), Denied, Resubmitted. Preserve legacy extra Reconciled status. Reject duplicate reference or event/provider/token/discharge-date/amount combination, negative/unsafe amounts, invalid calendar dates and filing dates outside event period. Payments cannot exceed the approved unpaid balance. Partial payments remain visible.

Six reports: Budget versus Actual Variance, Claims Status Summary, Claims Aging, Exceptions Register, Payment Reconciliation, Regional Summary. Every export includes the same dashboard totals footer. Regional users receive regional totals in both dashboard and exports. National event ceiling stays available in event metadata.

| Technique | Location and declared assumption |
|---|---|
| Variance and ratio | finance.js, exact formulas above |
| Aging | Filing date (or legacy creation date) to configured as-of date. Aging threshold configurable |
| Z-score | Population standard deviation within selected event. Zero variance returns zero. Configurable threshold |
| Moving average | Last three weekly approved commitment amounts. Empty weeks zero. Eight observed weeks and four projected weeks |
| Scenario | Percentage change to projected future weekly commitments. Existing commitments unchanged |
| Allocation | Remaining nonnegative funds distributed proportionally to approved-but-unpaid regional demand. Advisory, never automatically applied |

Threshold settings: warning_pct=80, danger_pct=90, critical_pct=100, strictly increasing and configurable by administrator. Normal below warning. Warning at/above warning. Danger at/above danger. Critical at/above critical OR forecast above ceiling. Over-ceiling label when observed utilization is at least 100 or projected ceiling is breached. Regional over-allocation alerts are critical. Alert order is critical, danger, warning. Delivery is dashboard only. Explicit future adapter comment in modules.js. Do not implement email/SMS.

## Design system and icons

Current branding: `philhealth/frontend/assets/philhealth-symbol-3d.png`, owner-supplied 900x900 RGBA, copied without modification. Shared `js/brand.js` combines this symbol with live text: PhilHealth (bold) and Your partner in health (smaller text). SVG viewBox 278 108 358 675 excludes transparent margins without editing or stretching the PNG. The opaque pixel bounds were measured as (284,114)-(630,777). Header symbol is 45x85px. Login 56x106px. Browser favicon/ICO/PNG/apple-touch exports use a simplified two-figure brand mark, with versioned links. Frontend assets revalidate with Cache-Control:no-cache. The brand has no background panel. Live text uses dark green in Light and near-white in Dark. The tagline sits below the name with an 8px gap. Keep both text lines theme-aware. Previous wordmark assets are retained unused. Historical palette sampling of the earlier 330x121 asset found yellow #FCD116 (2484 pixels), green #009246 (969). Transparent pixels excluded. See DESIGN.md for contrast ratios.

Current control tokens: --radius-button 12px, --radius-input and --radius-panel alias it. --radius-card 16px. Spacing: --space-1/2/3/4/6/8 = 4/8/12/16/24/32px. Use these tokens for all controls and layout gaps. No hardcoded button radii.

Current colors: brand --primary #006B33, --secondary #FCD116, --accent #009246. Light surfaces are neutral --bg #EEF1F4, --canvas #F8FAFC, --surface #FFFFFF, --surface-raised #EDF1F5, --text #18212B, --muted #52606D, --border #7B8794. Dark surfaces are neutral --bg #101418, --canvas #151B22, --surface #1D2630, --surface-raised #263340, --text #EFF3F7, --muted #C0CAD4, --border #7C8A99. The former green theme is removed. Status colors remain separate and have light/dark foreground/background token pairs. All colors, including charts/messages/hover/focus, come from the stylesheet tokens. See DESIGN.md for current measured pairs.

Theme preference: localStorage phcm-theme stores automatic/light/dark. theme.js runs synchronously before CSS and sets data-theme, data-theme-choice and color-scheme on html. Automatic follows prefers-color-scheme live. Explicit choices remain fixed. Do not reintroduce body.dark toggles or blanket svg styles. Dropdowns preserve underlying native select values and change events for existing business forms. The shared enhancement also handles dynamically opened modals.

Only icon library: locally installed `lucide-static` 1.61.0, ISC license copied to assets. Local SVG sprite: icons.svg. Circle-check, triangle-alert, circle-alert, octagon-alert and chevron-down. `ui.js` icon() and badge() helpers provide SVGs. Decorative SVG gets aria-hidden=true and focusable=false. Meaning is conveyed by adjacent visible label, or aria-label for standalone meaningful icons. No Unicode symbol stand-ins or CDNs. Favicons use the supplied logo mark: ICO, vector SVG, PNG sizes, apple-touch 180px. Maintain aspect ratio.

Accessibility: color plus SVG icon plus visible status text. AA text contrast 4.5:1, large text/UI 3:1. Visible focus, semantic controls, labeled inputs, keyboard navigation, skip link, sortable/filterable/paginated/sticky-header tables, empty/error states and destructive confirmation. Charts include text descriptions and exact monetary text. SVG line styling and dash patterns distinguish actual/forecast/ceiling without color alone.

## Rules

- Work on branches, use small commits. Never push to main. Current branch: aiven-postgres. No push has been performed.
- Never use emojis in UI, code, data, docs, exports or commit messages. Use icons from the chosen icon library only. Run the emoji check before finishing any session.
- Use illustrative data only and label it. Do not enter real patient or PhilHealth figures.
- No email/SMS implementation. Preserve extension point.
- Do not delete features without asking. Preserve the legacy prototype, operational KPIs and theme switch.
- Do not rewrite the stack. The Aiven PostgreSQL driver is the only approved exception. Add SQL migrations rather than changing applied migrations.
- All reports and dashboard must share snapshot totals and event/region scope.
- Audit log and request histories have no update/delete API. SQL triggers also reject changes. Do not bypass them.
- Do not reset or overwrite user data. Seed is additive. Back up before reset.

## Current status

### Windows ECONNRESET recovery (2026-11-04)

Owner screenshot showed PostgreSQL startup succeeded, followed by an unhandled pg Client error event (read ECONNRESET) that terminated Node and caused browser Failed to fetch. Added idle error listeners, TCP keepalive and a ten-second connection timeout. The runtime marks dropped connections unavailable, returns HTTP 503 for interrupted requests and reconnects only before the next transaction. Interrupted writes and commits are never replayed. A commit interrupted by a network reset can have an uncertain outcome, so users must check history before resubmitting payments. No certificate verification bypass. Exact network-reset cause and Windows execution remain unverified.

Regression tests cover idle reset recovery and ensure interrupted writes/commits are never replayed. Default tests pass 33 checks with the live PostgreSQL suite skipped. Explicit Aiven integration passes all 14 tests, including unchanged native business rows.

### Windows starter (2026-11-04)

Added root start.bat beside start.sh. It quotes the project path, checks Node 22.9+ and npm.cmd, installs locked dependencies if absent or if copied native modules cannot load, then calls npm start. Errors stay visible in the console. No migration or PostgreSQL seeding runs. README includes Windows setup, configuration and stopping instructions.

The ignored philhealth/.env now references the same supplied CA using the portable ../ca.pem path. Verified a fresh connection to the existing Aiven defaultdb with TLS and rejectUnauthorized=true. The local server was stopped when checked and was left stopped. Version boundary cases (20.19, 22.8, 22.9, 24 and 26) and the native-module preflight passed on macOS. Actual Windows command execution is untested because no Windows runtime is available. No database rows changed.

### Dependency and runtime risk fixes (2026-11-03)

Completed the owner's requested dependency/risk review. Clean npm ci and npm audit now report zero vulnerabilities (previously 1 high and 8 moderate). Zod is 4.6.7 and Fastify 5.12.8. ExcelJS 4.4.0 and its compatible Archiver 5 stay in place; tested overrides upgrade glob 14.0.3, minimatch 11.0.4 and unzipper 0.12.5. Recursive ZIP matching and both document/streaming Excel round trips pass. No advisory suppression or unrelated native major upgrades.

Fixed static path/symlink containment and directory responses, independent transaction ownership/queue cleanup using AsyncLocalStorage, and conflicting TLS URL flags. Inspection and validation helpers now share the verified client; inspection explicitly uses a read-only transaction. Migration application requires the backup manifest checksum.

The previous restore limitation is resolved for the application snapshot: work/backups/aiven-2026-11-03T15-35-12.482Z.dump was restored into a new temporary database. Clone login, PHCM-DEMO totals and application audit chain passed. The clone was removed and absence verified. No original service data was reset. All 107 original business row hashes across 16 native tables remain unchanged.

Verification: 31 default tests pass with one live suite skipped; explicit Aiven tests pass 14. New regressions cover archive matching, streaming Excel, path/symlink denial, independent/nested transactions, failed BEGIN cleanup, forced verified TLS and backup checksum rejection. Clean-install lockfile checks pass. Runtime remains localhost testing only. Native legacy audit canonicalization and production concurrency/load remain outside the verified scope. Details and commands: philhealth/docs/risk-review-2026-11-03.md.

### PostgreSQL testing runtime completed (2026-11-03)

Owner approved the proposed sidecars and confirmed pesos, role translation, claim/service/filed date mappings and case_type. Owner requested demo/testing records. Dedicated PostgreSQL fixtures created nine demo_* accounts and four labeled PHCM-* events without resetting existing data. Initial application reporting date is 2026-11-03. Local server runs at http://localhost:3000 using ignored philhealth/.env with DB_DRIVER=postgres, SEED_DEMO=0 and verified CA TLS. SQLite remains the code default and all in-memory tests force SQLite.

Implemented async database callers across auth, events, workflow, finance, exceptions, modules, reports, metrics, rules and server. Local request transactions serialize writes and commit before responses. Migration 002 adds app-owned sidecars, compatibility views and guarded native writes. Migration 003 exposes the existing native audit ledger separately at /api/audit/legacy without claiming hash verification. Existing security tables are reused. No applied migration was edited. Native money remains exact decimal pesos and the API remains safe integer centavos. Payment reversals subtract from paid totals. New requests/settings/derived exceptions/application audit have separate app-owned storage. Read philhealth/docs/aiven-postgresql-integration.md for these boundaries.

Pre-existing native events are read-only through the bridge. Only app_owned_events can receive business mutations. Native original rows are unchanged: server-side row hashes verified all 107 original rows across 16 business tables after migration and testing. No existing user passwords were changed. New demo login: demo_cfb / demo1234, with role variants documented in README. Existing legacy audit canonicalization is still unconfirmed, so the application ledger remains separate.

Backups: original pre-migration custom archive plus refreshed public-schema archive work/backups/aiven-2026-11-03T15-20-08.629Z.dump, with manifest and listing. pg_restore listing and full decoding passed, files are owner-only and ignored. Isolated restoration has not been tested. Repeatable backup command: node --env-file=.env backend/backup-postgres.js from philhealth/.

Validation: SQLite/default npm test passes 24 checks with one live PostgreSQL suite skipped (23 main tests including SQL translation plus the separate guard regression). Explicit PostgreSQL run passes 14 tests including its parent/subtests. It covers nine mapped logins, CSRF, lockout, regional isolation, exact 12345-centavo/123.45-peso storage, transitions, partial/full payments, reconciliation, CSV preview and full rollback after a native failure, settings, allocation revision approval, request history, six reports in all three formats, audit immutability and unchanged native rows. Syntax checks passed for all 39 backend/frontend JavaScript files. No-emoji scan and git diff --check passed. Browser login, existing and testing dashboards and event selection passed. Mobile 390px and desktop were smoke-checked. Initial unauthenticated /api/me 401 is expected.

Known limits: one serialized connection is for local testing, not production scaling. Native legacy audit chain is not verified. Existing native exception review outcomes and privilege requests remain separate from the app-owned workflows. npm audit reports 9 vulnerabilities (8 moderate, 1 high) in the existing ExcelJS/minimatch and Zod dependency chains. Breaking dependency upgrades were not applied. No push or deployment.

### Aiven read-only verification (2026-11-03)

Continued on existing `aiven-postgres` branch without discarding uncommitted preparation. Supplied root `ca.pem` parses successfully and is Git-ignored. Existing untracked `philhealth/.env` allowed `npm run db:inspect` to complete with CA verification enabled. No credentials are recorded here.

Live schema differs from the handoff baseline: `app_sessions`, `app_login_attempts`, `providers`, `request_approvals`, `role_permissions` and `import_batches` already exist. Do not apply the security migration blindly. Read-only schema output is in ignored `work/aiven-schema.json`. Constraint and view definitions were captured in `work/aiven-definitions.json` using an explicit read-only transaction. Counts: 9 users, 7 roles, 1 event, 8 claims, 5 payments and 3 exceptions. No Aiven rows or schema were changed.

Live claim constraints allow SUBMITTED, UNDER_REVIEW, APPROVED, PAID, RECONCILED, RETURNED, DENIED, RESUBMITTED and CANCELLED. Event statuses are ACTIVE and CLOSED. Payments have PAYMENT and REVERSAL entry types, with reversal links required. These constraints establish allowed values, not approved application transitions.

Owner answers are still required for monetary units, role translation, service/discharge date semantics, missing-field storage, audit canonicalization, and approval plus backup before any additive tables. A known test account is also needed for password compatibility checks. Runtime remains SQLite until mappings and integration tests are complete.

Transparent branding follow-up (2026-10-23): copied the latest attached 900x900 RGBA symbol exactly. Removed the white brand panel globally. PhilHealth and the lower tagline now adapt to Light/Dark via logo tokens. Shared header/login and legacy mock display are updated.

Logo completion (2026-10-23): corrected the missed browser-tab/apple-touch icons to the revised 3D mark, enlarged the shared symbol, and added versioned asset/module/style links plus static no-cache revalidation to prevent stale branding. Original supplied PNG retained unchanged.

Dropdown highlight follow-up (2026-10-23): menus size to their longest label within the viewport, preventing avoidable multi-line event names. Shared options use a 40px minimum row height, 1px selection border, 2px inset keyboard focus ring and 4px separation. Long labels may still wrap on small screens rather than lose content. These values are shared CSS tokens.

Corrected brand asset (2026-10-23): shared brand.js now uses the owner's revised symbol plus live PhilHealth / Your partner in health typography on every header and login. PNG preserved unchanged. Transparent padding handled with measured SVG viewBox. Earlier wordmark assets retained but no longer displayed.

Logo follow-up (2026-10-23): replaced shared header/login branding on every tab with the exact owner-supplied high-resolution PNG. Transparent image preserved byte-for-byte, accurate intrinsic dimensions and height:auto. Existing theme colors and favicon mark remain unchanged.

UI consistency follow-up (2026-10-23): completed shared 12px controls, rounded/clipped dropdown panels, centered pagination/action groups, neutral persisted Automatic/Light/Dark themes before first paint, responsive SVG amount/date axes and legend, token-based messages/spacing and readable settings/KPI labels. No financial/data behavior changed. Browser: eight Finance tabs in three modes plus Administration/login/regional forms (35 combinations), and final three-theme modal checks. Zero checked text-contrast failures. Theme persistence verified in browser. Live OS change and blocked-storage behavior covered by isolated tests. Mobile chart measured 368.9px wide by 280px high at a 443px CSS viewport, 12px labels within bounds, scrollWidth=443. All new icons use existing local Lucide. Tests now 23 total.

| Module | Status | Evidence |
|---|---|---|
| M1 | Done | events.js, module view, creation and revision ceiling tests |
| M2 | Done with policy question | modules.js, migrations 004/005, request/decision/amendment tests. Official Route A/B criteria absent |
| M3 | Done | workflow.js, schemas, claimError, claims view. Validated CSV preview and atomic commit, partial/full payment tests |
| M4 | Done | finance.js financials/snapshot. Exact worked-example tests |
| M5 | Done | exceptions.js, snapshot queue/alerts, threshold/aging/z-score tests |
| M6 | Done with declared assumptions | live commitments, moving average/breach, scenarios, proportional advisory allocation. See technique table |
| M7 | Done | eight cards, trend, three regional bars, six report exporters, totals equality tests |
| M8 | Done | server-side roles, CSRF/session protections, immutable hash chain, viewer and complete evidence export |

| Table II item | Status | Reason |
|---|---|---|
| Problem 1 | Missing source | Wording not supplied. Cannot map evidence honestly |
| Problem 2 | Missing source | Wording not supplied |
| Problem 3 | Missing source | Wording not supplied |
| Problem 4 | Missing source | Wording not supplied |
| Problem 5 | Missing source | Wording not supplied |

Known issues/open questions: obtain Table II text. Confirm Route A/B chains and routing criteria. Approve forecasting horizon/population/allocation assumptions before treating them as policy. Legacy seed claims lack some newer provider/date fields and include old illustrative exception rows. New entry is strict. Legacy root prototype intentionally remains mock-only. Audit viewer shows latest 100 records with client pagination. Evidence export contains all. PDF is a readable plain-text table export, not an official PhilHealth form. This is a verified local illustrative application, not a production deployment/security certification.

No-emoji migration: 20 emoji/decorative-symbol occurrences found and replaced/removed. Zero commit-message occurrences. Final scanner output must stay zero. It scans project text and Unicode escapes, excluding ignored dependencies, Git internals and binary assets. It also scans the complete commit-message history. Guard regression test checks literal, escaped and commit-message cases in a temporary repository.

## Definition of done

- [ ] Run from a fresh terminal using only README. Verify localhost login and selected-event dashboard.
- [ ] Run npm test, npm audit and frontend/backend syntax checks. Explain any failures.
- [ ] Run the emoji check. No emojis in UI, code, data, docs, exports or commit messages. Use only local Lucide icons.
- [ ] Verify formulas, payments, six report totals and regional/event isolation after every financial change.
- [ ] Verify server-side role denial, independent approvals and append-only audit history.
- [ ] Check normal/warning/danger/critical states, mobile/tablet/desktop, both themes, contrast and keyboard controls.
- [ ] Verify local SVG icons, favicon and apple-touch assets work without a CDN.
- [ ] Label all samples illustrative and document policy assumptions without inventing the missing paper.
- [ ] Commit small reviewed changes on a branch, never push to main.
- [ ] Update the Current status section and AUDIT.md at the end of every session.

Update the Current status section and AUDIT.md at the end of every session.

Header and favicon follow-up (2026-10-23): removed visible Event and Theme labels and account role text. Both accessible dropdowns remain. Login has no theme selector. Browser icons use a simplified two-figure brand mark with larger shapes for small sizes. The full supplied logo stays in header and login.

- Use friendly, direct, clear sentences and instructions. Avoid em dashes and semicolons in prose. Keep required programming syntax intact.

Transparent tab icon (2026-10-23): removed the white background from SVG, ICO and PNG browser icons. Increased the mark size by about 7 percent within the fixed browser icon area. Versioned asset links refresh cached icons. PNG corner alpha verified as zero.

Condition column alignment (2026-10-23): event condition cells use a shared grid with a 132px badge track, a 7ch right-aligned percentage track and a 12px gap. Tabular numerals align percentages across rows. Existing status icons, colors and labels remain.

Login copy cleanup (2026-10-23): removed the visible demo credentials hint below the login title at the owner's request. Demo login instructions remain in README. Authentication is unchanged.

Analytics spacing (2026-10-23): added a 24px token-based gap between the scenario form and its results. Calculation and data handling stay unchanged.

Validation for this continuation: all 23 SQLite tests passed, emoji scan found zero occurrences, both Aiven preparation scripts passed node --check, and git diff --check passed. npm audit reports 9 vulnerabilities (8 moderate, 1 high), including minimatch transitively through ExcelJS and Zod. Suggested fixes include breaking dependency changes and were not applied. Browser and PostgreSQL runtime workflow tests were not run.

### Owner confirmations and backup (2026-11-03)

Owner confirmed Aiven money is pesos, role translation CENTRAL_FIN/REGIONAL_STAFF/REGIONAL_VP/PRESIDENT/TREASURY/AUDITOR/ADMIN to CFB/ROS/RVP/EXE/ACT/AUD/ADM, service_date as discharge date, and filed_date as filing date. Role translation may be revised later. API amounts remain integer centavos. Owner authorized creating a backup.

Created a custom-format pg_dump backup at ignored work/backups/aiven-2026-11-03T14-51-23.610Z.dump using verify-full TLS and the supplied CA. File permissions are 0600. Size 77,218 bytes. SHA-256: 9367c1f52efc9246ec9662b4a42b35554687e0d82cfe7afcc5c3771d2133ee6f. pg_restore --list and full decoding to /dev/null both succeeded. This verifies archive readability, not restoration into a separate database. No remote data or schema changed.

Remaining decisions are described in philhealth/docs/aiven-storage-proposal.md. No new app_ tables are approved or applied yet. Audit serialization compatibility is unresolved.

### Verified health and loading update (2026-11-20)

Current folder is the Personal Workspace copy on branch aiven-postgres. Started successfully against Aiven with verified TLS. All nine supplied demo roles authenticated. Finance screens and regional claim-entry forms loaded. Live PHCM-DEMO dashboard/report totals match the worked example, all 18 report exports returned successfully and application audit chain verified. Automated tests: 35 passed, 0 failed, 1 live write suite skipped. npm audit and emoji check report zero findings. No live business records were submitted during verification. Normal login session/audit writes occurred.

Loading fix: public static assets skip database hooks, authenticated event dropdown requests use summary=1 metadata, and Events reuses its fetched full financial list. API auth/CSRF/transactions and calculations stay unchanged. Single before/after timings: dropdown 2120 to 308ms, CSS 278 to 5ms. Full Events financial request remains about 2 seconds. Aiven console shows Developer-1 with 1 CPU, 1 GB RAM, 8 GB storage in Singapore. CPU saturation was not measured. No Aiven settings or schema changed. Regression tests cover protected lightweight metadata and static database bypass. Legacy handoff entries remain historical, not current status.

### User workflow and private publication (2026-11-20)

Added USER_WORKFLOW.md with all nine demo roles, actual claim/request/budget approval rules, centavo examples, CSV validation, payment history, reports and current UI limits. README links the guide. GitHub publication excludes private environment files, CA files, live databases and backups. Repository collaboration does not assign application roles.
