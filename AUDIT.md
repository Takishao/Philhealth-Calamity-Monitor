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
