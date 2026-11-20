import { dashboardMetrics } from './metrics.js';
import { snapshot } from './finance.js';
import { registerModuleRoutes } from './modules.js';
import Fastify from 'fastify';
import argon2 from 'argon2';
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createDatabase } from './db.js';
import { schemas, validate } from './routes/schemas.js';
import { appendAudit, attachAuth, clearSessionCookie, issuePreAuthSession, isLockedOut, recordLoginAttempt, requireCsrf, signIn } from './auth.js';
import { canAccessClaim, transitionError } from './rules.js';
import { registerWorkflowRoutes } from './workflow.js';
import { scanExceptions } from './exceptions.js';
import { registerEventRoutes } from './events.js';
import { registerReportRoutes } from './reports.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = realpathSync(resolve(here, '../frontend'));
const staticTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.png': 'image/png', '.html': 'text/html; charset=utf-8' };

function mustBeSignedIn(request, reply) {
  if (!request.user) { reply.code(401).send({ error: 'Authentication required.' }); return false; }
  return true;
}

function guarded(roles, action) {
  return (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return false;
    if (roles && !roles.includes(request.user.role)) { reply.code(403).send({ error: 'Your role is not allowed to perform this action.' }); return false; }
    return action ? action(request, reply) : true;
  };
}

async function event(db) { return (await db.prepare('SELECT * FROM calamity_events ORDER BY id LIMIT 1').get()); }
async function claimRow(db, ref) {
  return (await db.prepare(`SELECT ref, event_id, region, patient_token AS token, claim_type AS type, status,
    claimed_amount AS claimed, approved_amount AS approved, created_at, provider_id, discharge_date,
    filing_date, decision_date, reason_code, encoded_by, note FROM claims WHERE ref = ?`).get(ref));
}
function auditChain(rows) {
  let previous = null;
  return rows.every(row => {
    const hash = createHash('sha256').update([previous || '', row.occurred_at, row.actor_id || '', row.action, row.record_type, row.record_id, row.reason, row.old_json, row.new_json].join('|')).digest('hex');
    const valid = row.previous_hash === previous && hash === row.entry_hash;
    previous = row.entry_hash;
    return valid;
  });
}

export async function buildApp({ database = join(here, 'data', 'calamity.db'), serveFrontend = true } = {}) {
  const db = await createDatabase(database);
  const app = Fastify({ logger: false, trustProxy: process.env.TRUST_PROXY === '1' });
  app.decorate('db', db);
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (request, body, done) => done(null, body));
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.addHook('onRequest', (request, reply, done) => request.url.startsWith('/api/') ? db.inRequestContext(done) : done());
  app.addHook('onRequest', async request => { if(request.url.startsWith('/api/')) await db.beginRequest(); });
  const authenticate=attachAuth(db);
  app.addHook('onRequest', async (request,reply) => { if(request.url.startsWith('/api/')) await authenticate(request,reply); });
  app.addHook('onRequest', async request => { if(request.url.startsWith('/api/') && db.setActor) await db.setActor(request.user?.id); });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/') && reply.statusCode === 403 && !request.databaseFailed) {
      await appendAudit(db, request.user?.id || null, 'DENIED', 'Request', `${request.method} ${request.url}`, 'Forbidden request');
    }
    if(request.url.startsWith('/api/')) await db.endRequest(request.databaseFailed || reply.statusCode >= 500);
    return payload;
  });
  app.addHook('onClose', async () => db.close());
  app.setErrorHandler((error, request, reply) => {
    request.databaseFailed = true;
    if (db.driver === 'postgres' && ['23514','23505','23503','23502','22P02','22001','22003','22007','22008','P0001'].includes(error.code)) {
      return reply.code(422).send({ error: error.message.startsWith('Existing Aiven records') ? error.message : 'Database rejected this operation. Check required dates, references and amounts.' });
    }
    const code = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    reply.code(code).send({ error: code === 500 ? 'An unexpected error occurred.' : 'Invalid request.' });
  });
  registerWorkflowRoutes(app, db);
  registerEventRoutes(app, db);
  registerReportRoutes(app, db);
  registerModuleRoutes(app, db);

  app.get('/api/csrf', { preHandler: validate(schemas.csrf) }, async (request, reply) => {
    if (request.session) return { csrfToken: request.session.csrf_token };
    return { csrfToken: (await issuePreAuthSession(db, reply)) };
  });
  app.post('/api/login', { preHandler: [validate(schemas.login), requireCsrf] }, async (request, reply) => {
    const { username, password } = request.validated;
    const ip = request.ip;
    if ((await isLockedOut(db, username, ip))) return reply.code(429).send({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    const user = (await db.prepare('SELECT * FROM users WHERE username = ?').get(username));
    const valid = Boolean(user && await argon2.verify(user.password_hash, password));
    (await recordLoginAttempt(db, username, ip, valid));
    if (!valid) {
      (await appendAudit(db, user?.id || null, 'LOGIN_FAILED', 'Session', username, 'Invalid credentials'));
      return reply.code(401).send({ error: 'Invalid username or password.' });
    }
    const csrfToken = (await signIn(db, request, reply, user));
    (await appendAudit(db, user.id, 'LOGIN', 'Session', user.username, 'User signed in'));
    return { user: { username: user.username, role: user.role, region: user.region }, csrfToken };
  });
  app.post('/api/logout', { preHandler: [validate(schemas.logout), requireCsrf] }, async (request, reply) => {
    if (request.session) {
      (await db.prepare('DELETE FROM sessions WHERE id = ?').run(request.session.id));
      (await appendAudit(db, request.user?.id || null, 'LOGOUT', 'Session', request.user?.username || request.session.id, 'User signed out'));
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
  app.get('/api/me', { preHandler: validate(schemas.me) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    return { user: request.user, csrfToken: request.session.csrf_token };
  });
  app.get('/api/dashboard', { preHandler: validate(schemas.dashboard) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if (request.user.role === 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const id=request.query.eventId || (await event(db))?.id;
    const data=(await snapshot(db,id,request.user));
    if(!data)return reply.code(404).send({error:'Event not found.'});
    return {...data,operational:(await dashboardMetrics(db,id,request.user))};
  });
  app.get('/api/claims', { preHandler: validate(schemas.claims, 'query') }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if (request.user.role === 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const q = `%${request.validated.q || ''}%`;
    const rows = (await db.prepare(`SELECT ref, event_id, provider_id, region, patient_token AS token, claim_type AS type, status, claimed_amount AS claimed, approved_amount AS approved
      FROM claims WHERE (ref LIKE ? OR patient_token LIKE ? OR region LIKE ? OR status LIKE ?)
      ${['ROS','RVP'].includes(request.user.role) ? 'AND region = ?' : ''} ORDER BY ref`).all(...[q, q, q, q, ...(['ROS','RVP'].includes(request.user.role) ? [request.user.region] : [])]));
    return request.query.eventId ? rows.filter(c=>c.event_id===request.query.eventId) : rows;
  });
  app.get('/api/claims/:ref', { preHandler: validate(schemas.claim, 'params') }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if (request.user.role === 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const claim = (await claimRow(db, request.validated.ref));
    if (!claim || !canAccessClaim(request.user, claim)) return reply.code(404).send({ error: 'Claim not found.' });
    claim.history = (await db.prepare(`SELECT h.status, h.created_at AS at, COALESCE(u.username, 'system') AS actor, h.note
      FROM claim_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.claim_ref = ? ORDER BY h.id`).all(claim.ref));
    return claim;
  });
  app.post('/api/claims/:ref/status', { preHandler: [validate(schemas.claimStatus, 'params+body'), requireCsrf] }, async (request, reply) => {
    if (!guarded(['CFB', 'ROS'])(request, reply)) return;
    if(request.user.role==='ROS' && !['Under Review','Resubmitted'].includes(request.body?.status))return reply.code(403).send({error:'Regional encoders cannot approve or deny claims.'});
    const claim = (await claimRow(db, request.validated.ref));
    if (!claim || !canAccessClaim(request.user, claim)) return reply.code(404).send({ error: 'Claim not found.' });
    const { status, approved, note = '', reasonCode, overrideReason } = request.validated;
    const error = (await transitionError(db, claim, { status, approved, note, reasonCode, overrideReason }, request.user));
    if (error) return reply.code(422).send({ error });
    const transaction = db.withTransaction(async () => {
      const nextApproved = status === 'Approved' ? (approved ?? claim.approved) : claim.approved;
      (await db.prepare(`UPDATE claims SET status = ?, approved_amount = ?, reason_code = ?, note = ?,
        decision_date = CASE WHEN ? = 'Approved' THEN date('now') ELSE decision_date END WHERE ref = ?`)
        .run(status, nextApproved, reasonCode || null, note, status, claim.ref));
      (await db.prepare('INSERT INTO claim_history(claim_ref, status, actor_id, note) VALUES (?, ?, ?, ?)').run(claim.ref, status, request.user.id, note));
      (await appendAudit(db, request.user.id, 'UPDATE_STATUS', 'Claim', claim.ref, `Status changed to ${status}`, { status: claim.status }, { status, approved: nextApproved }));
    });
    (await transaction());
    (await scanExceptions(db));
    return (await claimRow(db, claim.ref));
  });
  app.get('/api/exceptions', { preHandler: validate(schemas.exceptions) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if(request.user.role==='ADM')return reply.code(403).send({error:'Permission denied.'});
    (await scanExceptions(db));
    const data=(await snapshot(db,request.query.eventId||(await event(db))?.id,request.user));
    if(!data)return reply.code(404).send({error:'Event not found.'});
    return data.exceptions;
  });
  app.post('/api/exceptions/:id/resolve', { preHandler: [requireCsrf, validate(schemas.resolveException, 'params+body')] }, async (request, reply) => {
    if (!guarded(['CFB', 'ROS'])(request, reply)) return;
    const row = (await db.prepare('SELECT e.*, c.region FROM exceptions e JOIN claims c ON c.ref = e.claim_ref WHERE e.id = ?').get(request.validated.id));
    if (!row || !canAccessClaim(request.user, row)) return reply.code(404).send({ error: 'Exception not found.' });
    if (!row.resolved_at) {
      (await db.prepare('UPDATE exceptions SET resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, resolution_note = ? WHERE id = ?').run(request.user.id, request.validated.note, row.id));
      (await appendAudit(db, request.user.id, 'RESOLVE', 'Exception', String(row.id), request.validated.note, { resolved: false }, { resolved: true }));
    }
    return { id: row.id, resolved: true };
  });
  app.get('/api/analytics', { preHandler: validate(schemas.analytics) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if (!['CFB','EXE','AUD'].includes(request.user.role))return reply.code(403).send({error:'Permission denied.'});
    const data=(await snapshot(db,request.query.eventId||(await event(db))?.id,request.user));
    if(!data)return reply.code(404).send({error:'Event not found.'});
    const change=Number(request.query.scenarioPct||0);
    if(!Number.isFinite(change)||Math.abs(change)>100)return reply.code(400).send({error:'Scenario must be between -100 and 100.'});
    const demand=data.regions.map(r=>({...r,demand:Math.max(0,r.approved-r.paid)}));
    const sum=demand.reduce((s,r)=>s+r.demand,0), fund=Math.max(0,data.totals.remaining);
    return {...data.forecast,scenarioPct:change,scenarioTotal:data.totals.committed+data.forecast.weekly*4*(1+change/100),allocation: demand.map(r=>({region:r.region,suggestion:sum?Math.floor(fund*r.demand/sum):0})),allocationMethod:'Proportional to approved-but-unpaid demand; advisory only.'};
  });
  app.get('/api/drill', { preHandler: validate(schemas.drill, 'query') }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if (request.user.role === 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const { metric } = request.validated;
    const sql = metric === 'status' ? 'SELECT ref, region, status, claimed_amount AS claimed, approved_amount AS approved FROM claims ORDER BY ref'
      : `SELECT c.ref, c.region, c.status, c.claimed_amount AS claimed, c.approved_amount AS approved FROM claims c
        JOIN exceptions e ON e.claim_ref = c.ref WHERE e.type = ? ORDER BY c.ref`;
    const type = metric === 'lateFiling' ? 'LateFiling' : metric === 'mismatch' ? 'Mismatch' : 'Late';
    const rows = metric === 'status' ? (await db.prepare(sql).all()) : (await db.prepare(sql).all(type));
    return request.user.role === 'ROS' || request.user.role === 'RVP' ? rows.filter(row => row.region === request.user.region) : rows;
  });
  app.get('/api/audit', { preHandler: validate(schemas.audit) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if(!['AUD','CFB'].includes(request.user.role))return reply.code(403).send({error:'Permission denied.'});
    const { page, pageSize } = request.validated;
    const total = (await db.prepare('SELECT COUNT(*) AS count FROM audit_log').get()).count;
    const allRows = (await db.prepare('SELECT * FROM audit_log ORDER BY id').all());
    const rows = (await db.prepare(`SELECT a.*, COALESCE(u.username, 'system') AS username FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT ? OFFSET ?`).all(pageSize, (page - 1) * pageSize));
    return {
      chainOk: auditChain(allRows),
      page,
      pageSize,
      total,
      rows: rows.map(row => ({ when: row.occurred_at, user: row.username, action: row.action, record: `${row.record_type} / ${row.record_id}`, reason: row.reason }))
    };
  });
  app.get('/api/events', { preHandler: validate(schemas.events) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if(request.query.summary==='1') return db.prepare('SELECT id,name FROM calamity_events ORDER BY id').all();
    return Promise.all((await db.prepare('SELECT e.*,d.starts_on,d.ends_on,d.circular_reference FROM calamity_events e LEFT JOIN event_details d ON d.event_id=e.id ORDER BY e.id').all()).map(async e=>{const d=(await snapshot(db,e.id,request.user));return {...e,totals:d.totals,signal:d.signal};}));
  });
  app.get('/api/reports', { preHandler: validate(schemas.reports) }, async (request, reply) => {
    if (!mustBeSignedIn(request, reply)) return;
    if(request.user.role==='ADM')return reply.code(403).send({error:'Permission denied.'});
    const data=(await snapshot(db,request.query.eventId||(await event(db))?.id,request.user));
    if(!data)return reply.code(404).send({error:'Event not found.'});
    return data;
  });
  if (serveFrontend) app.get('/*', async (request, reply) => {
    if (request.hostname === '127.0.0.1') return reply.redirect(`http://localhost:${request.headers.host.split(':')[1] || 3000}${request.raw.url}`);
    const relative = request.params['*'] || 'index.html';
    const file = resolve(frontendDir, relative === '' ? 'index.html' : relative);
    if (!file.startsWith(frontendDir + sep) || !existsSync(file)) return reply.code(404).send({ error: 'Not found.' });
    const canonical = realpathSync(file);
    if (!canonical.startsWith(frontendDir + sep) || !statSync(canonical).isFile()) return reply.code(404).send({ error: 'Not found.' });
    reply.type(staticTypes[extname(file)] || 'application/octet-stream');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(readFileSync(canonical));
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if((process.env.DB_DRIVER||'sqlite')==='sqlite')process.env.SEED_DEMO ??= '1';
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT || 3000), host: process.env.HOST || '127.0.0.1' });
  console.log(`PhilHealth Calamity Monitor (${app.db.driver}) running at http://localhost:${process.env.PORT || 3000}`);
}
