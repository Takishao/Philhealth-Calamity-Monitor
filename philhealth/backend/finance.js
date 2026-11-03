// All stored amounts are integer centavos. Every report uses this same projection.
export const committedStatuses = ['Approved','Paid','Reconciled'];
export function financials(B,A,P) {
 const ratio = n => B > 0 ? n / B * 100 : 0;
 return {ceiling:B,committed:A,paid:P,remaining:B-A,utilization:ratio(A),paidUtilization:ratio(P),unpaid:A-P,variance:A-B,variancePct:ratio(A-B)};
}
export function signal(pct, settings, forecast=0, ceiling=Infinity) {
 if (pct >= Number(settings.critical_pct) || forecast > ceiling) return {level:'critical',icon:'octagon-alert',label: forecast > ceiling || pct>=100 ? 'Over ceiling' : 'Critical'};
 if (pct >= Number(settings.danger_pct)) return {level:'danger',icon:'circle-alert',label:'Danger'};
 if (pct >= Number(settings.warning_pct)) return {level:'warning',icon:'triangle-alert',label:'Warning'};
 return {level:'normal',icon:'circle-check',label:'Normal'};
}
export function zScore(value, values) { const mean=values.reduce((a,b)=>a+b,0)/(values.length||1); const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length||1)); return sd ? (value-mean)/sd : 0; }
export function ageDays(date,asOf) { return Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(date))/86400000)); }
export function movingAverage(values,window=3) { const recent=values.slice(-window); return recent.reduce((a,b)=>a+b,0)/(recent.length||1); }
export async function snapshot(db,eventId,user) {
 const event=(await db.prepare('SELECT e.*,d.starts_on,d.ends_on,d.circular_reference FROM calamity_events e LEFT JOIN event_details d ON e.id=d.event_id WHERE e.id=?').get(eventId));
 if (!event) return null;
 const settings=Object.fromEntries((await db.prepare('SELECT key,value FROM settings').all()).map(x=>[x.key,x.value]));
 const regional=['ROS','RVP'].includes(user?.role);
 const claims=(await db.prepare('SELECT * FROM claims WHERE event_id=?').all(eventId)).filter(c=>!regional||c.region===user.region);
 const refs=new Set(claims.map(c=>c.ref));
 const payments=(await db.prepare('SELECT * FROM payments').all()).filter(x=>refs.has(x.claim_ref));
 const A=claims.filter(c=>committedStatuses.includes(c.status)).reduce((s,c)=>s+c.approved_amount,0), P=payments.reduce((s,x)=>s+x.amount,0);
 const regionRows=(await db.prepare('SELECT * FROM region_budgets WHERE event_id=? ORDER BY region').all(eventId)).filter(r=>!regional||r.region===user.region).map(r=>{
 const local=claims.filter(c=>c.region===r.region), approved=local.filter(c=>committedStatuses.includes(c.status)).reduce((s,c)=>s+c.approved_amount,0), paid=payments.filter(x=>local.some(c=>c.ref===x.claim_ref)).reduce((s,x)=>s+x.amount,0);
 return {...r,approved,paid,signal:signal(r.allocation?approved/r.allocation*100:approved?100:0,settings)};
 });
 const ceiling=regional?regionRows.reduce((s,r)=>s+r.allocation,0):event.budget;
 const totals=financials(ceiling,A,P);
 const asOf=settings.as_of_date;
 const weeks=Array.from({length:8},(_,i)=>{ const end=new Date(asOf+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-(7-i)*7); const start=new Date(end);start.setUTCDate(start.getUTCDate()-6);return {week:end.toISOString().slice(0,10),amount:claims.filter(c=>committedStatuses.includes(c.status)&& (c.decision_date||c.created_at.slice(0,10))>=start.toISOString().slice(0,10)&&(c.decision_date||c.created_at.slice(0,10))<=end.toISOString().slice(0,10)).reduce((s,c)=>s+c.approved_amount,0)}; });
 const weekly=movingAverage(weeks.map(w=>w.amount)); const projected=A+weekly*4;
 const breach=A>ceiling ? asOf : weekly>0 ? new Date(Date.parse(asOf+'T00:00:00Z')+Math.max(0,Math.ceil((ceiling-A)/weekly*7))*86400000).toISOString().slice(0,10) : null;
 const state=signal(totals.utilization,settings,projected,ceiling);
 const alerts=[];
 if(state.level!=='normal') alerts.push({...state,message:`${state.label}: utilization ${totals.utilization.toFixed(1)}%. Four-week projected commitment ₱${(projected/100).toLocaleString('en-PH',{minimumFractionDigits:2})}.`});
 for(const r of regionRows) if(r.approved>r.allocation) alerts.push({level:'critical',icon:'octagon-alert',label:'Over allocation',message:`Region ${r.region} exceeds its allocation.`});
 const rank={critical:0,danger:1,warning:2,normal:3};alerts.sort((a,b)=>rank[a.level]-rank[b.level]);
 const exceptions=(await db.prepare('SELECT * FROM exceptions').all()).filter(x=>refs.has(x.claim_ref));
 const queue=[...exceptions.map(x=>({...x,claim:x.claim_ref})),...claims.filter(c=>['Denied','Returned (RTH)'].includes(c.status)).map(c=>({claim:c.ref,type:c.status,reason:c.note,resolved_at:null}))];
 return {event,settings,totals,signal:state,regions:regionRows,claims,payments,exceptions:queue,alerts,forecast:{weeks,weekly,projected,breachDate:projected>ceiling?breach:null,horizonWeeks:4,method:'3-week moving average of weekly approved commitments; 4-week horizon. Missing weeks count as zero.'},aging:claims.map(c=>({ref:c.ref,status:c.status,days:ageDays(c.filing_date||c.created_at.slice(0,10),asOf),amount:c.claimed_amount,z:zScore(c.claimed_amount,claims.map(x=>x.claimed_amount))}))};
}
export async function claimError(db,data) {
 if(db.driver==='postgres'&&!data.dischargeDate)return {field:'dischargeDate',error:'Discharge date is required for Aiven claims.'};
 if([data.filingDate,data.dischargeDate].filter(Boolean).some(d=>!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))return {field:'filingDate',error:'Enter a real calendar date.'};
 const e=(await db.prepare('SELECT e.status,d.starts_on,d.ends_on FROM calamity_events e LEFT JOIN event_details d ON e.id=d.event_id WHERE e.id=?').get(data.eventId));
 if(!e||e.status!=='Active')return {field:'eventId',error:'Select an active event.'};
 if(!(await db.prepare('SELECT 1 FROM region_budgets WHERE event_id=? AND region=?').get(data.eventId,data.region)))return {field:'region',error:'Region has no event allocation.'};
 if(!data.providerId||!(await db.prepare('SELECT 1 FROM providers WHERE id=? AND region=?').get(data.providerId,data.region)))return {field:'providerId',error:'Select a provider in the claim region.'};
 if(!data.filingDate||!e.starts_on||!e.ends_on||data.filingDate<e.starts_on||data.filingDate>e.ends_on)return {field:'filingDate',error:'Filing date must be inside the event period.'};
 if((await db.prepare(`SELECT 1 FROM claims WHERE ref=? OR (event_id=? AND provider_id=? AND patient_token=? AND COALESCE(discharge_date,'')=? AND claimed_amount=?)`).get(data.ref,data.eventId,data.providerId,data.token,data.dischargeDate||'',data.claimed)))return {field:'ref',error:'Duplicate reference or provider/token/date/amount combination.'};
 return null;
}
