# Audit

## Baseline before feature changes
All tracked source, migrations, tests, styles, HTML, assets, package metadata and legacy prototype files reviewed. Dependencies excluded. Five baseline tests pass. Logo exists at philhealth/frontend/assets/philhealth-seal.png.

| Module | Baseline | Evidence and gap |
|---|---|---|
| M1 | Partial | backend/events.js registerEventRoutes: ceiling validation at creation, but dates/circular missing and revision approval bypasses ceiling |
| M2 | Missing | No provider request/Route A/B approval model |
| M3 | Partial | workflow.js registerWorkflowRoutes: claims/history/payment exist; import commits immediately, lacks event-period validation and required provider |
| M4 | Partial | server.js dashboard route: P incorrectly derived from approved amounts; variance reversed; currency centavos shown as pesos |
| M5 | Partial | exceptions.js scanExceptions: aging/z-score/mismatch; stale exceptions, no returned/denied queue or dashboard threshold alerts |
| M6 | Partial | server.js analytics: fixed series and fabricated scenario/Monte Carlo/LP claims; metrics.js regression lacks empty-series guard |
| M7 | Partial | dashboard.js and reports.js: four KPIs, first event only, one CSV; no six reports/PDF/Excel/trend |
| M8 | Partial | auth.js appendAudit and SQL immutable triggers exist; viewer hides records; role restrictions inconsistent |

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
server.js dashboard/reports and reports.js CSV use B−A as variance instead of A−B. dashboard/regions derive P from approved amounts rather than payment records. Reconciled claims inconsistently excluded from reports/analytics. Currency output omits centavo conversion. Warning hardcoded at .8; danger missing; exact 100% incorrectly not critical. Forecast not based on claims. Metrics exception counts not event scoped. Zero ceiling division unsafe. Exceptions use population z-score; aging uses configured as-of date. No official scenario or allocation formula supplied; assumptions must be explicit.

## UX review
Logo absent in maintained login/header; low contrast muted/table text; placeholders instead of exception/audit/report screens; no persistent event selector; no threshold markers; missing chart, destructive confirmations, import preview, pagination and comprehensive role workflows. Mobile navigation scrolls but tables need accessible controls.

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
| M1 | Done | events.js registerEventRoutes: date/circular validation, allocations and revised allocation ceiling; module view event/revision forms |
| M2 | Done with policy question | modules.js registerModuleRoutes: providers, requests, immutable amendments and decisions; chosen Route A/B recorded; official chains unspecified |
| M3 | Done | workflow.js registerWorkflowRoutes, finance.js claimError: required cost centers/dates, duplicate rejection, CSV preview/atomic revalidation, payment matching and history |
| M4 | Done | finance.js financials/snapshot: exact B/A/P formulas with centavo storage and peso display |
| M5 | Done | exceptions.js scanExceptions and snapshot: event-scoped unusual/aging/unmatched queue plus returned/denied; configurable dashboard alerts |
| M6 | Done with assumptions | snapshot weekly forecast, server analytics scenarios and advisory allocation; technique assumptions documented in AGENTS.md |
| M7 | Done | dashboard.js eight KPIs/trend/regional comparison; reports.js reportRows/registerReportRoutes: all six PDF/XLSX/CSV exports share totals |
| M8 | Done | auth.js appendAudit/attachAuth, SQL immutable triggers, server role guards, audit viewer and complete JSON evidence |

Table II Problems 1-5 remain unverifiable because their statements were not supplied. No implementation mapping has been invented.

Formula mismatches listed in the baseline are corrected. Retained metrics.js exception counts are now event/region scoped and regression handles empty/single-point inputs. Status includes legacy Reconciled, consistently committed. P always comes from payments in the shared financial projection. No simulated Monte Carlo or optimization result is presented as a real computation.

### Icon policy follow-up

20 emoji/decorative-symbol occurrences were replaced or removed, including legacy prototype indicators, arrow separators and close-button glyphs. Existing commit-message scan found zero. Lucide static SVG is the single local icon library; status helpers combine icon, text and color. Logo-derived favicon assets and apple-touch icon are linked in both HTML heads. Automated no-emoji check runs first in npm test, with an isolated regression test for literal/escaped symbols and commit messages. No CDN dependency.

### Verification and practical limits

20 domain/API tests plus one guard regression test pass; includes 18 report export combinations, formula example, threshold inclusivity/configuration, duplicates/dates/allocations, CSV preview, partial/full payments, regional isolation, read-only auditor, immutable histories and logo/icon asset delivery. Dependency audit reports zero known vulnerabilities. Design token contrast measurements are in DESIGN.md. Browser measurements show no page-level horizontal overflow at tested responsive widths; real browser screenshots document four conditions. Full production security, official forms and policy validation are outside this local illustrative run.

Remaining questions: missing Table II statements; official Route A/B criteria/chains; acceptance of declared moving-average horizon and fund-allocation assumptions. Legacy demo claims lacking provider/date metadata are preserved, not silently rewritten. New claims require those fields. Audit viewer displays latest 100 records; full evidence download includes all. PDF export is plain-text tabular presentation. Seed as-of date is explicit and configurable.
