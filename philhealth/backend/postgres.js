import pg from 'pg';
import { readFileSync } from 'node:fs';

const tables = {
 users:'app_runtime_users', providers:'app_runtime_providers', calamity_events:'app_runtime_events',
 region_budgets:'app_runtime_region_budgets', event_details:'app_runtime_event_details',
 claims:'app_runtime_claims', claim_history:'app_runtime_claim_history', payments:'app_runtime_payments',
 sessions:'app_sessions', login_attempts:'app_runtime_login_attempts', settings:'app_text_settings',
 settings_changes:'app_settings_changes', event_budgets:'app_event_budgets', permissions:'app_permissions',
 provider_requests:'app_provider_requests', request_decisions:'app_request_decisions',
 request_amendments:'app_request_amendments', audit_log:'app_audit_log', legacy_audit_log:'app_legacy_audit_log', exceptions:'app_exceptions'
};

export function postgresClient(databaseUrl = process.env.DATABASE_URL) {
 if (!databaseUrl || !process.env.AIVEN_CA_CERT_PATH) throw new Error('DATABASE_URL and AIVEN_CA_CERT_PATH are required for verified TLS.');
 const url = new URL(databaseUrl);
 for (const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
 const client = new pg.Client({keepAlive:true,keepAliveInitialDelayMillis:10000,connectionTimeoutMillis:10000,connectionString:url.toString(),ssl:{ca:readFileSync(process.env.AIVEN_CA_CERT_PATH,'utf8'),rejectUnauthorized:true},
  types:{getTypeParser(oid,format){
   if ([20,1700].includes(oid)) return value => {const n=Number(value);if(!Number.isSafeInteger(n))throw new Error('Database amount or ID is not a safe integer.');return n;};
   if (oid===1082) return value=>value;
   if ([1114,1184].includes(oid)) return value=>new Date(oid===1114?value+'Z':value).toISOString();
   return pg.types.getTypeParser(oid,format);
  }}});
 // pg emits idle connection failures outside query promises.
 client.on('error',()=>{});
 return client;
}

// Queries are application-owned SQL, never user input. Tokenize strings so a
// table name or question mark inside a quoted value is never rewritten.
export function postgresSql(sql) {
 let index=0;
 return sql.replace(/datetime\('now', '-15 minutes'\)/g,"(CURRENT_TIMESTAMP - INTERVAL '15 minutes')")
  .replace(/date\('now'\)/g,'CURRENT_DATE::text')
  .replace(/AS updatedAt/g,'AS "updatedAt"')
  .replace(/'(?:''|[^'])*'|\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]+)\b|\?/gi,(token,table)=>{
   if (table) {if(table.toLowerCase()==='set')return token;const mapped=tables[table.toLowerCase()];if(!mapped)throw new Error('Unmapped database table.');return token.slice(0,-table.length)+mapped;}
   return token==='?'?'$'+(++index):token;
  });
}

export async function createPostgresDatabase(clientFactory = postgresClient) {
 let client;
 let disconnected=true;
 const unavailable=()=>Object.assign(new Error('Database connection interrupted. Check the previous action before resubmitting it.'),{statusCode:503});
 async function connect(){
  const next=clientFactory();
  next.on('error',()=>{if(client===next)disconnected=true;});
  next.on('end',()=>{if(client===next)disconnected=true;});
  client=next;
  try{await next.connect();disconnected=false;}
  catch{disconnected=true;await next.end().catch(()=>{});throw unavailable();}
 }
 await connect();
 try {
  const check=await client.query("SELECT to_regclass('public.app_runtime_claims') AS bridge");
  const ambiguous=await client.query('SELECT 1 FROM claims GROUP BY claim_ref HAVING count(*)>1 LIMIT 1');
  if(ambiguous.rowCount)throw new Error('Aiven contains ambiguous claim references across events. Resolve the API mapping before starting.');
  if(!check.rows[0].bridge)throw new Error('Apply the reviewed PostgreSQL bridge migration before starting.');
 } catch(error) {await client.end();throw error;}
 let pending=Promise.resolve();
 const query=(...args)=>{
  const result=pending.then(()=>{if(disconnected)throw unavailable();return client.query(...args).catch(error=>{if(disconnected||['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','57P01','57P02','57P03'].includes(error.code)||/connection.*(terminated|closed)/i.test(error.message)){disconnected=true;throw unavailable();}throw error;});});
  pending=result.catch(()=>{});
  return result;
 };
 const db={
  driver:'postgres',
  prepare(sql){
   const statement=postgresSql(sql);
   return {
    async get(...params){return (await query(statement,params)).rows[0];},
    async all(...params){return (await query(statement,params)).rows;},
    async run(...params){
     const result=await query(statement+(/^\s*(INSERT|UPDATE|DELETE)\b/i.test(statement)?' RETURNING *':''),params);
     return {changes:result.rowCount,lastInsertRowid:result.rows[0]?.id};
    }
   };
  },
  async setActor(id){await query("SELECT set_config('app.actor_id',$1,true)",[String(id||'')]);},
  async begin(){if(disconnected){await client.end().catch(()=>{});await connect();}await query('BEGIN');await query('SELECT pg_advisory_xact_lock(729104300)');},
  async commit(){await query('COMMIT');},
  async rollback(){if(!disconnected)await query('ROLLBACK');},
  async close(){await client.end();}
 };
 return db;
}
