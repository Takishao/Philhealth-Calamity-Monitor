import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { snapshot } from './finance.js';
export const reportNames=['Budget versus Actual Variance','Claims Status Summary','Claims Aging','Exceptions Register','Payment Reconciliation','Regional Summary'];
export function reportRows(data,type) {
 const t=data.totals;
 if(type===0)return [['Metric','Centavos or percent'],...Object.entries(t)];
 if(type===1)return [['Status','Count','Approved centavos'],...Object.entries(Object.groupBy(data.claims,c=>c.status)).map(([k,v])=>[k,v.length,v.reduce((s,c)=>s+c.approved_amount,0)])];
 if(type===2)return [['Claim','Status','Age days','Claimed centavos','Z score'],...data.aging.map(x=>[x.ref,x.status,x.days,x.amount,x.z])];
 if(type===3)return [['Claim','Type','Reason','Resolved'],...data.exceptions.map(x=>[x.claim,x.type,x.reason,!!x.resolved_at])];
 if(type===4)return [['Claim','Approved centavos','Paid centavos','Unpaid centavos','Match'],...data.claims.filter(c=>['Approved','Paid','Reconciled'].includes(c.status)).map(c=>{const paid=data.payments.filter(p=>p.claim_ref===c.ref).reduce((s,p)=>s+p.amount,0);return [c.ref,c.approved_amount,paid,c.approved_amount-paid,paid===c.approved_amount?'Matched':'Unmatched'];})];
 return [['Region','Allocation centavos','Committed centavos','Paid centavos'],...data.regions.map(r=>[r.region,r.allocation,r.approved,r.paid])];
}
const safe=v=>{const s=String(v??'');return /^[=+@\t\r-]/.test(s)&&typeof v!=='number'?"'"+s:s;};
export function registerReportRoutes(app,db){
 for(const format of ['csv','xlsx','pdf']) app.get('/api/reports.'+format,async(req,reply)=>{
 if(!req.user)return reply.code(401).send({error:'Authentication required.'});
 if(req.user.role==='ADM')return reply.code(403).send({error:'Permission denied.'});
 const data=snapshot(db,req.query.eventId||db.prepare('SELECT id FROM calamity_events ORDER BY id LIMIT 1').get()?.id,req.user);
 if(!data)return reply.code(404).send({error:'Event not found.'});
 const type=Number(req.query.type||0);if(!Number.isInteger(type)||type<0||type>5)return reply.code(400).send({error:'Choose one of six reports.'});
 const rows=[['ILLUSTRATIVE DATA',data.event.id,reportNames[type]],...reportRows(data,type),[],['Shared dashboard totals (centavos)'],...Object.entries(data.totals)];
 reply.header('Content-Disposition',`attachment; filename="report-${type}.${format}"`);
 if(format==='csv'){reply.type('text/csv; charset=utf-8');return rows.map(r=>r.map(v=>'"'+safe(v).replaceAll('"','""')+'"').join(',')).join('\r\n');}
 if(format==='xlsx'){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Illustrative report');rows.forEach(r=>sheet.addRow(r));sheet.columns.forEach(c=>c.width=28);reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return Buffer.from(await book.xlsx.writeBuffer());}
 const doc=new PDFDocument({margin:36,size:'A4',layout:'landscape'});const chunks=[];doc.on('data',c=>chunks.push(c));const result=new Promise(resolve=>doc.on('end',()=>resolve(Buffer.concat(chunks))));doc.fontSize(10);for(const row of rows)doc.text(row.map(v=>safe(v)).join('  |  '));doc.end();reply.type('application/pdf');return result;
 });
}
