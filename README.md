# How to run

For step-by-step data entry, approvals and every account role, read [USER_WORKFLOW.md](USER_WORKFLOW.md).

Prerequisites: Windows, macOS or Linux, Node.js 22.9+ and npm.

```sh
cd '/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor'
./start.sh
```

## Windows starter

Double-click `start.bat` in the project root. It checks Node/npm, installs locked dependencies when needed, and keeps the server output visible. It also reinstalls incompatible native modules when the folder was copied from macOS or Linux. Keep the window open while using the app. Press Control-C to stop it.

For Aiven, include your private `philhealth/.env` and the supplied root `ca.pem` when moving the project to Windows. These files are intentionally absent from Git. In `philhealth/.env`, use the portable CA path below and keep your existing DATABASE_URL:

```dotenv
DB_DRIVER=postgres
SEED_DEMO=0
AIVEN_CA_CERT_PATH=../ca.pem
```

An internet connection is required for Aiven and for the initial dependency installation. No PostgreSQL server installation is needed on Windows. The starter uses the same npm start command as macOS, without migrating or seeding Aiven.

Open http://localhost:3000. This working copy uses Aiven PostgreSQL through the untracked `philhealth/.env`. TLS verifies the supplied `ca.pem`. Startup never migrates or seeds PostgreSQL automatically.

Testing login: `demo_cfb` / `demo1234`. Other demo accounts use the same password: `demo_act`, `demo_exe`, `demo_aud`, `demo_adm`, `demo_ros_iva`, `demo_ros_vii`, `demo_ros_xi`, `demo_rvp_vii`. These are illustrative local testing accounts. Keep this server bound to localhost.

Select **Warning testing event - illustrative only** for the PHP50M ceiling, PHP40M committed and PHP32M paid example. Normal, Danger and Critical testing events demonstrate the other conditions. The testing reporting date is 2026-11-03, configurable by `demo_adm`. New claims need a provider, discharge date and filing date. Aiven stores pesos. APIs and financial calculations use integer centavos.

Events present before this integration remain readable but cannot be changed through the app. Use the labeled testing events or create a new event as `demo_cfb`. The new application audit ledger and monetary provider requests are separate from Aiven's legacy audit ledger and privilege requests. The derived exceptions queue and settings/history use app-owned tables. Legacy audit data is available read-only to Finance and Auditor at `/api/audit/legacy`; its hash algorithm is not verified.

Stop with Control-C. Manual startup: `cd philhealth && npm ci && npm start`. There is no build step. Node loads `philhealth/.env` directly, without dotenv. Secrets, the CA and backups are ignored by Git.

SQLite stays the default driver when no environment configuration is supplied. For offline illustrative work:

```sh
DB_DRIVER=sqlite SEED_DEMO=1 ./start.sh
```

SQLite uses `philhealth/backend/data/calamity.db`. Its additive seed never resets existing data. Back up the database and WAL/SHM companions before any manual reset. Do not run `npm run seed` against PostgreSQL.

Checks: `cd philhealth && npm test` runs the SQLite suites, SQL translation checks and no-emoji guard. PostgreSQL integration skips without DATABASE_URL. `npm run test:postgres` explicitly loads `.env` and adds labeled integration-test records without deleting them. Run that command only on this authorized testing service.

PostgreSQL backup and migrations: see `philhealth/docs/aiven-postgresql-integration.md`. Existing schema must be reviewed before migration. Runtime uses one serialized database connection for consistent local testing, with an advisory lock across app instances. It is not a production concurrency design.

# PhilHealth Calamity Monitor

The maintained application is `philhealth/` (Fastify, SQLite or PostgreSQL, vanilla JavaScript). Root `frontend/` and `backend/data/mock-api.js` are preserved legacy mock prototypes. Do not run them for financial reporting. All sample figures are illustrative, not real PhilHealth data. See AUDIT.md and AGENTS.md.

## Icons and no-emoji rule

Lucide (`lucide-static`, installed locally through npm) is the only icon set. The local SVG sprite at `philhealth/frontend/assets/icons.svg` contains circle-check, triangle-alert, circle-alert and octagon-alert. Every status combines an SVG icon, visible text and condition color. Decorative SVGs are hidden from assistive technology. No CDN is used.

`cd philhealth && npm run check:emoji` scans all tracked and non-ignored project text, including templates, source, CSS, seed data, docs, tests, escaped Unicode and the complete commit-message history. `npm test` runs it first and also tests that the guard rejects regressions. Installed dependencies, Git internals, local databases and binary images are excluded. Never use emojis in UI, code, data, docs, exports or commit messages.

Favicons use a simplified two-figure PhilHealth brand mark for clarity at small sizes: ICO (16/32/48), SVG, PNG (16/32/48/192/512), and a 180px apple-touch icon. Both maintained and legacy HTML heads link local assets.

## Demo walkthrough

Select Typhoon Sample for the worked 80% warning example. Select Normal sample (50%), Danger sample (92%) or Critical sample (102%) to inspect each condition. All are illustrative. Administration (`adm`) configures warning/danger/critical percentages and the reporting as-of date. The seeded as-of date is 2026-10-15. Change it deliberately when testing current activity.

Central Finance (`cfb`) registers events, providers and requests. Regional staff (`ros_xi`) encode/import XI claims. Finance reviews and approves claims. Accounting (`act`) records partial or full payments. An independent approver (`exe`) can record provider-request decisions and approve allocation revisions. The auditor (`aud`) has read-only views and evidence export. Route criteria are illustrative pending the missing paper details.

## Appearance

Use the appearance dropdown in the signed-in header: Automatic follows the OS appearance and updates live. Light and Dark are explicit choices. Your choice is saved locally and applied before the page paints. Both themes use neutral surfaces, with PhilHealth brand and condition colors kept separate. Controls share a 12px radius. Dropdowns support arrows, Home/End, typing, Enter, Escape and Tab.

The dashboard chart uses responsive SVG with amount/date axes and an actual/forecast/ceiling legend. A flat trend is expected when there are no new commitments in the displayed weeks. An explanatory message makes this explicit. No financial calculation changes were made in the appearance update.

## Dependency and risk review

The 2026-11-03 review reports zero npm audit findings after a clean install. Backup restoration into a temporary database, static-file boundary checks, transaction isolation regressions and both database suites pass. See philhealth/docs/risk-review-2026-11-03.md for the tested dependency overrides, restore commands and remaining deployment limits.

## Database connection reset on Windows

If the terminal shows read ECONNRESET, the PostgreSQL network connection was reset. Older copies crash on that idle error. Copy the updated philhealth/backend/postgres.js and its dependency-free runtime fix from this branch, then restart start.bat. Keep your private .env and ca.pem. The updated server handles idle disconnects, returns a connection-interrupted message when needed and reconnects before the next transaction. It never retries an interrupted write or commit automatically. Check claim/payment history before resubmitting an interrupted financial action. Persistent resets need investigation of the Windows network, VPN/firewall and Aiven service.
