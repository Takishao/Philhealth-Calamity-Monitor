import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server.js';
import { financials,signal,zScore,ageDays,movingAverage,snapshot } from '../finance.js';
import { reportRows } from '../reports.js';
import ExcelJS from 'exceljs';
async function login(app,username='cfb'){
 const pre=await app.inject('/api/csrf');const r=await app.inject({method:'POST',url:'/api/login',headers:{cookie:pre.headers['set-cookie'].split(';')[0],'x-csrf-token':pre.json().csrfToken},payload:{username,password:'demo1234'}});
 assert.equal(r.statusCode,200);return {cookie:r.headers['set-cookie'].split(';')[0],'x-csrf-token':r.json().csrfToken};
}
const post=(app,h,url,payload)=>app.inject({method:'POST',url,headers:h,payload});
const fixture={ref:'NEW-1',eventId:'SAMPLE',region:'XI',token:'PT-12345',type:'Inpatient',claimed:10000,providerId:1,filingDate:'2026-08-01',dischargeDate:'2026-07-31'};
test('worked example: B50M A40M P32M; exact formulas and zero ceiling safety',()=>{
 const t=financials(5000000000,4000000000,3200000000);assert.deepEqual(t,{ceiling:5000000000,committed:4000000000,paid:3200000000,remaining:1000000000,utilization:80,paidUtilization:64,unpaid:800000000,variance:-1000000000,variancePct:-20});assert.equal(financials(0,0,0).utilization,0);
});
test('inclusive thresholds, configurable defaults and forecast alert',()=>{const s={warning_pct:80,danger_pct:90,critical_pct:100};for(const[p,l]of[[79,'normal'],[80,'warning'],[90,'danger'],[100,'critical']])assert.equal(signal(p,s).level,l);assert.equal(signal(50,s,101,100).level,'critical');assert.equal(signal(75,{warning_pct:70,danger_pct:85,critical_pct:95}).level,'warning');});
test('population z-score, zero variance, aging boundaries, 3-week moving average',()=>{assert.equal(zScore(3,[1,2,3]),Math.sqrt(1.5));assert.equal(zScore(4,[4,4]),0);assert.equal(ageDays('2026-01-01','2026-01-31'),30);assert.equal(ageDays('2026-02-01','2026-01-01'),0);assert.equal(movingAverage([100,10,20,30]),20);assert.equal(movingAverage([]),0);});
test('selected-event dashboard and all six report exports share totals and real payments',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app);
 const dash=(await app.inject({url:'/api/dashboard?eventId=SAMPLE',headers:h})).json();assert.equal(dash.totals.committed,4000000000);assert.equal(dash.totals.paid,3200000000);assert.equal(dash.signal.level,'warning');
 const report=(await app.inject({url:'/api/reports?eventId=SAMPLE',headers:h})).json();assert.deepEqual(report.totals,dash.totals);
 for(let type=0;type<6;type++){for(const format of ['csv','xlsx','pdf']){const r=await app.inject({url:`/api/reports.${format}?eventId=SAMPLE&type=${type}`,headers:h});assert.equal(r.statusCode,200);if(format==='csv')assert.match(r.body,/4000000000/);if(format==='pdf')assert.equal(r.rawPayload.subarray(0,4).toString(),'%PDF');if(format==='xlsx'){const w=new ExcelJS.Workbook();await w.xlsx.load(r.rawPayload);assert.ok(w.worksheets[0].rowCount>4);}}}
 const data=(await snapshot(app.db,'SAMPLE',{role:'CFB'}));const rec=reportRows(data,4).slice(1);assert.equal(rec.reduce((a,r)=>a+r[1],0),dash.totals.committed);assert.equal(rec.reduce((a,r)=>a+r[2],0),dash.totals.paid);
});
test('entry validation rejects duplicate reference/composite, negative amounts, invalid dates and provider',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app,'ros_xi');
 assert.equal((await post(app,h,'/api/claims',fixture)).statusCode,201);
 for(const f of [{...fixture},{...fixture,ref:'OTHER'},{...fixture,ref:'NEG',claimed:-1},{...fixture,ref:'DATE',filingDate:'2027-01-01'},{...fixture,ref:'NO-P',providerId:undefined},{...fixture,ref:'BAD-DATE',filingDate:'2026-02-30'}]){const r=await post(app,h,'/api/claims',f);assert.ok([400,422].includes(r.statusCode),r.body);}
});
test('allocation creation and revision cannot exceed ceiling; dates and circular required',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app);const e={id:'TEST',name:'Test illustrative',budget:100,startsOn:'2026-01-01',endsOn:'2026-12-31',circularReference:'Illustrative',allocations:[{region:'XI',amount:101}]};assert.equal((await post(app,h,'/api/events',e)).statusCode,422);e.allocations[0].amount=100;assert.equal((await post(app,h,'/api/events',e)).statusCode,201);const r=await post(app,h,'/api/events/TEST/revisions',{region:'XI',allocation:200});assert.equal(r.statusCode,201);const exe=await login(app,'exe');assert.equal((await post(app,exe,`/api/events/TEST/revisions/${r.json().revision}/approve`,{})).statusCode,422);
});
test('CSV preview writes nothing; reports row field error; atomic revalidated commit',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app,'ros_xi');const csv='ref,event_id,region,token,type,claimed,provider_id,filing_date,discharge_date\nCSV-1,SAMPLE,XI,PT-12345,Inpatient,10000,1,2026-08-01,2026-07-31';
 const r=await post(app,h,'/api/claims/import',{csv});assert.equal(r.json().accepted.length,1);assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM claims WHERE ref='CSV-1'").get().n,0);assert.equal((await post(app,h,'/api/claims/import',{csv,commit:true})).json().committed,true);const bad=await post(app,h,'/api/claims/import',{csv,commit:true});assert.equal(bad.json().committed,false);assert.equal(bad.json().rejected[0].field,'ref');
});
test('partial payments remain visible and automatically match when full; reject overpayment',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app,'act');const ref='SAMPLE-UNPAID';const before=(await snapshot(app.db,'SAMPLE',{role:'CFB'})).totals;
 assert.equal((await post(app,h,`/api/claims/${ref}/payment`,{amount:100,paidAt:'2026-08-01'})).statusCode,200);assert.equal((await snapshot(app.db,'SAMPLE',{role:'CFB'})).totals.unpaid,before.unpaid-100);
 assert.equal((await post(app,h,`/api/claims/${ref}/payment`,{amount:800000000,paidAt:'2026-08-01'})).statusCode,422);
 assert.equal((await post(app,h,`/api/claims/${ref}/payment`,{amount:799999900,paidAt:'2026-08-01'})).statusCode,200);assert.equal((await snapshot(app.db,'SAMPLE',{role:'CFB'})).totals.unpaid,0);
});
test('auditor is read-only; regional isolation covers dashboard and reports; audit immutable',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const aud=await login(app,'aud');assert.equal((await post(app,aud,'/api/claims',fixture)).statusCode,403);assert.equal((await post(app,aud,'/api/requests',{eventId:'SAMPLE'})).statusCode,403);assert.throws(()=>app.db.prepare("UPDATE audit_log SET reason='tampered'").run(),/immutable/);assert.throws(()=>app.db.prepare('DELETE FROM audit_log').run(),/immutable/);
 const ros=await login(app,'ros_vii');const d=(await app.inject({url:'/api/dashboard?eventId=SAMPLE',headers:ros})).json();assert.equal(d.totals.committed,0);assert.equal(d.claims.length,0);const claims=(await app.inject({url:'/api/claims',headers:ros})).json();assert.ok(claims.every(c=>c.region==='VII'));assert.equal((await post(app,ros,'/api/claims/CLM-001-VII-00012/status',{status:'Approved'})).statusCode,403);
});
test('Route A/B request decisions append history with independent approver and evidence',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const ros=await login(app,'ros_xi'),cfb=await login(app),exe=await login(app,'exe');
 for(const route of ['A','B']){const r=await post(app,ros,'/api/requests',{eventId:'SAMPLE',providerId:1,route,amount:10000,note:'Illustrative request'});assert.equal(r.statusCode,200);for(const [h,decision]of[[cfb,'Approved'],[exe,'Returned']])assert.equal((await post(app,h,`/api/requests/${r.json().id}/decisions`,{decision,note:'Illustrative decision'})).statusCode,200);}
 const list=(await app.inject({url:'/api/requests?eventId=SAMPLE',headers:cfb})).json();assert.equal(list.length,2);assert.ok(list.every(r=>r.history.length===2));assert.throws(()=>app.db.prepare('DELETE FROM request_decisions').run(),/immutable/);assert.equal((await app.inject({url:'/api/audit',headers:cfb})).json().chainOk,true);
});
test('settings validate ordered numeric thresholds and immediately recalculate alert state',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app,'adm');const update=value=>app.inject({method:'PUT',url:'/api/settings/warning_pct',headers:h,payload:{value,reason:'Illustrative threshold test'}});assert.equal((await update('abc')).statusCode,422);assert.equal((await update('95')).statusCode,422);assert.equal((await update('40')).statusCode,200);assert.equal((await snapshot(app.db,'DEMO-NORMAL',{role:'CFB'})).signal.level,'warning');
});
test('live weekly commitments drive moving-average forecast and projected breach date',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());
 app.db.prepare("UPDATE claims SET decision_date='2026-10-15' WHERE event_id='DEMO-NORMAL'").run();
 const d=(await snapshot(app.db,'DEMO-NORMAL',{role:'CFB'}));assert.equal(d.forecast.weekly,2500000000/3);assert.ok(d.forecast.projected>d.totals.ceiling);assert.ok(d.forecast.breachDate);assert.equal(d.signal.level,'critical');
});
test('CSV quoted multiline notes parse and malformed input is rejected',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const h=await login(app,'ros_xi');
 const csv='ref,event_id,region,token,type,claimed,provider_id,filing_date,note\nQUOTED,SAMPLE,XI,PT-12345,Inpatient,10000,1,2026-08-01,"Line one\nLine two"';assert.equal((await post(app,h,'/api/claims/import',{csv})).json().accepted.length,1);assert.equal((await post(app,h,'/api/claims/import',{csv:'"unclosed'})).statusCode,400);
});
test('request amendments and provider creation preserve evidence and reject other creators',async t=>{
 const app=await buildApp({database:':memory:',serveFrontend:false});t.after(()=>app.close());const ros=await login(app,'ros_xi'),cfb=await login(app);
 const provider=await post(app,ros,'/api/providers',{name:'Illustrative New XI',region:'XI'});assert.equal(provider.statusCode,200);assert.equal((await post(app,ros,'/api/providers',{name:'Forbidden VII',region:'VII'})).statusCode,403);
 const r=await post(app,ros,'/api/requests',{eventId:'SAMPLE',providerId:provider.json().id,route:'A',amount:100,note:'Illustrative'});const url=`/api/requests/${r.json().id}/amendments`;assert.equal((await post(app,cfb,url,{route:'B',amount:200,note:'Changed'})).statusCode,403);assert.equal((await post(app,ros,url,{route:'B',amount:200,note:'Changed'})).statusCode,200);assert.throws(()=>app.db.prepare('DELETE FROM request_amendments').run(),/immutable/);assert.equal((await app.inject({url:'/api/requests?eventId=SAMPLE',headers:cfb})).json()[0].amendments.length,1);
});
test('local icon sprite and logo favicons are served with correct types',async t=>{
 const app=await buildApp({database:':memory:'});t.after(()=>app.close());for(const [asset,type]of [['icons.svg','image/svg+xml'],['favicon.svg','image/svg+xml'],['favicon.ico','image/x-icon'],['apple-touch-icon.png','image/png']]){const r=await app.inject('/assets/'+asset);assert.equal(r.statusCode,200);assert.match(r.headers['content-type'],new RegExp(type.replace('+','\\+')));assert.ok(r.rawPayload.length>100);}
});
