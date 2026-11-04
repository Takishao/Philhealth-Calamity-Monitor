import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createPostgresDatabase} from '../postgres.js';

function clients(){
 const created=[];
 const factory=()=>{
  const client=new EventEmitter();client.calls=[];
  client.connect=async()=>{};client.end=async()=>client.emit('end');
  client.query=async(sql)=>{client.calls.push(sql);if(client.fail){client.emit('error',Object.assign(new Error('reset'),{code:'ECONNRESET'}));throw Object.assign(new Error('reset'),{code:'ECONNRESET'});}return {rows:sql.includes('to_regclass')?[{bridge:true}]:[],rowCount:0};};
  created.push(client);return client;
 };
 return {created,factory};
}
test('idle PostgreSQL reset is handled and reconnects only before the next transaction',async()=>{
 const {created,factory}=clients();const db=await createPostgresDatabase(factory);
 assert.doesNotThrow(()=>created[0].emit('error',new Error('ECONNRESET')));
 await assert.rejects(db.prepare('SELECT * FROM claims').all(),{statusCode:503});
 assert.equal(created.length,1);await db.begin();assert.equal(created.length,2);await db.commit();await db.close();
});
test('an interrupted write or commit is never replayed',async()=>{
 for(const commit of [false,true]){
  const {created,factory}=clients();const db=await createPostgresDatabase(factory);await db.begin();created[0].fail=true;
  await assert.rejects(commit?db.commit():db.prepare('UPDATE claims SET status=? WHERE ref=?').run('Paid','TEST'),{statusCode:503});
  await db.rollback();assert.equal(created.length,1);const failed=created[0].calls.at(-1);await db.begin();assert.equal(created.length,2);assert.ok(!created[1].calls.includes(failed));await db.rollback();await db.close();
 }
});
