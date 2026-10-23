import { appendAudit, requireCsrf } from './auth.js';
export function registerModuleRoutes(app,db){
 const guard=(req,reply,roles)=>{if(!req.user){reply.code(401).send({error:'Authentication required.'});return false;}if(roles&&!roles.includes(req.user.role)){reply.code(403).send({error:'Permission denied.'});return false;}return true;};
 app.get('/api/providers',async(req,reply)=>{if(!guard(req,reply))return;return db.prepare('SELECT * FROM providers ORDER BY name').all().filter(r=>!['ROS','RVP'].includes(req.user.role)||r.region===req.user.region);});
 app.get('/api/requests',async(req,reply)=>{if(!guard(req,reply,['CFB','EXE','ROS','RVP','AUD']))return;return db.prepare('SELECT r.*,p.name,p.region FROM provider_requests r JOIN providers p ON p.id=r.provider_id ORDER BY r.id DESC').all().filter(r=>(!req.query.eventId||r.event_id===req.query.eventId)&&(!['ROS','RVP'].includes(req.user.role)||r.region===req.user.region)).map(r=>({...r,history:db.prepare('SELECT d.*,u.username FROM request_decisions d JOIN users u ON u.id=d.actor_id WHERE request_id=? ORDER BY d.id').all(r.id)}));});
 app.post('/api/requests',{preHandler:requireCsrf},async(req,reply)=>{
 if(!guard(req,reply,['CFB','ROS']))return;const d=req.body||{};const provider=db.prepare('SELECT * FROM providers WHERE id=?').get(d.providerId||0);
 if(!provider||!['A','B'].includes(d.route)||!Number.isSafeInteger(d.amount)||d.amount<=0||!String(d.note||'').trim()||!db.prepare("SELECT 1 FROM calamity_events WHERE id=? AND status='Active'").get(d.eventId||''))return reply.code(422).send({error:'Event, provider, Route A/B, positive centavos and note required.'});
 if(req.user.role==='ROS'&&provider.region!==req.user.region)return reply.code(403).send({error:'Outside your region.'});
 return db.transaction(()=>{const id=db.prepare('INSERT INTO provider_requests(event_id,provider_id,route,amount,note,created_by) VALUES(?,?,?,?,?,?)').run(d.eventId,d.providerId,d.route,d.amount,d.note,req.user.id).lastInsertRowid;appendAudit(db,req.user.id,'CREATE','ProviderRequest',String(id),'Provider request registered',{},d);return {id};})();
 });
 app.post('/api/requests/:id/decisions',{preHandler:requireCsrf},async(req,reply)=>{
 if(!guard(req,reply,['CFB','EXE','RVP']))return;const r=db.prepare('SELECT r.*,p.region FROM provider_requests r JOIN providers p ON p.id=r.provider_id WHERE r.id=?').get(req.params.id);const d=req.body||{};
 if(!r)return reply.code(404).send({error:'Request not found.'});if(r.created_by===req.user.id||(req.user.role==='RVP'&&r.region!==req.user.region))return reply.code(403).send({error:'Independent approver in the permitted region required.'});
 if(!['Approved','Denied','Returned'].includes(d.decision)||!String(d.note||'').trim())return reply.code(422).send({error:'Decision and reason required.'});
 return db.transaction(()=>{const id=db.prepare('INSERT INTO request_decisions(request_id,decision,note,actor_id) VALUES(?,?,?,?)').run(r.id,d.decision,d.note,req.user.id).lastInsertRowid;appendAudit(db,req.user.id,'DECISION','ProviderRequest',String(r.id),d.note,{},d);return {id};})();
 });
 app.get('/api/audit/evidence',async(req,reply)=>{if(!guard(req,reply,['AUD','CFB']))return;reply.header('Content-Disposition','attachment; filename="audit-evidence.json"');return db.prepare('SELECT * FROM audit_log ORDER BY id').all();});
 // Future delivery adapter: dashboard is the only implemented notification channel.
 // Connect an email/SMS adapter here only after separate owner authorization.
}
