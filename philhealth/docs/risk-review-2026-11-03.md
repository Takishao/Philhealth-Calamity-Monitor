# Dependency and runtime risk review

Verified 2026-11-03 for local Aiven testing. All changes stay on `aiven-postgres`. Nothing was pushed or deployed.

## Outcome

`npm audit` decreased from 9 findings (1 high and 8 moderate) to zero after a clean `npm ci`. The findings represented two underlying advisories, not nine separate vulnerabilities. Default checks pass 31 tests with the live PostgreSQL suite skipped when DATABASE_URL is absent. The explicit Aiven suite passes 14 tests. All 107 original business rows across 16 native tables remain unchanged.

## Fixes and approaches checked

| Finding | Approach applied | Verification |
| --- | --- | --- |
| Zod high-severity resource exhaustion advisory | Upgrade Zod 3.25.76 to 4.6.7, preserving the app's existing schema and error interfaces | Validation, invalid input, CSV, monetary bounds and both database suites pass |
| minimatch advisory through ExcelJS's archive dependencies | Keep ExcelJS 4.4.0 and its compatible Archiver 5. Override glob to 14.0.3, minimatch to 11.0.4 and ExcelJS's unzipper to 0.12.5 | Recursive matching, actual ZIP contents, document and streaming Excel round trips, and all six report formats pass |
| Fastify patch behind current compatible release | Install 5.12.8 within the existing major version | Authentication, CSRF, roles, lockout and HTTP workflows pass |
| Static-file path boundary could admit a sibling directory with the same prefix, or a symbolic link outside the frontend | Require the directory separator boundary, canonicalize the actual file path, and reject directories and external links | Controlled sibling-path and symlink regression tests return 400/404, while valid local icons load |
| Independent transaction callbacks could share another caller's transaction and rollback | Associate transaction ownership with AsyncLocalStorage; queue independent callers and retain nesting only inside the owning context | Independent transaction, nested callback, rollback and failed-BEGIN queue regressions pass; native workflows and failed CSV atomic rollback pass |
| Connection URL TLS flags could override an explicit CA in some helper paths | Reuse the same verified postgresClient in the inspection and validation tools; strip competing URL TLS flags | Regression test supplies ssl=false and sslmode=disable and confirms CA verification stays enabled; actual Aiven connections pass |
| Migration backup check accepted only an archive header | Require the generated backup manifest and matching SHA-256 before applying migrations | A mismatched archive is rejected before database connection |
| Archive decoding had not established restorability | Restore a fresh public-schema backup into a newly created temporary database; check demo login, exact totals and audit chain; remove the clone | Restore passed. No temporary restore databases remain |

The archive update is coordinated deliberately. A minimatch-only override is incompatible with the old glob implementation. Upgrading Archiver itself changes stream normalization used by ExcelJS's streaming writer. The final set keeps the compatible Archiver API while replacing the vulnerable glob/matcher and old unzipper dependency paths. No custom package shim or security-advisory suppression was added.

## Backup evidence

Archive: `work/backups/aiven-2026-11-03T15-35-12.482Z.dump`.
Proof: the adjacent `.restore-proof.json` records both isolatedRestorePassed=true and temporaryDatabaseRemoved=true. Listing, complete decoding and SHA-256 checks also pass. The snapshot covers the application public schema, not Aiven service configuration or account provisioning. Only the new disposable database was cleaned during restoration. The live database was not restored over or reset.

Repeat from philhealth/:

```sh
npm run db:backup
npm run db:verify-backup -- ../work/backups/ARCHIVE.dump
npm ci
npm audit
npm test
npm run test:postgres
```

Backup verification uses CREATE DATABASE permission and deletes only the uniquely named database it creates. It requires a testing snapshot containing the documented demo account and PHCM-DEMO fixture. Files containing database data stay owner-only and Git-ignored.

## Remaining limits and next approach

- The app is still a localhost testing server with demo accounts and one serialized database connection. Before exposure or production load, use a restricted service database role, non-demo credentials, authenticated HTTPS, request rate/queue limits and a transaction-aware pool. These require a separate deployment design and load tests.
- Native legacy audit canonicalization remains unconfirmed. Its ledger remains read-only and explicitly unverified. Obtain the original serialization/hash specification before attempting verification or a unified ledger. The separate application chain and immutable history were tested.
- Overrides must remain covered by the archive/Excel regression tests when dependencies change. A zero npm advisory count is a point-in-time dependency result, not a certification that all application risks are absent.
- Major upgrades unrelated to current advisories, including Argon2 and better-sqlite3, were not installed. Their existing native functionality and Argon2 demo logins pass. Lucide assets were kept consistent with the project's pinned design instructions.

Credential checks found no supplied URI or password in tracked/non-ignored project text or Git patch history. No existing passwords were changed. Frontend/backend syntax checks and the no-emoji guard pass. Testing environment: Node 26.13.0 and npm 11.20.0.

## Primary references

- [Zod advisory and patched release](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- [Zod 4 migration guide](https://zod.dev/v4/changelog).
- [minimatch maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
- [Upstream affected-range clarification](https://github.com/github/advisory-database/issues/10811). The final dependency graph installs the patched version instead of suppressing this disputed advisory.
- [PostgreSQL dump and restore documentation](https://www.postgresql.org/docs/current/backup-dump.html).
