# HANDOFF: run PhilHealth Calamity Monitor on Aiven PostgreSQL
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


Written 2026-11-03. Read AGENTS.md first for the standing rules, then use this file for the task.

## Goal

Make the working copy run locally at http://localhost:3000 against the owner's existing Aiven PostgreSQL service so the owner can test it. The Aiven service is already set up. Only the app has to change. The owner does not want existing Aiven data reset, deleted or reshaped.

## Folders

| Label | Path | Role |
|---|---|---|
| Working copy | `/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor` | Edit here. Branch `ux-and-module-audit`. App code is in `philhealth/` |
| Original | `/Users/takishao/Downloads/Philhealth-Calamity-Monitor-main` | Read only reference. Holds the earlier Aiven prep work. App code is in `philhealth/` |

Do not edit the original. Copy from it.

## What exists where (checked 2026-11-03)

Working copy:
- Full M1 to M8 app on SQLite through `better-sqlite3`. Five SQLite migrations in `philhealth/backend/migrations/`.
- No `pg` dependency, no Aiven docs, no Aiven scripts, no `.env` file. Only `.env.example` with PORT, HOST and a TRUST_PROXY comment.
- 23 tests, all on in-memory SQLite.

Original (older and smaller app, 3 migrations, no `modules.js` or `demo.js`) plus the Aiven prep:
- `philhealth/docs/aiven-postgresql-integration.md`: compatibility plan, field mappings, open questions.
- `philhealth/backend/postgres-migrations/001_security_sessions.sql`: adds `app_sessions` and `app_login_attempts`. Additive only.
- `philhealth/backend/inspect-aiven-schema.js`: read-only schema dump. Run with `npm run db:inspect`.
- `philhealth/backend/validate-aiven-migration.js`: runs the security migration and rolls it back. Run with `npm run db:validate-migration`.
- `philhealth/package.json`: has `pg` listed twice (^8.16.3 and ^8.13.1). Keep one entry. Also has the two scripts above.
- `philhealth/.env.example`: adds `DB_DRIVER`, `SEED_DEMO`, `DATABASE_URL`, `AIVEN_CA_CERT_PATH`. Its CA example is a Windows path. Use a macOS path.
- SQLite was still the active runtime there. No PostgreSQL repository was ever written. Nothing was applied to Aiven.

Neither folder contains the Aiven connection string or the CA certificate. Ask the owner for `DATABASE_URL` and the CA file path and keep them in an untracked `.env`.

## Aiven facts (from the original plan, not re-verified this session)

- Engine is PostgreSQL. Connect with `pg`, TLS with the supplied CA and `rejectUnauthorized: true`. Remove `sslmode` from the URL before passing it to `pg`. The existing scripts already do this.
- Tables: `users` (user_id, username, password_hash, is_active, role_id, region_id), `roles` (role_code), `regions` (region_code), `events` (integer event_id, event_code, event_name, ceiling, status), `event_allocations`, `claims` (claim_ref, submitted_amount, approved_amount, case_type, service_date, filed_date, provider, creator), `claim_status_history`, `payments`, `exceptions`, `audit_log` (prev_hash, row_hash, before and after JSON), `app_settings` (numeric setting_value), `provider_requests`.
- Views: `v_event_measures`, `v_event_totals`, `v_region_totals`, `v_claim_paid`.
- Role codes: CENTRAL_FIN, REGIONAL_STAFF, REGIONAL_VP, PRESIDENT, TREASURY, AUDITOR, ADMIN. Proposed mapping to app roles is CFB, ROS, RVP, EXE, ACT, AUD, ADM in that order. Not approved yet.
- No session or login-attempt tables exist, which is why the security migration exists.

Run `npm run db:inspect` first and compare against this list before trusting it.

## Gap: the working copy is bigger than the plan covered

The Aiven plan was written for the smaller original app. The working copy adds features. These local items have no confirmed Aiven counterpart:
- `permissions` table (role to permission rows used by server-side checks).
- `settings` with text values including the date `as_of_date`, plus `settings_changes` history.
- `event_details` (starts_on, ends_on, circular_reference, closed_at, closed_by) and `event_budgets` (revisions with approval).
- `providers`, `request_decisions` and `request_amendments` (immutable by trigger), and the Route A or B request fields.
- Claim fields `patient_token`, `reason_code`, `decision_date`, `note`, and the statuses `Returned (RTH)`, `Denied`, `Resubmitted`, `Reconciled`.
- Local event IDs are text like `CE-2026-001`. Aiven uses integer `event_id` plus `event_code`. The frontend should keep seeing the code.

Do not guess these. See open questions below.

## SQLite-specific code that must change

Every database call is synchronous (`db.prepare(...).get/all/run`, `db.transaction`). Moving to `pg` makes all of it asynchronous, so every caller up the chain needs `await`. About 126 lines match across these files:

| File | Matching lines | Notes |
|---|---|---|
| `workflow.js` | 20 | Claim entry, CSV commit, payments. Uses CURRENT_TIMESTAMP |
| `events.js` | 16 | Uses `lastInsertRowid`, `.changes` |
| `server.js` | 16 | Routes. `date('now')` at about line 148 |
| `db.js` | 15 | Opens SQLite, WAL and foreign key pragmas, migration runner, seed |
| `auth.js` | 12 | Sessions and lockout. `datetime(...)` at about lines 80 and 90 |
| `modules.js` | 12 | `lastInsertRowid` four times |
| `finance.js` | 10 | Totals, forecast, aging |
| `demo.js` | 8 | `INSERT OR IGNORE` seed |
| `rules.js`, `exceptions.js`, `metrics.js`, `reports.js` | 6, 5, 5, 1 | `exceptions.js` uses ON CONFLICT, confirm a matching unique index exists in PostgreSQL |

SQL dialect differences to translate:
- `?` placeholders become `$1`, `$2`, and so on.
- `INSERT OR IGNORE` becomes `INSERT ... ON CONFLICT DO NOTHING`.
- `lastInsertRowid` becomes `RETURNING id`. `.changes` becomes `rowCount`.
- `date('now')` and `datetime(x, '+8 hours')` become `CURRENT_DATE` and interval math.
- `RAISE(ABORT, ...)` triggers become a trigger function that does `RAISE EXCEPTION`.
- `PRAGMA` lines have no PostgreSQL equivalent.
- Types: TEXT timestamps and dates, INTEGER money in centavos.

`pg` return types to handle so API output stays identical: `numeric` and `bigint` come back as strings, `date` and `timestamptz` come back as `Date` objects. The frontend expects ISO strings and integer centavos.

## Open questions for the owner (do not guess)

1. Do the role codes map as listed above?
2. Claims: how do `case_type`, `service_date`, `filed_date` map to local claim type, discharge date, filing date? What replaces `patient_token`, `reason_code`, `decision_date`, `note`?
3. Money: are PostgreSQL `numeric` amounts pesos or centavos? The app API uses integer centavos. No conversion until confirmed.
4. Which status values and transitions do the PostgreSQL constraints allow for claims, events, exceptions and payments?
5. Where should `as_of_date` live, since `app_settings.setting_value` is numeric?
6. Does the `prev_hash` and `row_hash` chain use the same canonical serialization as the local SHA-256 chain? Do not write audit rows until confirmed.
7. How does the UI get a valid provider, and is `provider_requests` part of the claim workflow?
8. For local features that have no Aiven table (list above), may the app add its own tables with an `app_` prefix through additive migrations, the same way `app_sessions` works? This is the recommended route. It needs owner approval and a backup first.
9. Are the Argon2 hashes in Aiven `users.password_hash` compatible with the local `argon2` library? Test with one known account.

## Suggested plan

1. Create a branch `aiven-postgres` from `ux-and-module-audit`.
2. Copy the Aiven docs, scripts and `postgres-migrations/` from the original into the working copy. Merge `pg` and the two npm scripts into `philhealth/package.json` with a single `pg` entry. Merge the env entries into `.env.example`. Run `npm install` and keep the lockfile in sync.
3. Get `.env` from the owner. Run `npm run db:inspect`, save the output under `work/` (ignored by Git) and compare to this file. Get answers to the open questions.
4. Add a data-access layer with one async interface and two drivers. Keep SQLite as the default so the 23 tests keep passing. Add the PostgreSQL driver behind `DB_DRIVER=postgres`. Keep API response shapes and centavo integers unchanged so the frontend needs no change.
5. Convert modules in this order: `auth.js` (login gates everything), then `events.js`, `workflow.js`, `finance.js`, `exceptions.js`, `modules.js`, `reports.js`, `metrics.js`, settings routes in `server.js`.
6. After the owner confirms a backup, apply `001_security_sessions.sql`. Add further additive PostgreSQL migrations in a separate numbered folder. Never edit existing Aiven tables. Add immutable triggers only on app-owned tables.
7. Update `start.sh` and the run instructions. `start.sh` currently runs `npm run seed` and would build a local SQLite file. Skip that when `DB_DRIVER=postgres`. There is no dotenv loader in the app, so start with `node --env-file=.env backend/server.js` or add that flag to the npm script.
8. Never run the demo seed against Aiven unless the owner says so. Keep the `SEED_DEMO` guard.
9. Verify (see below), update the Current status section of AGENTS.md and AUDIT.md, make small commits on the branch. Never push to main.

## Verification

- `cd philhealth && npm test` must still pass on SQLite, including the emoji check (zero findings).
- Add PostgreSQL integration tests that skip when `DATABASE_URL` is absent.
- Against Aiven, check: login for each mapped role, CSRF rejection, lockout, role and region scope, event dashboard totals equal all six report totals, claim entry and CSV import, partial and full payment, exceptions queue, audit chain write and read.
- Local login note: Secure cookies need `http://localhost:3000`. A `127.0.0.1` visit redirects.

## Safety

- Verified TLS only. Never set `rejectUnauthorized: false`.
- Never commit the connection string, passwords or the CA file. Consider adding `*.pem` to `.gitignore`.
- Never run local SQLite migrations or seeds against PostgreSQL.
- Never alter, drop or truncate existing Aiven tables or rows without explicit owner approval and a fresh backup. A non-production Aiven clone is preferred for destructive tests.
- No real PhilHealth or patient data. Local demo data stays illustrative.

## Not done yet (as of this handoff)

- No application code changed. No connection to Aiven was made. No credentials were seen.
- The live Aiven schema was not re-inspected. All Aiven facts above come from the original folder's plan.
- Tests were not run this session.
- The two new docs are uncommitted on branch `ux-and-module-audit`.

## Verified continuation update (2026-11-03)

The live schema was inspected successfully with the supplied root `ca.pem` and verified TLS. The current branch is `aiven-postgres`. Preparation files and `pg` are already present. Contrary to the earlier baseline, session tables, providers and role permissions already exist. See the latest AGENTS.md Current status entry and ignored work/aiven-schema.json and work/aiven-definitions.json. No migration was applied. Business mappings and backup confirmation remain unresolved.

### Owner confirmations and backup (2026-11-03)

Owner confirmed Aiven money is pesos, role translation CENTRAL_FIN/REGIONAL_STAFF/REGIONAL_VP/PRESIDENT/TREASURY/AUDITOR/ADMIN to CFB/ROS/RVP/EXE/ACT/AUD/ADM, service_date as discharge date, and filed_date as filing date. Role translation may be revised later. API amounts remain integer centavos. Owner authorized creating a backup.

Created a custom-format pg_dump backup at ignored work/backups/aiven-2026-11-03T14-51-23.610Z.dump using verify-full TLS and the supplied CA. File permissions are 0600. Size 77,218 bytes. SHA-256: 9367c1f52efc9246ec9662b4a42b35554687e0d82cfe7afcc5c3771d2133ee6f. pg_restore --list and full decoding to /dev/null both succeeded. This verifies archive readability, not restoration into a separate database. No remote data or schema changed.

Remaining decisions are described in philhealth/docs/aiven-storage-proposal.md. No new app_ tables are approved or applied yet. Audit serialization compatibility is unresolved.
