# Aiven PostgreSQL integration

Implemented 2026-11-03 on branch `aiven-postgres`. Working directory is `/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor`. Original reference folder remains unchanged.

## Run the testing setup

Run `./start.sh` from the project root, then visit http://localhost:3000. The ignored `philhealth/.env` contains DATABASE_URL, AIVEN_CA_CERT_PATH, DB_DRIVER=postgres and SEED_DEMO=0. CA verification is always enabled. URL TLS options are removed before pg receives the explicit CA configuration. No secret is committed.

Use `demo_cfb` / `demo1234`. Accounts for other roles use `demo_` followed by act, exe, aud, adm, ros_xi, ros_vii, ros_iva or rvp_vii, with the same illustrative password. Keep localhost binding. Four events PHCM-DEMO, PHCM-NORMAL, PHCM-DANGER and PHCM-CRITICAL are labeled illustrative. Initial reporting date: 2026-11-03. Existing records were not reset.

## Confirmed mappings

- Native PostgreSQL money is pesos. Compatibility views multiply exact numeric values by 100 and expose bigint centavos. Trigger writes divide centavos by 100 using numeric arithmetic. JavaScript rejects values outside safe integer range.
- CENTRAL_FIN, REGIONAL_STAFF, REGIONAL_VP, PRESIDENT, TREASURY, AUDITOR and ADMIN map to CFB, ROS, RVP, EXE, ACT, AUD and ADM.
- event_code remains the API event ID; native integer IDs stay in the database. service_date is discharge date, filed_date is filing date, and case_type is claim type.
- Native status codes map explicitly to existing application labels, including Returned (RTH). CANCELLED remains readable as Cancelled but has no application transition.
- Native PAYMENT and REVERSAL entries contribute positive and negative amounts respectively to paid totals.

## Storage and preservation

Migration 002 adds app-owned sidecars and compatibility views/triggers. It never alters existing tables or backfills business rows. Migration 003 exposes the native audit ledger separately. Existing app_sessions and app_login_attempts are reused. Applied migration checksums are recorded in app_schema_migrations. Never edit an applied migration.

Missing claim fields use app_claim_details. Text settings and setting history use app_text_settings and app_settings_changes. Numeric settings are copied once into the application overlay and thereafter do not update native app_settings. Event closure metadata and revision history use app_event_details and app_event_budgets. Monetary request workflows use app_provider_requests, app_request_decisions and app_request_amendments. These are separate from native provider privilege requests. Their amounts retain the app's integer-centavo contract.

Application permissions preserve the existing app role rules in app_permissions. app_exceptions stores a derived application queue and resolution history, without rewriting native exceptions or their review outcomes. app_audit_log is a separate immutable chain using the local canonical serialization. Native audit data is exposed at `/api/audit/legacy` to AUD/CFB, with chainVerified=false. No unverified combined-chain claim is made.

app_owned_events registers only events created by this app. Database triggers reject updates and financial writes against pre-existing events. Demo creation inserts new native users/providers/events/claims/payments, plus app-owned history. It does not replace existing users, passwords or rows. Existing missing tokens remain empty rather than invented. The local API requires globally unique claim references; migration and startup fail on ambiguous native references instead of choosing an event silently.

## Explicit administrative commands

From philhealth/:

```sh
npm run db:inspect
node --env-file=.env backend/backup-postgres.js
npm run db:migrate
npm run db:migrate -- --apply --backup ../work/backups/VERIFIED_BACKUP.dump
DB_DRIVER=postgres SEED_DEMO=1 npm run seed:postgres-demo
npm run test:postgres
```

Backup requires pg_dump and pg_restore on PATH. It uses verify-full TLS, passes credentials through environment variables, writes an owner-only custom archive of the public schema under ignored work/backups, and validates the listing and full archive decoding. A SHA-256 manifest is saved alongside it. Decoding alone is not an isolated restoration test. Run npm run db:verify-backup -- ARCHIVE.dump to restore into and remove a new temporary database, using the documented demo fixture for checks.

Without --apply, migration validation rolls back. Applying requires a backup file with the generated manifest and matching SHA-256 checksum. The existing security tables are checked rather than blindly applying migration 001. Startup never applies migrations and never seeds PostgreSQL. The dedicated PostgreSQL demo seed requires both DB_DRIVER=postgres and SEED_DEMO=1. The SQLite seed refuses PostgreSQL.

## Verification and limits

SQLite suites remain in-memory and force SQLite even if the environment selects PostgreSQL. The PostgreSQL integration suite skips without DATABASE_URL. Its explicit run exercises demo role login, CSRF, lockout, regional scope, exact peso conversion, claim transitions, partial/full payments, reconciliation, CSV preview/atomic rollback, settings, revisions, request evidence, six reports in CSV/XLSX/PDF, and audit immutability. It verifies that native business rows present before testing remain unchanged.

The app serializes transactions over one connection, with a shared advisory transaction lock across app processes. Upgrade to a transaction-aware pool before production scaling. Keep other database writers coordinated. No production deployment or native legacy audit hash certification is claimed. Aiven passwords for existing users were neither guessed nor changed. Isolated backup restoration now passes. The temporary restore database was removed. npm audit is clean after the coordinated dependency fixes. See risk-review-2026-11-03.md for evidence and remaining deployment limits.
