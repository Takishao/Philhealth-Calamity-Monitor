// shortcut: one serialized connection per local app, use a transaction-aware
// connection pool before scaling this illustrative server beyond local testing.
export function configureTransactions(db) {
 let queue=Promise.resolve();
 let release;
 let active=false;
 db.beginRequest=async()=>{
  const previous=queue;
  let unlock;
  queue=new Promise(resolve=>{unlock=resolve;});
  await previous;
  release=unlock;
  try {await db.begin();active=true;}catch(error){release();throw error;}
 };
 db.endRequest=async failed=>{
  try {if(active)await (failed?db.rollback():db.commit());}
  catch(error){await db.rollback();throw error;}
  finally {active=false;release?.();release=undefined;}
 };
 db.withTransaction=callback=>async(...args)=>{
  if(active)return callback(...args);
  await db.beginRequest();
  try {const result=await callback(...args);await db.endRequest(false);return result;}
  catch(error){await db.endRequest(true);throw error;}
 };
 return db;
}
