# Audit

## Baseline before feature changes
All tracked source, migrations, tests, styles, HTML, assets, package metadata and legacy prototype files reviewed. Dependencies excluded. Five baseline tests pass. Logo exists at philhealth/frontend/assets/philhealth-seal.png.

| Module | Baseline | Evidence and gap |
|---|---|---|
| M1 | Partial | backend/events.js registerEventRoutes: ceiling validation at creation, but dates/circular missing and revision approval bypasses ceiling |
| M2 | Missing | No provider request/Route A/B approval model |
| M3 | Partial | workflow.js registerWorkflowRoutes: claims/history/payment exist. Import commits immediately, lacks event-period validation and required provider |
| M4 | Partial | server.js dashboard route: P incorrectly derived from approved amounts. Variance reversed. Currency centavos shown as pesos |
| M5 | Partial | exceptions.js scanExceptions: aging/z-score/mismatch. Stale exceptions, no returned/denied queue or dashboard threshold alerts |
| M6 | Partial | server.js analytics: fixed series and fabricated scenario/Monte Carlo/LP claims. Metrics.js regression lacks empty-series guard |
| M7 | Partial | dashboard.js and reports.js: four KPIs, first event only, one CSV. No six reports/PDF/Excel/trend |
| M8 | Partial | auth.js appendAudit and SQL immutable triggers exist. Viewer hides records. Role restrictions inconsistent |

Paths above are under philhealth/. Root prototype has mock credentials and fixed figures and is not the maintained app.

## Table II Problems 1–5
The prompt does not include Table II's five problem statements. All five are **Unverifiable**, not invented mappings. Supply Table II to determine Y/N/Partial with evidence.

| Problem | Implemented? | Evidence |
|---|---|---|
| 1 | Unknown | Statement absent |
| 2 | Unknown | Statement absent |
| 3 | Unknown | Statement absent |
| 4 | Unknown | Statement absent |
| 5 | Unknown | Statement absent |

## Formula review
server.js dashboard/reports and reports.js CSV use B−A as variance instead of A−B. dashboard/regions derive P from approved amounts rather than payment records. Reconciled claims inconsistently excluded from reports/analytics. Currency output omits centavo conversion. Warning hardcoded at .8. Danger missing. Exact 100% incorrectly not critical. Forecast not based on claims. Metrics exception counts not event scoped. Zero ceiling division unsafe. Exceptions use population z-score. Aging uses configured as-of date. No official scenario or allocation formula supplied. Assumptions must be explicit.

## UX review
Logo absent in maintained login/header. Low contrast muted/table text. Placeholders instead of exception/audit/report screens. No persistent event selector. No threshold markers. Missing chart, destructive confirmations, import preview, pagination and comprehensive role workflows. Mobile navigation scrolls but tables need accessible controls.

## Priority plan
1. Reproducible startup and baseline browser check.
2. Shared financial calculations, selected-event scope, validation and role safety.
3. Logo sampling, accessible tokens, dashboard and report views.
4. Requests/history, import preview, forecasting, exports and regression tests.
5. Browser checks, four state screenshots and agent handoff.

## Open questions
Table II statements absent. Route A/B routing criteria and approver chains unspecified: record chosen route and decisions without inventing policy. Forecast horizon/weekly grouping, z-score population and allocation objective require declared illustrative assumptions. Preserve internal Reconciled and Returned (RTH) legacy statuses, display returned clearly. Integer currency is centavos.

## Current implementation after audit fixes

| Module | Current | Implementation evidence |
|---|---|---|
| M1 | Done | events.js registerEventRoutes: date/circular validation, allocations and revised allocation ceiling. Module view event/revision forms |
| M2 | Done with policy question | modules.js registerModuleRoutes: providers, requests, immutable amendments and decisions. Chosen Route A/B recorded. Official chains unspecified |
| M3 | Done | workflow.js registerWorkflowRoutes, finance.js claimError: required cost centers/dates, duplicate rejection, CSV preview/atomic revalidation, payment matching and history |
| M4 | Done | finance.js financials/snapshot: exact B/A/P formulas with centavo storage and peso display |
| M5 | Done | exceptions.js scanExceptions and snapshot: event-scoped unusual/aging/unmatched queue plus returned/denied. Configurable dashboard alerts |
| M6 | Done with assumptions | snapshot weekly forecast, server analytics scenarios and advisory allocation. Technique assumptions documented in AGENTS.md |
| M7 | Done | dashboard.js eight KPIs/trend/regional comparison. Reports.js reportRows/registerReportRoutes: all six PDF/XLSX/CSV exports share totals |
| M8 | Done | auth.js appendAudit/attachAuth, SQL immutable triggers, server role guards, audit viewer and complete JSON evidence |

Table II Problems 1-5 remain unverifiable because their statements were not supplied. No implementation mapping has been invented.

Formula mismatches listed in the baseline are corrected. Retained metrics.js exception counts are now event/region scoped and regression handles empty/single-point inputs. Status includes legacy Reconciled, consistently committed. P always comes from payments in the shared financial projection. No simulated Monte Carlo or optimization result is presented as a real computation.

### Icon policy follow-up

20 emoji/decorative-symbol occurrences were replaced or removed, including legacy prototype indicators, arrow separators and close-button glyphs. Existing commit-message scan found zero. Lucide static SVG is the single local icon library. Status helpers combine icon, text and color. Logo-derived favicon assets and apple-touch icon are linked in both HTML heads. Automated no-emoji check runs first in npm test, with an isolated regression test for literal/escaped symbols and commit messages. No CDN dependency.

### Verification and practical limits

20 domain/API tests plus one guard regression test pass. Includes 18 report export combinations, formula example, threshold inclusivity/configuration, duplicates/dates/allocations, CSV preview, partial/full payments, regional isolation, read-only auditor, immutable histories and logo/icon asset delivery. Dependency audit reports zero known vulnerabilities. Design token contrast measurements are in DESIGN.md. Browser measurements show no page-level horizontal overflow at tested responsive widths. Real browser screenshots document four conditions. Full production security, official forms and policy validation are outside this local illustrative run.

Remaining questions: missing Table II statements. Official Route A/B criteria/chains. Acceptance of declared moving-average horizon and fund-allocation assumptions. Legacy demo claims lacking provider/date metadata are preserved, not silently rewritten. New claims require those fields. Audit viewer displays latest 100 records. Full evidence download includes all. PDF export is plain-text tabular presentation. Seed as-of date is explicit and configurable.

Final browser evidence: measured CSS viewport widths 325, 640 and 1200 pixels, each with document scrollWidth equal to viewport width. One, two and four KPI columns respectively. Native screenshots show normal/warning/danger/critical states using local Lucide SVGs. Light dashboard: 89 visible text checks, zero contrast failures. Dark critical dashboard: 91, zero failures. These are focused checks, not a comprehensive accessibility certification. Favicon/icon assets are covered by HTTP content-type tests. Loading uses a visible status message and aria-busy. Failed requests retain actionable error text.

## UI consistency follow-up - 2026-10-23

Initial structure: maintained vanilla JS frontend, Fastify API/SQLite. Style.css was a cascade of overlapping historical overrides. ui.js owns table/pagination/icon/field helpers. Native selects were scattered across shared header/forms/modals. app.js only toggled body.dark without persistence or OS integration. Dashboard chart was inline SVG in views/dashboard.js.

Findings and fixes:
- Shared 12px button/input/panel radius. Native OS option panels could not be reliably rounded, so all maintained selects now share one local popover/listbox enhancement preserving original select values/change events. Panels clip their scrolling/highlight layers. Options, triggers, modal controls and file-input buttons use the radius token.
- Pagination used align-items:end: 20px labels sat below centers of 40px buttons. Shared pagination/button-group/modal-action flex rows now center all controls. Header controls also align at the same center. Confirmed modal buttons share y and height.
- Replaced the temporary green body.dark toggle and contradictory color overrides with neutral token themes. Automatic/Light/Dark persists to localStorage, resolves before first paint, and responds to OS/cross-tab preference changes. No new dependencies.
- Chart console was clean and dimensions were nonzero. Root presentation faults were a fixed 800-unit SVG with shrinking 15-unit labels, absent amount axis, fixed point placement and hardcoded colors plus broad SVG dark-theme background overrides. Replaced with container-observed, 280px-high SVG, fixed-readable 12px amount/date labels, dynamic point placement, exact-value titles, dash-pattern legend and theme tokens. Flat illustrative data remains flat, explained in copy. Backend totals/forecasts/data are untouched.
- Consolidated spacing on 4/8/12/16/24/32px tokens. Standardized helper/empty/loading/error/toast styles, fixed singular record wording, clarified import/allocation instructions, labeled operational KPIs and settings in plain language, grouped CSV/modal actions.

Verification: 23 passing automated tests (22 domain/API/presentation plus one guard regression), no-emoji check, syntax checks. Browser: eight Finance tabs in Light/Dark/Automatic (24 combinations), Administrator/login/regional claim/import in all modes (9), initial two extra modal combinations (35 records), plus final three-mode modal alignment checks. Zero checked text-contrast failures. Console clean. Browser explicit theme persistence verified. Unit tests simulate live OS changes, explicit override, cross-tab events, invalid preference and blocked storage. Mobile chart measured 368.9x280px, 12px labels, no page-level overflow at actual CSS width 443px. Dropdown panel/trigger/options measure 12px radius and panel overflow:hidden. Final modal action buttons both 40px high at identical y.

Intentionally unchanged: financial computations, claims/payment data and permissions. Legacy mock prototype. Official Route A/B policy questions and missing Table II source. Native date pickers, browser validation and confirmation dialogs. Audit viewer's 100-entry display cap and existing seed metadata gaps. Automatic's live OS-change event is verified by isolated tests rather than changing the user's global OS appearance.

## Owner-supplied logo update - 2026-10-23

Copied the supplied 1920x703 transparent PNG byte-for-byte to philhealth/frontend/assets/philhealth-logo.png and the legacy assets folder. Shared header and login now use this asset, so all role-aware tabs receive it. Updated intrinsic dimensions and preserved aspect ratio with height:auto. The existing white logo surface makes black wordmark text readable in both themes. Kept previous asset and matching favicon mark intact. No business, theme or data logic changed.

Verification: all eight Finance tabs loaded the replacement at natural size 1920x703. Shared header rendered approximately 165x60.4px, preserving the supplied aspect ratio. PNG copies match the attachment SHA-256 exactly. No-emoji scan passes.

## Revised symbol and typography - 2026-10-23

Replaced the earlier wordmark with the newly supplied 900x900 symbol, copied unchanged. Shared brand.js pairs a proportion-preserving SVG viewport (measured transparent bounds) with bold PhilHealth and a smaller text Your partner in health tagline. Consistent white brand surface and dark-green text support both themes. Shared header/login and legacy mock branding updated. No financial/data changes.

## Dropdown highlight consistency - 2026-10-23

Screenshot showed a fixed narrow menu wrapping event names, producing taller hover rows. Selected border was 1px but keyboard focus inherited a 3px outline. Shared dropdown placement now uses max-content width capped to the viewport and at least the trigger width. Options share 40px minimum height, 8px/12px padding, 20px line height, 1px selection border, 2px inset focus and 4px separation. Text may wrap only when viewport-constrained. No selection/data logic changed.

Browser verification: Event, Theme, New route, Provider, Route and modal Next status menus checked in Light and Dark (12 combinations). Every tested option row measured approximately 40px high. Shared border/focus tokens are 1px/2px. Event names fit on one line at the tested viewport. All 23 automated tests and no-emoji check pass.

## Complete logo replacement and refresh - 2026-10-23

Inspection confirmed the shared header already referenced the revised 3D symbol, but favicon/ICO/PNG/apple-touch assets still contained the previous mark. Re-exported every favicon from the exact supplied pixels, added versioned links and module/style references, and static no-cache revalidation. Increased the shared header/login symbol to make the supplied mark more prominent. Original PNG retained unchanged. No financial/data logic changes.

## Transparent theme-aware logo - 2026-10-23

The latest attachment is PNG RGBA despite its .jpg extension. Copied its pixels/file unchanged into the shared symbol asset. Removed the white brand panel, with symbol left and live PhilHealth / Your partner in health text right, tagline below with 8px spacing. Corrected logo tokens: near-white name and muted-light tagline in Dark, dark-green name and muted-dark tagline in Light. Header/login share the same component. No business/data changes.

Verification: browser confirmed fully transparent brand wrapper and correct foreground changes in both themes. Name/tagline contrast: Light 12.97:1/6.46:1, Dark 13.73:1/9.21:1. Shared symbol alpha bounds unchanged, and all 23 tests plus no-emoji check pass.

Header and favicon follow-up (2026-10-23): retained event and theme controls with accessible names while removing visible labels and account text. Removed login theme selector. Replaced small detailed favicon with a simplified two-figure mark in SVG, ICO and PNG. Reviewed project Markdown punctuation and removed prose semicolons and em dashes. No business logic changed.

Transparent tab icon (2026-10-23): removed the white background from SVG, ICO and PNG browser icons. Increased the mark size by about 7 percent within the fixed browser icon area. Versioned asset links refresh cached icons. PNG corner alpha verified as zero.

Condition column alignment (2026-10-23): event condition cells use a shared grid with a 132px badge track, a 7ch right-aligned percentage track and a 12px gap. Tabular numerals align percentages across rows. Existing status icons, colors and labels remain.

Login copy cleanup (2026-10-23): removed the visible demo credentials hint below the login title at the owner's request. Demo login instructions remain in README. Authentication is unchanged.

Analytics spacing (2026-10-23): added a 24px token-based gap between the scenario form and its results. Calculation and data handling stay unchanged.

### Aiven read-only verification (2026-11-03)

Continued on existing `aiven-postgres` branch without discarding uncommitted preparation. Supplied root `ca.pem` parses successfully and is Git-ignored. Existing untracked `philhealth/.env` allowed `npm run db:inspect` to complete with CA verification enabled. No credentials are recorded here.

Live schema differs from the handoff baseline: `app_sessions`, `app_login_attempts`, `providers`, `request_approvals`, `role_permissions` and `import_batches` already exist. Do not apply the security migration blindly. Read-only schema output is in ignored `work/aiven-schema.json`. Constraint and view definitions were captured in `work/aiven-definitions.json` using an explicit read-only transaction. Counts: 9 users, 7 roles, 1 event, 8 claims, 5 payments and 3 exceptions. No Aiven rows or schema were changed.

Live claim constraints allow SUBMITTED, UNDER_REVIEW, APPROVED, PAID, RECONCILED, RETURNED, DENIED, RESUBMITTED and CANCELLED. Event statuses are ACTIVE and CLOSED. Payments have PAYMENT and REVERSAL entry types, with reversal links required. These constraints establish allowed values, not approved application transitions.

Owner answers are still required for monetary units, role translation, service/discharge date semantics, missing-field storage, audit canonicalization, and approval plus backup before any additive tables. A known test account is also needed for password compatibility checks. Runtime remains SQLite until mappings and integration tests are complete.

Validation for this continuation: all 23 SQLite tests passed, emoji scan found zero occurrences, both Aiven preparation scripts passed node --check, and git diff --check passed. npm audit reports 9 vulnerabilities (8 moderate, 1 high), including minimatch transitively through ExcelJS and Zod. Suggested fixes include breaking dependency changes and were not applied. Browser and PostgreSQL runtime workflow tests were not run.

### Owner confirmations and backup (2026-11-03)

Owner confirmed Aiven money is pesos, role translation CENTRAL_FIN/REGIONAL_STAFF/REGIONAL_VP/PRESIDENT/TREASURY/AUDITOR/ADMIN to CFB/ROS/RVP/EXE/ACT/AUD/ADM, service_date as discharge date, and filed_date as filing date. Role translation may be revised later. API amounts remain integer centavos. Owner authorized creating a backup.

Created a custom-format pg_dump backup at ignored work/backups/aiven-2026-11-03T14-51-23.610Z.dump using verify-full TLS and the supplied CA. File permissions are 0600. Size 77,218 bytes. SHA-256: 9367c1f52efc9246ec9662b4a42b35554687e0d82cfe7afcc5c3771d2133ee6f. pg_restore --list and full decoding to /dev/null both succeeded. This verifies archive readability, not restoration into a separate database. No remote data or schema changed.

Remaining decisions are described in philhealth/docs/aiven-storage-proposal.md. No new app_ tables are approved or applied yet. Audit serialization compatibility is unresolved.

### PostgreSQL testing runtime completed (2026-11-03)

Owner approved the proposed sidecars and confirmed pesos, role translation, claim/service/filed date mappings and case_type. Owner requested demo/testing records. Dedicated PostgreSQL fixtures created nine demo_* accounts and four labeled PHCM-* events without resetting existing data. Initial application reporting date is 2026-11-03. Local server runs at http://localhost:3000 using ignored philhealth/.env with DB_DRIVER=postgres, SEED_DEMO=0 and verified CA TLS. SQLite remains the code default and all in-memory tests force SQLite.

Implemented async database callers across auth, events, workflow, finance, exceptions, modules, reports, metrics, rules and server. Local request transactions serialize writes and commit before responses. Migration 002 adds app-owned sidecars, compatibility views and guarded native writes. Migration 003 exposes the existing native audit ledger separately at /api/audit/legacy without claiming hash verification. Existing security tables are reused. No applied migration was edited. Native money remains exact decimal pesos and the API remains safe integer centavos. Payment reversals subtract from paid totals. New requests/settings/derived exceptions/application audit have separate app-owned storage. Read philhealth/docs/aiven-postgresql-integration.md for these boundaries.

Pre-existing native events are read-only through the bridge. Only app_owned_events can receive business mutations. Native original rows are unchanged: server-side row hashes verified all 107 original rows across 16 business tables after migration and testing. No existing user passwords were changed. New demo login: demo_cfb / demo1234, with role variants documented in README. Existing legacy audit canonicalization is still unconfirmed, so the application ledger remains separate.

Backups: original pre-migration custom archive plus refreshed public-schema archive work/backups/aiven-2026-11-03T15-20-08.629Z.dump, with manifest and listing. pg_restore listing and full decoding passed, files are owner-only and ignored. Isolated restoration has not been tested. Repeatable backup command: node --env-file=.env backend/backup-postgres.js from philhealth/.

Validation: SQLite/default npm test passes 24 checks with one live PostgreSQL suite skipped (23 main tests including SQL translation plus the separate guard regression). Explicit PostgreSQL run passes 14 tests including its parent/subtests. It covers nine mapped logins, CSRF, lockout, regional isolation, exact 12345-centavo/123.45-peso storage, transitions, partial/full payments, reconciliation, CSV preview and full rollback after a native failure, settings, allocation revision approval, request history, six reports in all three formats, audit immutability and unchanged native rows. Syntax checks passed for all 39 backend/frontend JavaScript files. No-emoji scan and git diff --check passed. Browser login, existing and testing dashboards and event selection passed. Mobile 390px and desktop were smoke-checked. Initial unauthenticated /api/me 401 is expected.

Known limits: one serialized connection is for local testing, not production scaling. Native legacy audit chain is not verified. Existing native exception review outcomes and privilege requests remain separate from the app-owned workflows. npm audit reports 9 vulnerabilities (8 moderate, 1 high) in the existing ExcelJS/minimatch and Zod dependency chains. Breaking dependency upgrades were not applied. No push or deployment.

### Dependency and runtime risk fixes (2026-11-03)

Completed the owner's requested dependency/risk review. Clean npm ci and npm audit now report zero vulnerabilities (previously 1 high and 8 moderate). Zod is 4.6.7 and Fastify 5.12.8. ExcelJS 4.4.0 and its compatible Archiver 5 stay in place; tested overrides upgrade glob 14.0.3, minimatch 11.0.4 and unzipper 0.12.5. Recursive ZIP matching and both document/streaming Excel round trips pass. No advisory suppression or unrelated native major upgrades.

Fixed static path/symlink containment and directory responses, independent transaction ownership/queue cleanup using AsyncLocalStorage, and conflicting TLS URL flags. Inspection and validation helpers now share the verified client; inspection explicitly uses a read-only transaction. Migration application requires the backup manifest checksum.

The previous restore limitation is resolved for the application snapshot: work/backups/aiven-2026-11-03T15-35-12.482Z.dump was restored into a new temporary database. Clone login, PHCM-DEMO totals and application audit chain passed. The clone was removed and absence verified. No original service data was reset. All 107 original business row hashes across 16 native tables remain unchanged.

Verification: 31 default tests pass with one live suite skipped; explicit Aiven tests pass 14. New regressions cover archive matching, streaming Excel, path/symlink denial, independent/nested transactions, failed BEGIN cleanup, forced verified TLS and backup checksum rejection. Clean-install lockfile checks pass. Runtime remains localhost testing only. Native legacy audit canonicalization and production concurrency/load remain outside the verified scope. Details and commands: philhealth/docs/risk-review-2026-11-03.md.
