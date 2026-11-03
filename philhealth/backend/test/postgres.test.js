import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../server.js';
import {postgresClient,postgresSql} from '../postgres.js';
import ExcelJS from 'exceljs';

test('PostgreSQL SQL translation preserves literals and binds values',()=>{
 assert.equal(postgresSql("SELECT * FROM claims WHERE ref=? AND note='claims ?'"),"SELECT * FROM app_runtime_claims WHERE ref=$1 AND note='claims ?'");
 assert.match(postgresSql('INSERT INTO exceptions(claim_ref,type,reason) VALUES(?,?,?) ON CONFLICT(claim_ref,type) DO UPDATE SET reason=excluded.reason'),/DO UPDATE SET/);
 assert.throws(()=>postgresSql('SELECT * FROM unknown_table'),/Unmapped/);
});

test('Aiven integration: illustrative workflows and preservation of existing rows',{skip:!process.env.DATABASE_URL,timeout:120000},async t=>{
 const client=postgresClient();await client.connect();t.after(()=>client.end());
 const nativeTables=['users','roles','regions','events','event_allocations','claims','claim_status_history','payments','exceptions','audit_log','app_settings','provider_requests','providers','request_approvals','role_permissions','import_batches'];
 async function hashes(){const result={};for(const table of nativeTables)result[table]=(await client.query(`SELECT md5(t::text) AS hash FROM public.${table} t`)).rows.map(r=>r.hash);return result;}
 const before=await hashes();
 const app=await buildApp({serveFrontend:false});t.after(()=>app.close());
 const suffix=Date.now().toString(36);
 const id='TEST-'+suffix;
 const ref='CLM-'+suffix;
 const accounts={};
 const post=(h,url,payload)=>app.inject({method:'POST',url,headers:h,payload});
 async function login(name){
  const pre=await app.inject('/api/csrf');assert.equal(pre.statusCode,200);
  const r=await post({cookie:pre.headers['set-cookie'].split(';')[0],'x-csrf-token':pre.json().csrfToken},'/api/login',{username:'demo_'+name,password:'demo1234'});
  assert.equal(r.statusCode,200,r.body);
  return {cookie:r.headers['set-cookie'].split(';')[0],'x-csrf-token':r.json().csrfToken};
 }
 await t.test('all mapped test roles authenticate using Argon2',async()=>{for(const name of ['cfb','act','exe','aud','adm','ros_xi','ros_vii','ros_iva','rvp_vii'])accounts[name]=await login(name);});
 await t.test('CSRF and read-only auditor permissions',async()=>{
  assert.equal((await post({cookie:accounts.cfb.cookie},'/api/events',{})).statusCode,403);
  assert.equal((await post(accounts.aud,'/api/events',{})).statusCode,403);
 });
 let provider;
 await t.test('event, provider and validated claim entry with exact peso conversion',async()=>{
  const r=await post(accounts.cfb,'/api/events',{id,name:'Illustrative integration test '+suffix,budget:1000000,startsOn:'2026-01-01',endsOn:'2026-12-31',circularReference:'Illustrative testing only',allocations:[{region:'XI',amount:900000},{region:'VII',amount:100000}]});assert.equal(r.statusCode,201,r.body);
  const p=await post(accounts.ros_xi,'/api/providers',{name:'Illustrative test provider '+suffix,region:'XI'});assert.equal(p.statusCode,200,p.body);provider=p.json().id;
  const data={ref,eventId:id,region:'XI',token:'PT-123456',type:'Inpatient',claimed:12345,providerId:provider,dischargeDate:'2026-11-01',filingDate:'2026-11-02'};
  const created=await post(accounts.ros_xi,'/api/claims',data);assert.equal(created.statusCode,201,created.body);
  assert.equal((await client.query('SELECT submitted_amount::text AS amount FROM claims WHERE claim_ref=$1',[ref])).rows[0].amount,'123.45');
  assert.equal((await post(accounts.ros_xi,'/api/claims',data)).statusCode,422);
  assert.equal((await post(accounts.ros_xi,'/api/claims',{...data,ref:ref+'-BAD',dischargeDate:undefined})).statusCode,422);
 });
 await t.test('regional isolation, independent approval, partial/full payment and reconciliation',async()=>{
  assert.equal((await post(accounts.ros_xi,`/api/claims/${ref}/status`,{status:'Approved',approved:12345})).statusCode,403);
  assert.equal((await post(accounts.cfb,`/api/claims/${ref}/status`,{status:'Under Review'})).statusCode,200);
  assert.equal((await post(accounts.cfb,`/api/claims/${ref}/status`,{status:'Approved',approved:12345})).statusCode,200);
  const partial=await post(accounts.act,`/api/claims/${ref}/payment`,{amount:123,paidAt:'2026-11-03',note:'Illustrative partial payment'});assert.equal(partial.statusCode,200,partial.body);assert.equal(partial.json().paid,123);
  assert.equal((await post(accounts.act,`/api/claims/${ref}/payment`,{amount:12345,paidAt:'2026-11-03'})).statusCode,422);
  const full=await post(accounts.act,`/api/claims/${ref}/payment`,{amount:12222,paidAt:'2026-11-03'});assert.equal(full.statusCode,200,full.body);assert.equal(full.json().paid,12345);
  assert.equal((await post(accounts.act,`/api/claims/${ref}/reconcile`,{note:'Illustrative full match'})).statusCode,200);
  const local=(await app.inject({url:'/api/dashboard?eventId='+id,headers:accounts.ros_vii})).json();assert.equal(local.claims.length,0);assert.equal(local.totals.ceiling,100000);
 });
 await t.test('CSV preview does not write and commit is atomic',async()=>{
  const csv=`ref,event_id,region,token,type,claimed,provider_id,filing_date,discharge_date\nCSV-${suffix},${id},XI,PT-999999,Inpatient,54321,${provider},2026-11-02,2026-11-01`;
  const preview=await post(accounts.ros_xi,'/api/claims/import',{csv});assert.equal(preview.statusCode,200,preview.body);assert.equal(preview.json().committed,false);assert.equal(preview.json().accepted.length,1);
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM claims WHERE claim_ref=$1',['CSV-'+suffix])).rows[0].n,0);
  const commit=await post(accounts.ros_xi,'/api/claims/import',{csv,commit:true});assert.equal(commit.json().committed,true,commit.body);
  const again=await post(accounts.ros_xi,'/api/claims/import',{csv,commit:true});assert.equal(again.json().committed,false);
 });
 await t.test('a failed CSV commit rolls back every accepted row',async()=>{
  const first='ROLL-'+suffix;
  const csv=`ref,event_id,region,token,type,claimed,provider_id,filing_date,discharge_date\n${first},${id},XI,PT-812345,Inpatient,101,${provider},2026-11-02,2026-11-01\n${'X'.repeat(40)},${id},XI,PT-812346,Inpatient,102,${provider},2026-11-02,2026-11-01`;
  const r=await post(accounts.ros_xi,'/api/claims/import',{csv,commit:true});assert.equal(r.statusCode,422,r.body);
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM claims WHERE claim_ref=$1',[first])).rows[0].n,0);
 });
 await t.test('settings and allocation revisions use application-owned history',async()=>{
  const settings=await app.inject({method:'PUT',url:'/api/settings/as_of_date',headers:accounts.adm,payload:{value:'2026-11-03',reason:'Illustrative testing date'}});assert.equal(settings.statusCode,200,settings.body);
  const revision=await post(accounts.cfb,`/api/events/${id}/revisions`,{region:'XI',allocation:850000});assert.equal(revision.statusCode,201,revision.body);
  const approved=await post(accounts.exe,`/api/events/${id}/revisions/${revision.json().id}/approve`,{});assert.equal(approved.statusCode,200,approved.body);
 });
 await t.test('requests, amendments and decisions preserve immutable evidence',async()=>{
  const r=await post(accounts.ros_xi,'/api/requests',{eventId:id,providerId:provider,route:'A',amount:5000,note:'Illustrative test request'});assert.equal(r.statusCode,200,r.body);
  const path='/api/requests/'+r.json().id;
  assert.equal((await post(accounts.ros_xi,path+'/amendments',{route:'B',amount:6000,note:'Illustrative change'})).statusCode,200);
  assert.equal((await post(accounts.cfb,path+'/decisions',{decision:'Approved',note:'Illustrative independent decision'})).statusCode,200);
  const list=await app.inject({url:'/api/requests?eventId='+id,headers:accounts.cfb});assert.equal(list.statusCode,200,list.body);assert.equal(list.json()[0].history.length,1);assert.equal(list.json()[0].amendments.length,1);
  await assert.rejects(app.db.withTransaction(()=>app.db.prepare('DELETE FROM request_decisions WHERE request_id=?').run(r.json().id))(),/immutable/);
 });
 await t.test('six reports share dashboard totals and all export formats load',async()=>{
  const dash=await app.inject({url:'/api/dashboard?eventId='+id,headers:accounts.cfb});assert.equal(dash.statusCode,200,dash.body);
  const totals=dash.json().totals;assert.equal(totals.committed,12345);assert.equal(totals.paid,12345);
  const report=await app.inject({url:'/api/reports?eventId='+id,headers:accounts.cfb});assert.deepEqual(report.json().totals,totals);
  for(let type=0;type<6;type++)for(const format of ['csv','xlsx','pdf']){
   const r=await app.inject({url:`/api/reports.${format}?eventId=${id}&type=${type}`,headers:accounts.cfb});assert.equal(r.statusCode,200,r.body.slice(0,150));
   if(format==='csv')assert.match(r.body,/12345/);
   if(format==='pdf')assert.equal(r.rawPayload.subarray(0,4).toString(),'%PDF');
   if(format==='xlsx'){const book=new ExcelJS.Workbook();await book.xlsx.load(r.rawPayload);assert.ok(book.worksheets[0].rowCount>4);}
  }
 });
 await t.test('existing Aiven events reject writes; audit chain and history stay immutable',async()=>{
  const old=(await client.query('SELECT event_code FROM events WHERE event_code NOT IN (SELECT event_code FROM app_owned_events) LIMIT 1')).rows[0];assert.ok(old);
  const closed=await post(accounts.exe,`/api/events/${old.event_code}/close`,{});assert.equal(closed.statusCode,422,closed.body);
  const audit=await app.inject({url:'/api/audit',headers:accounts.cfb});assert.equal(audit.statusCode,200,audit.body);assert.equal(audit.json().chainOk,true);
  const legacy=await app.inject({url:'/api/audit/legacy',headers:accounts.aud});assert.equal(legacy.statusCode,200,legacy.body);assert.equal(legacy.json().chainVerified,false);
  const evidence=await app.inject({url:'/api/audit/evidence',headers:accounts.aud});assert.equal(evidence.statusCode,200);assert.ok(evidence.json().some(r=>r.record_id===ref));
  await assert.rejects(app.db.withTransaction(()=>app.db.prepare("UPDATE audit_log SET reason='tampered' WHERE record_id=?").run(ref))(),/immutable/);
 });
 await t.test('five bad logins trigger lockout',async()=>{
  const pre=await app.inject('/api/csrf');const h={cookie:pre.headers['set-cookie'].split(';')[0],'x-csrf-token':pre.json().csrfToken};
  for(let i=0;i<5;i++)assert.equal((await post(h,'/api/login',{username:'test_'+suffix,password:'incorrect'})).statusCode,401);
  assert.equal((await post(h,'/api/login',{username:'test_'+suffix,password:'incorrect'})).statusCode,429);
 });
 await t.test('every native business row present before the test is unchanged',async()=>{
  const after=await hashes();for(const table of nativeTables){const remaining=[...after[table]];for(const hash of before[table]){const index=remaining.indexOf(hash);assert.notEqual(index,-1,table+' existing row changed');remaining.splice(index,1);}}
 });
});
