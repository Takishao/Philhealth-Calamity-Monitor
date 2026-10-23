# How to run

Prerequisites: macOS/Linux, Node.js 22+ and npm. Verified on macOS 27.2 (Apple silicon), Node 26.8.2, npm 11.19.1.

```sh
cd ~/Desktop/Philhealth-Calamity-Monitor
./start.sh
```

Open http://localhost:3000. The first start installs locked dependencies and seeds an illustrative local database. Demo login: `cfb` / `demo1234`. Other illustrative users: `act`, `exe`, `aud`, `adm`, `ros_iva`, `ros_vii`, `ros_xi`, `rvp_vii`; same password. Roles: Central Finance, accounting, executive approver, read-only auditor, administrator, regional staff and regional approver respectively.

Manual install/run: `cd philhealth && npm ci && npm run seed && npm start`.
Tests: `cd philhealth && npm test`. No build step: the server serves native JavaScript/CSS.
Stop with Control-C. Seed is additive; it does not reset your data. To reset demo data, stop the server, move `philhealth/backend/data/calamity.db` and its `-wal`/`-shm` companions to a backup folder, then run `./start.sh`. Never do this to a real database.
Optional environment: `PORT=3000 HOST=127.0.0.1`; see `.env.example` (shell variables, no dotenv loader).

# PhilHealth Calamity Monitor

The maintained application is `philhealth/` (Fastify, SQLite, vanilla JavaScript). Root `frontend/` and `backend/data/mock-api.js` are preserved legacy mock prototypes; do not run them for financial reporting. All sample figures are illustrative, not real PhilHealth data. See AUDIT.md and AGENTS.md.

## Icons and no-emoji rule

Lucide (`lucide-static`, installed locally through npm) is the only icon set. The local SVG sprite at `philhealth/frontend/assets/icons.svg` contains circle-check, triangle-alert, circle-alert and octagon-alert. Every status combines an SVG icon, visible text and condition color. Decorative SVGs are hidden from assistive technology. No CDN is used.

`cd philhealth && npm run check:emoji` scans all tracked and non-ignored project text, including templates, source, CSS, seed data, docs, tests, escaped Unicode and the complete commit-message history. `npm test` runs it first and also tests that the guard rejects regressions. Installed dependencies, Git internals, local databases and binary images are excluded. Never use emojis in UI, code, data, docs, exports or commit messages.

Favicons use the supplied PhilHealth logo mark with its aspect ratio preserved: ICO (16/32/48), SVG, PNG (16/32/48/192/512), and a 180px apple-touch icon. Both maintained and legacy HTML heads link local assets.

## Demo walkthrough

Select Typhoon Sample for the worked 80% warning example. Select Normal sample (50%), Danger sample (92%) or Critical sample (102%) to inspect each condition. All are illustrative. Administration (`adm`) configures warning/danger/critical percentages and the reporting as-of date. The seeded as-of date is 2026-10-15; change it deliberately when testing current activity.

Central Finance (`cfb`) registers events, providers and requests. Regional staff (`ros_xi`) encode/import XI claims. Finance reviews and approves claims; accounting (`act`) records partial or full payments. An independent approver (`exe`) can record provider-request decisions and approve allocation revisions. The auditor (`aud`) has read-only views and evidence export. Route criteria are illustrative pending the missing paper details.
