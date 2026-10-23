import { parse } from 'csv-parse/sync';
import { claimError } from './finance.js';
import { appendAudit, requireCsrf } from './auth.js';
import { canAccessClaim, paidAmount, transitionError } from './rules.js';
import { schemas, validate } from './routes/schemas.js';
import { scanExceptions } from './exceptions.js';

const authenticated = (request, reply) => {
  if (!request.user) {
    reply.code(401).send({ error: 'Authentication required.' });
    return false;
  }
  return true;
};

const claimFor = (db, ref) => db.prepare(`SELECT ref, event_id, region, status, claimed_amount AS claimed,
  approved_amount AS approved, encoded_by, discharge_date FROM claims WHERE ref = ?`).get(ref);

function currentDate(db) {
  return db.prepare("SELECT value FROM settings WHERE key = 'as_of_date'").get().value;
}

function validDate(value, asOf) {
  return !value || (Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value && value <= asOf);
}

function csvRows(text) {
 const records=parse(text,{bom:true,skip_empty_lines:true,trim:true});
 const headers=(records.shift()||[]).map(h=>h.toLowerCase());
 if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV headers.');
 return {headers,rows:records};
}

export function registerWorkflowRoutes(app, db) {
  app.post('/api/claims/import', { preHandler: requireCsrf }, async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ROS') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const input = typeof request.body === 'string' ? request.body : request.body?.csv;
    if (!input) return reply.code(400).send({ error: 'CSV content is required.' });
    let parsedCsv;try{parsedCsv=csvRows(input);}catch{return reply.code(400).send({error:'Malformed CSV: check quotes, headers and column counts.'});}
    const {headers,rows}=parsedCsv;
    if (headers.includes('patient_name')) return reply.code(422).send({ error: 'CSV must not contain patient_name.' });
    const required = ['ref', 'event_id', 'region', 'token', 'type', 'claimed','provider_id','filing_date'];
    if (!required.every(header => headers.includes(header))) return reply.code(400).send({ error: 'CSV headers do not match the sample format.' });
    const result = { accepted: [], rejected: [], committed:false };
    const entries=[];const refs=new Set();const fingerprints=new Set();
    for(let i=0;i<rows.length;i++) {
      const raw=Object.fromEntries(headers.map((h,j)=>[h,rows[i][j]||'']));
      const parsed=schemas.createClaim.safeParse({ref:raw.ref,eventId:raw.event_id,region:raw.region,token:raw.token,type:raw.type,claimed:Number(raw.claimed),providerId:Number(raw.provider_id),filingDate:raw.filing_date,dischargeDate:raw.discharge_date||undefined,note:raw.note||undefined});
      let error=!parsed.success?{field:parsed.error.issues[0].path.join('.'),error:parsed.error.issues[0].message}:claimError(db,parsed.data);
      const fingerprint=[raw.event_id,raw.provider_id,raw.token,raw.discharge_date,raw.claimed].join('|');
      if(!error&&(refs.has(raw.ref)||fingerprints.has(fingerprint)))error={field:'ref',error:'Duplicate row in this import.'};
      if(!error&&raw.region!==request.user.region)error={field:'region',error:'Outside your region.'};
      refs.add(raw.ref);fingerprints.add(fingerprint);
      if(error)result.rejected.push({row:i+2,...error});else{entries.push(parsed.data);result.accepted.push({row:i+2,ref:raw.ref});}
    }
    if(request.body?.commit===true && !result.rejected.length)db.transaction(()=>{
      for(const d of entries){
        db.prepare("INSERT INTO claims(ref,event_id,region,patient_token,claim_type,status,claimed_amount,provider_id,filing_date,discharge_date,encoded_by,note) VALUES(?,?,?,?,?,'Submitted',?,?,?,?,?,?)").run(d.ref,d.eventId,d.region,d.token,d.type,d.claimed,d.providerId,d.filingDate,d.dischargeDate||null,request.user.id,d.note||'');
        db.prepare("INSERT INTO claim_history(claim_ref,status,actor_id) VALUES(?,'Submitted',?)").run(d.ref,request.user.id);
        appendAudit(db,request.user.id,'CREATE','Claim',d.ref,'CSV claim imported',{},d);
      }
      result.committed=true;
    })();
    if(result.committed)scanExceptions(db);
    return result;
  });

  app.post('/api/claims', { preHandler: [validate(schemas.createClaim), requireCsrf] }, async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ROS') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const data = request.validated;
    const invalid=claimError(db,data);if(invalid)return reply.code(422).send(invalid);
    if (data.region !== request.user.region) return reply.code(404).send({ error: 'Claim not found.' });
    const event = db.prepare('SELECT status FROM calamity_events WHERE id = ?').get(data.eventId);
    if (!event || event.status !== 'Active') return reply.code(422).send({ error: 'Claims can only be added to an Active event.' });
    const asOf = currentDate(db);
    if (![data.dischargeDate, data.filingDate].every(value => validDate(value, asOf))) {
      return reply.code(422).send({ error: 'Claim dates cannot be in the future.' });
    }
    db.prepare(`INSERT INTO claims(ref, event_id, region, patient_token, claim_type, status, claimed_amount,
      provider_id, discharge_date, filing_date, encoded_by, note) VALUES (?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?)`)
      .run(data.ref, data.eventId, data.region, data.token, data.type, data.claimed, data.providerId || null,
        data.dischargeDate || null, data.filingDate || null, request.user.id, data.note || '');
    db.prepare('INSERT INTO claim_history(claim_ref, status, actor_id, note) VALUES (?, ?, ?, ?)')
      .run(data.ref, 'Submitted', request.user.id, data.note || '');
    appendAudit(db, request.user.id, 'CREATE', 'Claim', data.ref, 'Claim encoded', {}, { status: 'Submitted' });
    scanExceptions(db);
    return reply.code(201).send(claimFor(db, data.ref));
  });

  app.post('/api/claims/:ref/payment', { preHandler: [validate(schemas.payment), requireCsrf] }, async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ACT') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const claim = claimFor(db, request.params.ref);
    if (!claim || !canAccessClaim(request.user, claim)) return reply.code(404).send({ error: 'Claim not found.' });
    if (!['Approved','Paid'].includes(claim.status)) return reply.code(422).send({ error: 'Only an Approved claim can be paid.' });
    const payment = request.validated;
    if(payment.amount+paidAmount(db,claim.ref)>claim.approved)return reply.code(422).send({error:'Payment exceeds approved unpaid balance.'});
    if (!validDate(payment.paidAt, currentDate(db))) return reply.code(422).send({ error: 'Payment date cannot be in the future.' });
    const transaction = db.transaction(() => {
      db.prepare('INSERT INTO payments(claim_ref, amount, paid_at, recorded_by, note) VALUES (?, ?, ?, ?, ?)')
        .run(claim.ref, payment.amount, payment.paidAt, request.user.id, payment.note || '');
      db.prepare("UPDATE claims SET status = 'Paid' WHERE ref = ?").run(claim.ref);
      db.prepare("INSERT INTO claim_history(claim_ref, status, actor_id, note) VALUES (?, 'Paid', ?, ?)")
        .run(claim.ref, request.user.id, payment.note || '');
      appendAudit(db, request.user.id, 'PAYMENT', 'Claim', claim.ref, 'Payment recorded', { status: claim.status }, { status: 'Paid', amount: payment.amount });
    });
    transaction();
    scanExceptions(db);
    return { ref: claim.ref, status: 'Paid', paid: paidAmount(db, claim.ref) };
  });

  app.get('/api/settings', async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    return db.prepare('SELECT key, value, updated_at AS updatedAt FROM settings ORDER BY key').all();
  });

  app.put('/api/settings/:key', { preHandler: [validate(schemas.settings), requireCsrf] }, async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ADM') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const old = db.prepare('SELECT value FROM settings WHERE key = ?').get(request.params.key);
    if (!old) return reply.code(404).send({ error: 'Setting not found.' });
    const { value, reason } = request.validated;
    const key=request.params.key;
    const all=Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));all[key]=value;
    if(key.endsWith('_pct')&& !(Number(all.warning_pct)>0&&Number(all.warning_pct)<Number(all.danger_pct)&&Number(all.danger_pct)<Number(all.critical_pct)&&Number(all.critical_pct)<=1000))return reply.code(422).send({error:'Thresholds must be positive and ordered warning < danger < critical.'});
    if(['aging_days','z_threshold','filing_deadline_days'].includes(key)&&(!Number.isFinite(Number(value))||Number(value)<=0))return reply.code(422).send({error:'Enter a positive numeric setting.'});
    if(key==='as_of_date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return reply.code(422).send({error:'Enter a valid ISO date.'});
    db.transaction(() => {
      db.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = ?")
        .run(value, request.user.id, request.params.key);
      db.prepare('INSERT INTO settings_changes(setting_key, old_value, new_value, reason, actor_id) VALUES (?, ?, ?, ?, ?)')
        .run(request.params.key, old.value, value, reason, request.user.id);
      appendAudit(db, request.user.id, 'SETTINGS_CHANGE', 'Setting', request.params.key, reason, { value: old.value }, { value });
    })();
    return { key: request.params.key, value };
  });

  app.post('/api/claims/:ref/reconcile', { preHandler: [validate(schemas.reconcile), requireCsrf] }, async (request, reply) => {
    if (!authenticated(request, reply)) return;
    if (request.user.role !== 'ACT') return reply.code(403).send({ error: 'Your role is not allowed to perform this action.' });
    const claim = claimFor(db, request.params.ref);
    if (!claim) return reply.code(404).send({ error: 'Claim not found.' });
    const note = request.validated.note || '';
    const error = transitionError(db, claim, { status: 'Reconciled', note }, request.user);
    if (error) return reply.code(422).send({ error });
    db.prepare("UPDATE claims SET status = 'Reconciled', note = ? WHERE ref = ?").run(note, claim.ref);
    db.prepare("INSERT INTO claim_history(claim_ref, status, actor_id, note) VALUES (?, 'Reconciled', ?, ?)").run(claim.ref, request.user.id, note);
    appendAudit(db, request.user.id, 'RECONCILE', 'Claim', claim.ref, 'Claim reconciled', { status: 'Paid' }, { status: 'Reconciled' });
    scanExceptions(db);
    return { ref: claim.ref, status: 'Reconciled' };
  });
}
