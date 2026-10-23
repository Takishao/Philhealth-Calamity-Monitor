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
