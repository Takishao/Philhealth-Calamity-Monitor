import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,statSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
if(!process.env.DATABASE_URL||!process.env.AIVEN_CA_CERT_PATH)throw new Error('DATABASE_URL and AIVEN_CA_CERT_PATH are required.');
const url=new URL(process.env.DATABASE_URL);
const folder=fileURLToPath(new URL('../../work/backups/',import.meta.url));mkdirSync(folder,{recursive:true,mode:0o700});
const file=join(folder,'aiven-'+new Date().toISOString().replaceAll(':','-')+'.dump');
const password=decodeURIComponent(url.password);
const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:password,PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve(process.env.AIVEN_CA_CERT_PATH)};
function run(command,args){const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:16*1024*1024});if(result.error)throw new Error(command+' is required on PATH.');if(result.status!==0)throw new Error(command+' failed: '+result.stderr.replaceAll(password,'[redacted]').replaceAll(process.env.DATABASE_URL,'[redacted]'));return result.stdout;}
// Write with owner-only permissions from the moment pg_dump opens the archive.
writeFileSync(file,'',{mode:0o600});
run('pg_dump',['--format=custom','--schema=public','--no-owner','--no-acl','--file',file]);chmodSync(file,0o600);
const listing=run('pg_restore',['--list',file]);
run('pg_restore',['--file=/dev/null',file]);
const sha256=createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(file+'.list',listing,{mode:0o600});
writeFileSync(file+'.json',JSON.stringify({file,bytes:statSync(file).size,sha256,archiveDecoded:true,isolatedRestoreTested:false},null,2)+'\n',{mode:0o600});
console.log('Verified public-schema backup: '+file);
