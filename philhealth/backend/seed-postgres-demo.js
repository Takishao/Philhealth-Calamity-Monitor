import argon2 from 'argon2';
import {postgresClient} from './postgres.js';
import {createDatabase} from './db.js';
import {appendAudit} from './auth.js';

if(process.env.DB_DRIVER!=='postgres'||process.env.SEED_DEMO!=='1')throw new Error('Explicit DB_DRIVER=postgres SEED_DEMO=1 is required. This script only adds labeled test records.');
const accounts=[['cfb','CENTRAL_FIN',null],['act','TREASURY',null],['exe','PRESIDENT',null],['aud','AUDITOR',null],['adm','ADMIN',null],['ros_xi','REGIONAL_STAFF','XI'],['ros_vii','REGIONAL_STAFF','VII'],['ros_iva','REGIONAL_STAFF','IVA'],['rvp_vii','REGIONAL_VP','VII']];
const client=postgresClient();await client.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(729104300)');
 for(const [name,role,region] of accounts){
  const existing=await client.query('SELECT password_hash FROM users WHERE username=$1',['demo_'+name]);
  if(existing.rowCount){if(!await argon2.verify(existing.rows[0].password_hash,'demo1234'))throw new Error('A demo username is already in use with different credentials. No existing credentials will be changed.');continue;}
  const hash=await argon2.hash('demo1234',{timeCost:2,memoryCost:4096});
  await client.query("INSERT INTO users(username,full_name,password_hash,role_id,region_id) VALUES($1,$2,$3,(SELECT role_id FROM roles WHERE role_code=$4),(SELECT region_id FROM regions WHERE region_code=$5))",['demo_'+name,'Illustrative test '+name,hash,role,region]);
 }
 await client.query("INSERT INTO providers(provider_code,provider_name,region_id) VALUES('PHCM-DEMO-XI','Illustrative testing provider XI',(SELECT region_id FROM regions WHERE region_code='XI')) ON CONFLICT(provider_code) DO NOTHING");
 await client.query('COMMIT');
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}

const db=await createDatabase();
try{await db.withTransaction(async()=>{
 const actor=await db.prepare('SELECT id FROM users WHERE username=?').get('demo_cfb');
 const accountant=await db.prepare('SELECT id FROM users WHERE username=?').get('demo_act');
 const encoder=await db.prepare('SELECT id FROM users WHERE username=?').get('demo_ros_xi');
 const provider=await db.prepare('SELECT id FROM providers WHERE name=?').get('Illustrative testing provider XI');
 await db.setActor(actor.id);
 for(const [id,name,committed,paid]of [['PHCM-DEMO','Warning',4000000000,3200000000],['PHCM-NORMAL','Normal',2500000000,2000000000],['PHCM-DANGER','Danger',4600000000,3200000000],['PHCM-CRITICAL','Critical',5100000000,3200000000]]){
  if(await db.prepare('SELECT 1 FROM calamity_events WHERE id=?').get(id))continue;
  await db.prepare("INSERT INTO calamity_events(id,name,status,budget) VALUES(?,?,'Active',5000000000)").run(id,name+' testing event - illustrative only');
  await db.prepare("INSERT INTO event_details(event_id,starts_on,ends_on,circular_reference) VALUES(?,'2026-01-01','2026-12-31','Illustrative testing circular')").run(id);
  await db.prepare("INSERT INTO region_budgets(event_id,region,allocation) VALUES(?,'XI',5000000000)").run(id);
  for(const [suffix,status,amount]of [['PAID','Paid',paid],['UNPAID','Approved',committed-paid]]){
   const ref=id+'-'+suffix;
   await db.prepare("INSERT INTO claims(ref,event_id,region,patient_token,claim_type,status,claimed_amount,approved_amount,provider_id,discharge_date,filing_date,decision_date,created_at,encoded_by) VALUES(?,?,'XI',?,'Inpatient',?,?,?,?, '2026-09-01','2026-09-02','2026-09-05','2026-09-02',?)").run(ref,id,'PT-'+suffix,status,amount,amount,provider.id,encoder.id);
   await db.prepare('INSERT INTO claim_history(claim_ref,status,actor_id,note) VALUES(?,?,?,?)').run(ref,status,actor.id,'Illustrative initial testing fixture');
  }
  await db.prepare("INSERT INTO payments(claim_ref,amount,paid_at,recorded_by,note) VALUES(?,?,'2026-09-06',?,'Illustrative testing payment')").run(id+'-PAID',paid,accountant.id);
  await appendAudit(db,actor.id,'DEMO_CREATE','Event',id,'Illustrative testing fixtures created');
 }
})();console.log('Added illustrative demo accounts and four testing events. Existing records were not reset.');}
finally{await db.close();}
