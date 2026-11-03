import { appendAudit, requireCsrf } from './auth.js';

const signedIn = (request, reply) => {
  if (!request.user) {
    reply.code(401).send({ error: 'Authentication required.' });
    return false;
  }
  return true;
};

const readBody = body => ({ id: String(body?.id || '').trim(), name: String(body?.name || '').trim(), budget: Number(body?.budget), allocations: body?.allocations || [], startsOn:String(body?.startsOn||''), endsOn:String(body?.endsOn||''), circularReference:String(body?.circularReference||'').trim() });

export function registerEventRoutes(app, db) {
  app.post('/api/events', { preHandler: requireCsrf }, async (request, reply) => {
    if (!signedIn(request, reply)) return;
    if (request.user.role !== 'CFB') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const event = readBody(request.body);
    if(!Array.isArray(event.allocations)||!event.allocations.length||event.allocations.some(r=>!r.region||!Number.isSafeInteger(r.amount)||r.amount<0)||new Set(event.allocations.map(r=>r.region)).size!==event.allocations.length)return reply.code(422).send({error:'Provide unique regions with nonnegative integer centavo allocations.'});
    if(!event.circularReference||!/^\d{4}-\d{2}-\d{2}$/.test(event.startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(event.endsOn)||event.startsOn>event.endsOn||[event.startsOn,event.endsOn].some(d=>!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))return reply.code(422).send({error:'Provide valid ordered event dates and a circular reference.'});
    if((await db.prepare('SELECT 1 FROM calamity_events WHERE id=?').get(event.id)))return reply.code(409).send({error:'Event ID already exists.'});
    const allocation = event.allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (!event.id || !event.name || !Number.isInteger(event.budget) || event.budget < 0) return reply.code(400).send({ error: 'Invalid event data.' });
    if (allocation > event.budget) return reply.code(422).send({ error: `Allocations exceed ceiling by ${allocation - event.budget} centavos.` });
    const transaction = db.withTransaction(async () => {
      (await db.prepare("INSERT INTO calamity_events(id, name, status, budget) VALUES (?, ?, 'Active', ?)").run(event.id, event.name, event.budget));
      const insert = db.prepare('INSERT INTO region_budgets(event_id, region, allocation) VALUES (?, ?, ?)');
      for (const row of event.allocations) await insert.run(event.id, String(row.region).trim(), Number(row.amount));
      (await db.prepare('INSERT INTO event_details(event_id,starts_on,ends_on,circular_reference) VALUES (?,?,?,?)').run(event.id,event.startsOn,event.endsOn,event.circularReference));
      (await appendAudit(db, request.user.id, 'CREATE', 'Event', event.id, 'Event created', {}, event));
    });
    (await transaction());
    return reply.code(201).send({ ...event, status: 'Active' });
  });

  app.post('/api/events/:id/close', { preHandler: requireCsrf }, async (request, reply) => {
    if (!signedIn(request, reply)) return;
    if (request.user.role !== 'EXE') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const result = (await db.prepare("UPDATE calamity_events SET status = 'Closed' WHERE id = ? AND status = 'Active'").run(request.params.id));
    if (!result.changes) return reply.code(422).send({ error: 'Only an Active event can be closed.' });
    (await db.prepare('UPDATE event_details SET closed_at=CURRENT_TIMESTAMP,closed_by=? WHERE event_id=?').run(request.user.id, request.params.id));
    (await appendAudit(db, request.user.id, 'CLOSE', 'Event', request.params.id, 'Event closed'));
    return { id: request.params.id, status: 'Closed' };
  });

  app.post('/api/events/:id/revisions', { preHandler: requireCsrf }, async (request, reply) => {
    if (!signedIn(request, reply)) return;
    if (request.user.role !== 'CFB') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const { allocation } = request.body || {};
    const region=String(request.body?.region||'').trim();
    if(!(await db.prepare('SELECT 1 FROM region_budgets WHERE event_id=? AND region=?').get(request.params.id,region)))return reply.code(422).send({error:'Select an existing event region.'});
    if (!region || !Number.isInteger(allocation) || allocation < 0) return reply.code(400).send({ error: 'Invalid revision data.' });
    const revision = (await db.prepare('SELECT COALESCE(MAX(revision), 0) + 1 AS value FROM event_budgets').get()).value;
    const row = (await db.prepare("INSERT INTO event_budgets(event_id, region, allocation, revision, proposed_by, status) VALUES (?, ?, ?, ?, ?, 'Proposed')")
      .run(request.params.id, region, allocation, revision, request.user.id));
    (await appendAudit(db, request.user.id, 'PROPOSE_REVISION', 'Event', request.params.id, 'Budget revision proposed'));
    return reply.code(201).send({ id: row.lastInsertRowid, revision });
  });

  app.post('/api/events/:id/revisions/:revision/approve', { preHandler: requireCsrf }, async (request, reply) => {
    if (!signedIn(request, reply)) return;
    if (request.user.role !== 'EXE') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const row = (await db.prepare("SELECT * FROM event_budgets WHERE event_id = ? AND id = ? AND status = 'Proposed'").get(request.params.id, Number(request.params.revision)));
    if (!row) return reply.code(404).send({ error: 'Revision not found.' });
    const event=(await db.prepare('SELECT budget FROM calamity_events WHERE id=?').get(row.event_id));
    const other=(await db.prepare('SELECT COALESCE(SUM(allocation),0) AS n FROM region_budgets WHERE event_id=? AND region<>?').get(row.event_id,row.region)).n;
    if(other+row.allocation>event.budget)return reply.code(422).send({error:'Regional allocations exceed the event ceiling.'});
    (await db.withTransaction(async () => {
      (await db.prepare("UPDATE event_budgets SET status = 'Approved', approved_by = ? WHERE id = ?").run(request.user.id, row.id));
      (await db.prepare('UPDATE region_budgets SET allocation = ? WHERE event_id = ? AND region = ?').run(row.allocation, row.event_id, row.region));
      (await appendAudit(db, request.user.id, 'APPROVE_REVISION', 'Event', request.params.id, 'Budget revision approved'));
    })());
    return { id: row.id, status: 'Approved' };
  });
}
