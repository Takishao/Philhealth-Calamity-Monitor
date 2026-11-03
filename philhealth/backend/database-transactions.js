import {AsyncLocalStorage} from 'node:async_hooks';

// shortcut: one serialized connection per local app, use a transaction-aware
// connection pool before scaling this illustrative server beyond local testing.
export function configureTransactions(db) {
 const context=new AsyncLocalStorage();
 let queue=Promise.resolve();
 let owner;
 let release;
 db.inRequestContext=callback=>context.run({},callback);
 db.beginRequest=async()=>{
  const token=context.getStore();
  if(!token)throw new Error('Database requests need a transaction context.');
  const previous=queue;
  let unlock;
  queue=new Promise(resolve=>{unlock=resolve;});
  await previous;
  try {await db.begin();owner=token;release=unlock;}
  catch(error){try{await db.rollback();}finally{unlock();}throw error;}
 };
 db.endRequest=async failed=>{
  if(!owner||owner!==context.getStore())return;
  try {await (failed?db.rollback():db.commit());}
  catch(error){await db.rollback();throw error;}
  finally {owner=undefined;const unlock=release;release=undefined;unlock();}
 };
 db.withTransaction=callback=>async(...args)=>{
  if(owner&&owner===context.getStore())return callback(...args);
  return context.run({},async()=>{
   await db.beginRequest();
   try {const result=await callback(...args);await db.endRequest(false);return result;}
   catch(error){await db.endRequest(true);throw error;}
  });
 };
 return db;
}
