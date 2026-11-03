import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {postgresClient} from './postgres.js';
import {buildApp} from './server.js';

const file=process.argv[2];
if(!file)throw new Error('Provide the custom archive path to restore into a new temporary database.');
const bytes=readFileSync(file);
const manifest=JSON.parse(readFileSync(file+'.json','utf8'));
assert.equal(bytes.subarray(0,5).toString(),'PGDMP');
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256,'Backup checksum mismatch');
const originalUrl=process.env.DATABASE_URL;
const url=new URL(originalUrl);
const name='phcm_restore_'+Date.now().toString(36)+'_'+randomBytes(4).toString('hex');
const admin=postgresClient();await admin.connect();
let created=false,app;
const proof={archive:resolve(file),sha256:manifest.sha256,verifiedAt:new Date().toISOString(),isolatedRestorePassed:false,temporaryDatabaseRemoved:false};
try{
 await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);created=true;
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:name,PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve(process.env.AIVEN_CA_CERT_PATH)};
 // Cleaning is restricted to the new empty database created above.
 const restored=spawnSync('pg_restore',['--clean','--if-exists','--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname',name,file],{env,encoding:'utf8',maxBuffer:16*1024*1024});
 if(restored.error)throw new Error('pg_restore is required on PATH.');
 if(restored.status!==0){writeFileSync(file+'.restore-errors.log',restored.stderr,{mode:0o600});throw new Error('Restore failed. Details are in the private archive restore-errors log.');}
 url.pathname='/'+name;process.env.DATABASE_URL=url.toString();process.env.DB_DRIVER='postgres';
 app=await buildApp({serveFrontend:false});
 const pre=await app.inject('/api/csrf');assert.equal(pre.statusCode,200);
 const login=await app.inject({method:'POST',url:'/api/login',headers:{cookie:pre.headers['set-cookie'].split(';')[0],'x-csrf-token':pre.json().csrfToken},payload:{username:'demo_cfb',password:'demo1234'}});assert.equal(login.statusCode,200);
 const headers={cookie:login.headers['set-cookie'].split(';')[0]};
 const dashboard=await app.inject({url:'/api/dashboard?eventId=PHCM-DEMO',headers});assert.equal(dashboard.statusCode,200);
 assert.equal(dashboard.json().totals.ceiling,5000000000);assert.equal(dashboard.json().totals.committed,4000000000);assert.equal(dashboard.json().totals.paid,3200000000);
 const audit=await app.inject({url:'/api/audit',headers});assert.equal(audit.statusCode,200);assert.equal(audit.json().chainOk,true);
 proof.isolatedRestorePassed=true;
 console.log('Isolated restore, demo login, dashboard totals and audit chain passed.');
}finally{
 try{if(app)await app.close();}finally{
  process.env.DATABASE_URL=originalUrl;
  try{if(created){await admin.query(`DROP DATABASE "${name}"`);proof.temporaryDatabaseRemoved=true;console.log('Removed only the temporary restore database.');}}
  finally{await admin.end();writeFileSync(file+'.restore-proof.json',JSON.stringify(proof,null,2)+'\n',{mode:0o600});}
 }
}
