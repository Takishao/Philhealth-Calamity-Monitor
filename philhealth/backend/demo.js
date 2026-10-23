export function seedAuditDemo(db) {
 db.prepare("INSERT OR IGNORE INTO providers(id,name,region) VALUES(1,'Illustrative Provider XI','XI'),(2,'Illustrative Provider VII','VII'),(3,'Illustrative Provider IVA','IVA')").run();
 db.prepare("INSERT OR IGNORE INTO event_details(event_id,starts_on,ends_on,circular_reference) SELECT id,'2026-01-01','2026-12-31','Illustrative circular' FROM calamity_events").run();
 const insert=db.prepare("INSERT OR IGNORE INTO calamity_events(id,name,status,budget) VALUES(?,?,'Active',?)");
 for(const [id,name,A,P] of [['SAMPLE','Typhoon Sample',4000000000,3200000000],['DEMO-NORMAL','Normal sample',2500000000,2000000000],['DEMO-DANGER','Danger sample',4600000000,3200000000],['DEMO-CRITICAL','Critical sample',5100000000,3200000000]]) {
 insert.run(id,name+' · illustrative',5000000000);
 db.prepare("INSERT OR IGNORE INTO event_details(event_id,starts_on,ends_on,circular_reference) VALUES(?,'2026-01-01','2026-12-31','Illustrative only')").run(id);
 db.prepare("INSERT OR IGNORE INTO region_budgets(event_id,region,allocation) VALUES(?,'XI',5000000000)").run(id);
 db.prepare("INSERT OR IGNORE INTO claims(ref,event_id,region,patient_token,claim_type,status,claimed_amount,approved_amount,provider_id,filing_date,decision_date,created_at) VALUES(?,?,'XI','PT-9999','Illustrative','Paid',?,?,1,'2026-07-01','2026-07-01','2026-07-01')").run(id+'-PAID',id,P,P);
 db.prepare("INSERT OR IGNORE INTO claims(ref,event_id,region,patient_token,claim_type,status,claimed_amount,approved_amount,provider_id,filing_date,decision_date,created_at) VALUES(?,?,'XI','PT-9998','Illustrative','Approved',?,?,1,'2026-07-01','2026-07-01','2026-07-01')").run(id+'-UNPAID',id,A-P,A-P);
 if(!db.prepare('SELECT 1 FROM payments WHERE claim_ref=?').get(id+'-PAID'))db.prepare("INSERT INTO payments(claim_ref,amount,paid_at,recorded_by,note) VALUES(?,?,'2026-07-02',(SELECT id FROM users WHERE username='act'),'Illustrative matched payment')").run(id+'-PAID',P);
 }
}
