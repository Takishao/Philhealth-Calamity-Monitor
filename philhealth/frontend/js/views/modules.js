import { api } from '../api.js';
import { scoped,eventId } from '../context.js';
import { el,money,table,toast,field } from '../ui.js';
const input=f=>f.querySelector('input,select,textarea');
function form(title,fields,submit){const button=el('button',{type:'submit',class:'primary'},title);const error=el('p',{role:'alert'});const node=el('form',{class:'card form-grid'},el('h2',{},title),...fields,button,error);node.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;try{await submit();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}});return node;}
export async function moduleView(route,user,reload){
 const section=el('section',{},el('h1',{},({events:'Events & budgets',requests:'Provider requests',analytics:'Forecast & optimization',exceptions:'Exception Center',audit:'Audit trail',reports:'Reports'})[route]||route));
 if(route==='reports'){
 const names=['Budget versus Actual Variance','Claims Status Summary','Claims Aging','Exceptions Register','Payment Reconciliation','Regional Summary'];
 const d=await scoped('/reports');section.append(el('p',{class:'intro'},`Shared dashboard totals · Committed ${money(d.totals.committed)} · Paid ${money(d.totals.paid)} · Variance ${money(d.totals.variance)}`));
 section.append(table(['Report','PDF','Excel','CSV'],names.map((n,i)=>[n,...['pdf','xlsx','csv'].map(f=>el('a',{href:`/api/reports.${f}?type=${i}&eventId=${encodeURIComponent(eventId)}`},f.toUpperCase()))])));return section;
 }
 if(route==='audit'){
 const d=await api('/audit?pageSize=100');section.append(el('p',{class:'notice'},d.chainOk?'✓ Hash chain verified':'⛔ Hash chain requires investigation'),el('a',{href:'/api/audit/evidence'},'Export complete audit evidence (JSON)'),table(['When','Actor','Action','Record','Reason'],d.rows.map(r=>[r.when,r.user,r.action,r.record,r.reason])),el('p',{},`Showing latest ${d.rows.length} of ${d.total}; evidence export contains all records.`));return section;
 }
 if(route==='exceptions'){
 const d=await scoped('/exceptions');section.append(el('p',{class:'intro'},'Late, returned, denied, duplicate, unusual and unmatched claims in one queue. Budget alerts link here for investigation.'));
 section.append(table(['Claim','Type','Reason','Resolution'],d.map(r=>[r.claim,r.type,r.reason,r.resolved_at?'✓ Resolved':r.id&&['CFB','ROS'].includes(user.role)?el('button',{onclick:()=>{const reason=field('Resolution reason');const dialog=el('dialog',{},form('Resolve exception',[reason],async()=>{await api(`/exceptions/${r.id}/resolve`,{method:'POST',body:JSON.stringify({note:input(reason).value})});dialog.close();reload();}),el('button',{onclick:()=>dialog.close()},'Cancel'));document.body.append(dialog);dialog.showModal();}},'Resolve'):'● Open'])));return section;
 }
 if(route==='analytics'){
 const pct=field('Scenario spending change %','number','0');input(pct).min='-100';input(pct).max='100';const out=el('div');async function draw(){const d=await scoped('/analytics?scenarioPct='+input(pct).value);out.replaceChildren(el('article',{class:'card'},el('p',{},d.method),el('p',{},`Weekly average ${money(d.weekly)} · Four-week forecast ${money(d.projected)} · Scenario ${money(d.scenarioTotal)}`),el('p',{},d.breachDate?'Projected breach '+d.breachDate:'No projected breach'),el('p',{},d.allocationMethod)),table(['Region','Suggested allocation'],d.allocation.map(r=>[r.region,money(r.suggestion)])));}section.append(form('Compare scenario',[pct],draw),out);await draw();return section;
 }
 if(route==='events'){
 const events=await api('/events');section.append(table(['Event','Name','Ceiling','Period','Circular'],events.map(e=>[e.id,e.name,money(e.budget),`${e.starts_on||'?'} → ${e.ends_on||'?'}`,e.circular_reference||'Missing'])));
 if(user.role==='CFB'){
 const id=field('Event ID'),name=field('Event name'),budget=field('Ceiling in centavos','number'),start=field('Starts on','date'),end=field('Ends on','date'),circular=field('Circular reference'),alloc=el('label',{},'Regional allocations (JSON)',el('textarea',{required:'',rows:4},'[{"region":"XI","amount":0}]'));
 section.append(form('Register event',[id,name,budget,start,end,circular,alloc],async()=>{await api('/events',{method:'POST',body:JSON.stringify({id:input(id).value,name:input(name).value,budget:Number(input(budget).value),startsOn:input(start).value,endsOn:input(end).value,circularReference:input(circular).value,allocations:JSON.parse(input(alloc).value)})});toast('Event registered.');reload();}));
 const region=field('Region'),amount=field('Revised allocation in centavos','number');section.append(form('Propose allocation revision',[region,amount],async()=>{await api(`/events/${encodeURIComponent(eventId)}/revisions`,{method:'POST',body:JSON.stringify({region:input(region).value,allocation:Number(input(amount).value)})});toast('Revision proposed.');reload();}));
 }
 if(user.role==='EXE'){const revision=field('Revision number','number');section.append(form('Approve revision',[revision],async()=>{await api(`/events/${encodeURIComponent(eventId)}/revisions/${input(revision).value}/approve`,{method:'POST'});toast('Revision approved.');reload();}));section.append(el('button',{onclick:async()=>{if(confirm('Close this event? Claims can no longer be added.')){try{await api(`/events/${encodeURIComponent(eventId)}/close`,{method:'POST'});reload();}catch(e){toast(e.message);}}}},'Close selected event'));}return section;
 }
 if(route==='requests'){
 const requests=await scoped('/requests');section.append(el('p',{class:'notice'},'Route A/B records are illustrative. Official route criteria and approval chains were not supplied. Later decisions append history.'));
 section.append(table(['Request','Provider','Route','Amount','History','Action'],requests.map(r=>[r.id,r.name,'Route '+r.route,money(r.amount),r.history.map(h=>`${h.decision} · ${h.username} · ${h.decided_at} · ${h.note}`).join('\n')||'Awaiting decision',['CFB','EXE','RVP'].includes(user.role)?el('button',{onclick:()=>{const decision=el('label',{},'Decision',el('select',{},['Approved','Returned','Denied'].map(x=>el('option',{value:x},x)))),note=field('Reason');const dialog=el('dialog',{},form('Record decision',[decision,note],async()=>{await api(`/requests/${r.id}/decisions`,{method:'POST',body:JSON.stringify({decision:input(decision).value,note:input(note).value})});dialog.close();reload();}),el('button',{onclick:()=>dialog.close()},'Cancel'));document.body.append(dialog);dialog.showModal();}},'Record decision'):'Read only'])));
 if(['CFB','ROS'].includes(user.role)){const providers=await api('/providers');const provider=el('label',{},'Provider',el('select',{},providers.map(p=>el('option',{value:p.id},p.name)))),route=el('label',{},'Route',el('select',{},['A','B'].map(x=>el('option',{value:x},'Route '+x)))),amount=field('Requested centavos','number'),note=field('Request note');section.append(form('Register request',[provider,route,amount,note],async()=>{await api('/requests',{method:'POST',body:JSON.stringify({eventId,providerId:Number(input(provider).value),route:input(route).value,amount:Number(input(amount).value),note:input(note).value})});reload();}));}return section;
 }
 return section;
}
