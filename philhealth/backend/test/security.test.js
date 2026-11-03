import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildApp} from '../server.js';
import {configureTransactions} from '../database-transactions.js';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {PassThrough} from 'node:stream';
import ExcelJS from 'exceljs';
import {postgresClient} from '../postgres.js';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const excelRequire=createRequire(require.resolve('exceljs'));
const archiveRequire=createRequire(excelRequire.resolve('archiver'));
const archiveUtilsRequire=createRequire(archiveRequire.resolve('archiver-utils'));

test('patched archive dependencies preserve recursive matching and ZIP contents',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'phcm-archive-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
 mkdirSync(join(folder,'nested'));writeFileSync(join(folder,'one.txt'),'one');writeFileSync(join(folder,'nested','two.txt'),'two');writeFileSync(join(folder,'ignore.csv'),'ignore');
 const glob=archiveUtilsRequire('glob');assert.deepEqual(glob.sync('**/*.txt',{cwd:folder}).sort(),['nested/two.txt','one.txt']);
 const archive=excelRequire('archiver')('zip');const chunks=[];archive.on('data',chunk=>chunks.push(chunk));
 const complete=once(archive,'end');archive.glob('**/*.txt',{cwd:folder});await archive.finalize();await complete;
 const zip=await excelRequire('jszip').loadAsync(Buffer.concat(chunks));assert.deepEqual(Object.keys(zip.files).filter(name=>!zip.files[name].dir).sort(),['nested/two.txt','one.txt']);assert.equal(await zip.file('nested/two.txt').async('string'),'two');
});

test('ExcelJS streaming writer remains compatible with the archive override',async()=>{
 const stream=new PassThrough();const chunks=[];stream.on('data',chunk=>chunks.push(chunk));const ended=once(stream,'end');
 const writer=new ExcelJS.stream.xlsx.WorkbookWriter({stream});const sheet=writer.addWorksheet('Test');sheet.addRow(['Illustrative',12345]).commit();await writer.commit();await ended;
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.concat(chunks));assert.equal(book.worksheets[0].getCell('A1').value,'Illustrative');assert.equal(book.worksheets[0].getCell('B1').value,12345);
});

test('static files cannot escape through sibling paths or symbolic links',async t=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const sibling=mkdtempSync(join(root,'frontend-private-'));const assets=mkdtempSync(join(root,'frontend','security-test-'));
 t.after(()=>{rmSync(assets,{recursive:true,force:true});rmSync(sibling,{recursive:true,force:true});});
 writeFileSync(join(sibling,'secret.txt'),'private-marker');symlinkSync(join(sibling,'secret.txt'),join(assets,'link.txt'));
 const app=await buildApp({database:':memory:'});t.after(()=>app.close());
 for(const path of ['/..%2F'+basename(sibling)+'/secret.txt','/'+basename(assets)+'/link.txt','/js']){
  const r=await app.inject(path);assert.ok([400,404].includes(r.statusCode),path+': '+r.statusCode);assert.doesNotMatch(r.body,/private-marker/);
 }
 assert.equal((await app.inject('/assets/icons.svg')).statusCode,200);
});

test('independent transactions queue and cannot join another caller rollback',async()=>{
 const events=[];const db=configureTransactions({begin:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback')});
 let finishFirst,startedFirst;const started=new Promise(resolve=>startedFirst=resolve);const gate=new Promise(resolve=>finishFirst=resolve);
 const first=db.withTransaction(async()=>{events.push('first');startedFirst();await gate;throw new Error('intentional rollback');})();
 await started;
 const second=db.withTransaction(async()=>{events.push('second');await db.withTransaction(async()=>events.push('nested'))();})();
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['begin','first']);finishFirst();
 await assert.rejects(first,/intentional rollback/);await second;assert.deepEqual(events,['begin','first','rollback','begin','second','nested','commit']);
});

test('a failed transaction begin releases the queue and cannot finalize another request',async()=>{
 let fail=true;const events=[];const db=configureTransactions({begin:async()=>{if(fail){fail=false;throw new Error('begin failed');}events.push('begin');},rollback:async()=>events.push('rollback'),commit:async()=>events.push('commit')});
 let finish;const gate=new Promise(resolve=>finish=resolve);
 await db.inRequestContext(async()=>{await assert.rejects(db.beginRequest(),/begin failed/);const next=db.withTransaction(async()=>{events.push('next');await gate;})();await new Promise(resolve=>setImmediate(resolve));await db.endRequest(false);assert.deepEqual(events,['rollback','begin','next']);finish();await next;});
 assert.equal(events.at(-1),'commit');
});

test('connection-string TLS options cannot disable CA verification',t=>{
 const folder=mkdtempSync(join(tmpdir(),'phcm-tls-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const file=join(folder,'ca.pem');writeFileSync(file,'test-ca');const previous=process.env.AIVEN_CA_CERT_PATH;process.env.AIVEN_CA_CERT_PATH=file;
 try{const client=postgresClient('postgres://test:example@localhost/test?ssl=false&sslmode=disable&sslrootcert=ignored');assert.equal(client.ssl.rejectUnauthorized,true);assert.equal(client.ssl.ca,'test-ca');}
 finally{if(previous===undefined)delete process.env.AIVEN_CA_CERT_PATH;else process.env.AIVEN_CA_CERT_PATH=previous;}
});

test('migration application rejects an archive with a mismatched checksum',t=>{
 const folder=mkdtempSync(join(tmpdir(),'phcm-backup-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));const file=join(folder,'backup.dump');writeFileSync(file,Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(100)]));writeFileSync(file+'.json',JSON.stringify({archiveDecoded:true,sha256:'incorrect'}));
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../migrate-postgres.js',import.meta.url)),'--apply','--backup',file],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/checksum|manifest/i);
});
