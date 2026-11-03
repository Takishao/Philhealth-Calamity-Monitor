import {readFileSync,statSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {postgresClient} from './postgres.js';
const apply=process.argv.includes('--apply');
if(apply){
 const index=process.argv.indexOf('--backup');
 const path=index<0?null:process.argv[index+1];
 if(!path||statSync(path).size<100||readFileSync(path).subarray(0,5).toString()!=='PGDMP')throw new Error('Provide a verified custom-format backup with --backup before applying.');
 const manifest=JSON.parse(readFileSync(path+'.json','utf8'));
 if(!manifest.archiveDecoded||manifest.sha256!==createHash('sha256').update(readFileSync(path)).digest('hex'))throw new Error('Verified backup manifest checksum mismatch. Create a new backup before applying.');
}
const client=postgresClient();await client.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(729104300)');
 const security=await client.query("SELECT to_regclass('public.app_sessions') AS sessions,to_regclass('public.app_login_attempts') AS attempts");
 if(!security.rows[0].sessions||!security.rows[0].attempts)throw new Error('Review the security migration first. Required security tables are missing.');
 await client.query('CREATE TABLE IF NOT EXISTS app_schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 const folder=new URL('./postgres-migrations/',import.meta.url);
 for(const name of readdirSync(folder).filter(n=>/^\d{3}.*\.sql$/.test(n)&&n!=='001_security_sessions.sql').sort()){
  const sql=readFileSync(new URL(name,folder),'utf8');
  const checksum=createHash('sha256').update(sql).digest('hex');
  const existing=await client.query('SELECT checksum FROM app_schema_migrations WHERE name=$1',[name]);
  if(existing.rowCount){
   if(existing.rows[0].checksum!==checksum)throw new Error('An applied migration differs from its recorded checksum. Add a new migration instead.');
   console.log(name+' already applied.');
  }else{
   await client.query(sql);
   await client.query('INSERT INTO app_schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
   console.log(name+(apply?' applied.':' validated, rolling back.'));
  }
 }
 await client.query(apply?'COMMIT':'ROLLBACK');
} catch(error){await client.query('ROLLBACK');console.error('Migration failed:',error.message);process.exitCode=1;}
finally{await client.end();}
