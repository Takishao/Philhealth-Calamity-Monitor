-- Additive bridge. Existing records are readable. Only events registered in
-- app_owned_events may be changed through this application's business views.
CREATE TABLE app_owned_events(event_code text PRIMARY KEY REFERENCES events(event_code));
-- The local API identifies claims globally by reference. Fail migration on
-- ambiguous native references instead of silently choosing an event.
CREATE TABLE app_claim_refs(ref text PRIMARY KEY,claim_id bigint NOT NULL UNIQUE REFERENCES claims(claim_id));
INSERT INTO app_claim_refs SELECT claim_ref,claim_id FROM claims;
CREATE TABLE app_claim_details(
 claim_id bigint PRIMARY KEY REFERENCES claims(claim_id), patient_token text NOT NULL,
 decision_date text, reason_code text, note text NOT NULL DEFAULT ''
);
CREATE TABLE app_text_settings(key text PRIMARY KEY,value text NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_by integer REFERENCES users(user_id));
INSERT INTO app_text_settings(key,value) SELECT setting_key,setting_value::text FROM app_settings;
INSERT INTO app_text_settings(key,value) VALUES ('warning_pct','80'),('danger_pct','90'),('critical_pct','100'),('aging_days','60'),('z_threshold','3'),('filing_deadline_days','60'),('as_of_date','2026-11-03') ON CONFLICT DO NOTHING;
CREATE TABLE app_settings_changes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,setting_key text NOT NULL REFERENCES app_text_settings(key),old_value text NOT NULL,new_value text NOT NULL,reason text NOT NULL,actor_id integer NOT NULL REFERENCES users(user_id),created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE app_event_details(event_id text PRIMARY KEY REFERENCES events(event_code),closed_at text,closed_by integer REFERENCES users(user_id));
CREATE TABLE app_event_budgets(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id text NOT NULL REFERENCES app_owned_events(event_code),region text NOT NULL,allocation bigint NOT NULL CHECK(allocation>=0),revision integer NOT NULL,proposed_by integer REFERENCES users(user_id),approved_by integer REFERENCES users(user_id),status text NOT NULL DEFAULT 'Active',created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(event_id,region,revision));
CREATE TABLE app_provider_requests(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id text NOT NULL REFERENCES events(event_code),provider_id integer NOT NULL REFERENCES providers(provider_id),route text NOT NULL CHECK(route IN ('A','B')),amount bigint NOT NULL CHECK(amount>0),note text NOT NULL,created_by integer NOT NULL REFERENCES users(user_id),created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE app_request_decisions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id bigint NOT NULL REFERENCES app_provider_requests(id),decision text NOT NULL CHECK(decision IN ('Approved','Denied','Returned')),note text NOT NULL,actor_id integer NOT NULL REFERENCES users(user_id),decided_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE app_request_amendments(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id bigint NOT NULL REFERENCES app_provider_requests(id),route text NOT NULL CHECK(route IN ('A','B')),amount bigint NOT NULL CHECK(amount>0),note text NOT NULL,actor_id integer NOT NULL REFERENCES users(user_id),created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE app_audit_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,occurred_at text NOT NULL,actor_id integer REFERENCES users(user_id),action text NOT NULL,record_type text NOT NULL,record_id text NOT NULL,reason text NOT NULL,previous_hash text,entry_hash text NOT NULL UNIQUE,old_json text NOT NULL DEFAULT '{}',new_json text NOT NULL DEFAULT '{}');
CREATE TABLE app_exceptions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,claim_ref varchar(30) NOT NULL REFERENCES app_claim_refs(ref),type text NOT NULL CHECK(type IN ('Late','LateFiling','Duplicate','Outlier','Mismatch')),reason text NOT NULL,resolved_at text,resolved_by integer REFERENCES users(user_id),resolution_note text NOT NULL DEFAULT '',UNIQUE(claim_ref,type));
CREATE TABLE app_payment_details(payment_id bigint PRIMARY KEY REFERENCES payments(payment_id),note text NOT NULL);
CREATE TABLE app_permissions(role text NOT NULL,permission text NOT NULL,PRIMARY KEY(role,permission));
INSERT INTO app_permissions(role,permission) VALUES
('CFB','events:read'),('CFB','events:write'),('CFB','analytics:read'),('CFB','exceptions:resolve'),('CFB','claims:read'),('CFB','claims:transition'),
('ACT','claims:read'),('ACT','payments:write'),('ACT','claims:reconcile'),('ACT','exceptions:resolve'),
('ROS','claims:read'),('ROS','claims:write'),('ROS','claims:transition'),('ROS','claims:import'),('ROS','exceptions:read'),
('RVP','claims:read'),('RVP','events:read'),('RVP','dashboard:read'),
('EXE','claims:read'),('EXE','events:read'),('EXE','events:close'),('EXE','events:revision:approve'),('EXE','analytics:read'),('EXE','dashboard:read'),
('AUD','claims:read'),('AUD','events:read'),('AUD','audit:read'),('AUD','dashboard:read'),('ADM','users:manage'),('ADM','settings:manage');

CREATE FUNCTION app_immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is immutable',TG_TABLE_NAME; END $$;
CREATE TRIGGER app_audit_immutable BEFORE UPDATE OR DELETE ON app_audit_log FOR EACH ROW EXECUTE FUNCTION app_immutable_history();
CREATE TRIGGER app_decisions_immutable BEFORE UPDATE OR DELETE ON app_request_decisions FOR EACH ROW EXECUTE FUNCTION app_immutable_history();
CREATE TRIGGER app_amendments_immutable BEFORE UPDATE OR DELETE ON app_request_amendments FOR EACH ROW EXECUTE FUNCTION app_immutable_history();
CREATE TRIGGER app_settings_history_immutable BEFORE UPDATE OR DELETE ON app_settings_changes FOR EACH ROW EXECUTE FUNCTION app_immutable_history();
CREATE FUNCTION app_assert_owned(code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM app_owned_events WHERE event_code=code) THEN
 RAISE EXCEPTION 'Existing Aiven records are read-only. Select an application demo event.' USING ERRCODE='23514';
END IF; END $$;
CREATE FUNCTION app_status(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE value WHEN 'UNDER_REVIEW' THEN 'Under Review' WHEN 'RETURNED' THEN 'Returned (RTH)' ELSE initcap(value) END
$$;
CREATE FUNCTION app_status_code(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE value WHEN 'Returned (RTH)' THEN 'RETURNED' ELSE upper(replace(value,' ','_')) END
$$;
CREATE FUNCTION app_actor() RETURNS integer LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.actor_id',true),'')::integer $$;

CREATE VIEW app_runtime_users AS SELECT u.user_id AS id,u.username,u.password_hash,
 CASE r.role_code WHEN 'CENTRAL_FIN' THEN 'CFB' WHEN 'REGIONAL_STAFF' THEN 'ROS' WHEN 'REGIONAL_VP' THEN 'RVP' WHEN 'PRESIDENT' THEN 'EXE' WHEN 'TREASURY' THEN 'ACT' WHEN 'AUDITOR' THEN 'AUD' WHEN 'ADMIN' THEN 'ADM' END AS role,
 COALESCE(g.region_code,'National') AS region,u.created_at FROM users u JOIN roles r USING(role_id) LEFT JOIN regions g USING(region_id) WHERE u.is_active;
CREATE VIEW app_runtime_providers AS SELECT p.provider_id AS id,p.provider_name AS name,r.region_code AS region FROM providers p JOIN regions r USING(region_id) WHERE p.is_active;
CREATE FUNCTION app_write_provider() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO providers(provider_code,provider_name,region_id) VALUES('APP-'||substr(md5(random()::text),1,16),NEW.name,(SELECT region_id FROM regions WHERE region_code=NEW.region)) RETURNING provider_id INTO NEW.id; RETURN NEW; END $$;
CREATE TRIGGER app_provider_insert INSTEAD OF INSERT ON app_runtime_providers FOR EACH ROW EXECUTE FUNCTION app_write_provider();

CREATE VIEW app_runtime_events AS SELECT event_code AS id,event_name AS name,initcap(status) AS status,(ceiling*100)::bigint AS budget FROM events;
CREATE FUNCTION app_write_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO events(event_code,event_name,circular_ref,ceiling,covered_from,covered_to,status,created_by) VALUES(NEW.id,NEW.name,'Illustrative application event',NEW.budget::numeric/100,CURRENT_DATE,CURRENT_DATE,upper(NEW.status),app_actor());
  INSERT INTO app_owned_events VALUES(NEW.id);
 ELSE
  PERFORM app_assert_owned(OLD.id);
  UPDATE events SET event_name=NEW.name,status=upper(NEW.status),ceiling=NEW.budget::numeric/100 WHERE event_code=OLD.id;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER app_event_write INSTEAD OF INSERT OR UPDATE ON app_runtime_events FOR EACH ROW EXECUTE FUNCTION app_write_event();
CREATE VIEW app_runtime_event_details AS SELECT e.event_code AS event_id,e.covered_from::text AS starts_on,e.covered_to::text AS ends_on,e.circular_ref AS circular_reference,d.closed_at,d.closed_by FROM events e LEFT JOIN app_event_details d ON d.event_id=e.event_code;
CREATE FUNCTION app_write_event_details() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM app_assert_owned(NEW.event_id);
 UPDATE events SET covered_from=NEW.starts_on::date,covered_to=NEW.ends_on::date,circular_ref=NEW.circular_reference WHERE event_code=NEW.event_id;
 INSERT INTO app_event_details(event_id,closed_at,closed_by) VALUES(NEW.event_id,NEW.closed_at,NEW.closed_by) ON CONFLICT(event_id) DO UPDATE SET closed_at=excluded.closed_at,closed_by=excluded.closed_by;
 RETURN NEW;
END $$;
CREATE TRIGGER app_event_details_write INSTEAD OF INSERT OR UPDATE ON app_runtime_event_details FOR EACH ROW EXECUTE FUNCTION app_write_event_details();
CREATE VIEW app_runtime_region_budgets AS SELECT e.event_code AS event_id,r.region_code AS region,(a.amount*100)::bigint AS allocation FROM event_allocations a JOIN events e USING(event_id) JOIN regions r USING(region_id);
CREATE FUNCTION app_write_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM app_assert_owned(NEW.event_id);
 IF TG_OP='INSERT' THEN
  INSERT INTO event_allocations(event_id,region_id,amount) VALUES((SELECT event_id FROM events WHERE event_code=NEW.event_id),(SELECT region_id FROM regions WHERE region_code=NEW.region),NEW.allocation::numeric/100);
 ELSE UPDATE event_allocations SET amount=NEW.allocation::numeric/100 WHERE event_id=(SELECT event_id FROM events WHERE event_code=OLD.event_id) AND region_id=(SELECT region_id FROM regions WHERE region_code=OLD.region);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER app_allocation_write INSTEAD OF INSERT OR UPDATE ON app_runtime_region_budgets FOR EACH ROW EXECUTE FUNCTION app_write_allocation();

CREATE VIEW app_runtime_claims AS SELECT c.claim_ref AS ref,e.event_code AS event_id,r.region_code AS region,COALESCE(d.patient_token,'') AS patient_token,c.case_type AS claim_type,app_status(c.status) AS status,(c.submitted_amount*100)::bigint AS claimed_amount,(COALESCE(c.approved_amount,0)*100)::bigint AS approved_amount,c.created_at,c.provider_id,c.service_date::text AS discharge_date,c.filed_date::text AS filing_date,d.decision_date,d.reason_code,c.created_by AS encoded_by,COALESCE(d.note,'') AS note FROM claims c JOIN events e USING(event_id) JOIN regions r USING(region_id) LEFT JOIN app_claim_details d USING(claim_id);
CREATE FUNCTION app_write_claim() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid bigint;
BEGIN
 PERFORM app_assert_owned(NEW.event_id);
 IF NEW.discharge_date IS NULL THEN RAISE EXCEPTION 'Discharge date is required for Aiven claims.' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  INSERT INTO claims(claim_ref,event_id,region_id,provider_id,case_type,service_date,filed_date,submitted_amount,approved_amount,status,created_by,created_at)
  VALUES(NEW.ref,(SELECT event_id FROM events WHERE event_code=NEW.event_id),(SELECT region_id FROM regions WHERE region_code=NEW.region),NEW.provider_id,NEW.claim_type,NEW.discharge_date::date,NEW.filing_date::date,NEW.claimed_amount::numeric/100,COALESCE(NEW.approved_amount,0)::numeric/100,app_status_code(NEW.status),COALESCE(NEW.encoded_by,app_actor()),COALESCE(NEW.created_at,CURRENT_TIMESTAMP)) RETURNING claim_id INTO cid;
  INSERT INTO app_claim_refs VALUES(NEW.ref,cid);
 ELSE
  UPDATE claims SET status=app_status_code(NEW.status),approved_amount=NEW.approved_amount::numeric/100 WHERE claim_ref=OLD.ref RETURNING claim_id INTO cid;
 END IF;
 INSERT INTO app_claim_details(claim_id,patient_token,decision_date,reason_code,note) VALUES(cid,NEW.patient_token,NEW.decision_date,NEW.reason_code,COALESCE(NEW.note,'')) ON CONFLICT(claim_id) DO UPDATE SET patient_token=excluded.patient_token,decision_date=excluded.decision_date,reason_code=excluded.reason_code,note=excluded.note;
 RETURN NEW;
END $$;
CREATE TRIGGER app_claim_write INSTEAD OF INSERT OR UPDATE ON app_runtime_claims FOR EACH ROW EXECUTE FUNCTION app_write_claim();
CREATE VIEW app_runtime_claim_history AS SELECT h.history_id AS id,c.claim_ref,app_status(h.new_status) AS status,h.changed_at AS created_at,h.changed_by AS actor_id,COALESCE(h.reason,'') AS note FROM claim_status_history h JOIN claims c USING(claim_id);
CREATE FUNCTION app_write_claim_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid bigint; code text; previous text;
BEGIN
 SELECT c.claim_id,e.event_code INTO cid,code FROM claims c JOIN events e USING(event_id) WHERE c.claim_ref=NEW.claim_ref;
 PERFORM app_assert_owned(code);
 SELECT new_status INTO previous FROM claim_status_history WHERE claim_id=cid ORDER BY history_id DESC LIMIT 1;
 INSERT INTO claim_status_history(claim_id,old_status,new_status,changed_by,reason) VALUES(cid,previous,app_status_code(NEW.status),COALESCE(NEW.actor_id,app_actor()),COALESCE(NEW.note,'')) RETURNING history_id INTO NEW.id;
 RETURN NEW;
END $$;
CREATE TRIGGER app_history_insert INSTEAD OF INSERT ON app_runtime_claim_history FOR EACH ROW EXECUTE FUNCTION app_write_claim_history();
CREATE VIEW app_runtime_payments AS SELECT p.payment_id AS id,c.claim_ref,(CASE WHEN p.entry_type='REVERSAL' THEN -p.amount ELSE p.amount END*100)::bigint AS amount,p.paid_date::text AS paid_at,p.recorded_by,COALESCE(d.note,'') AS note FROM payments p JOIN claims c USING(claim_id) LEFT JOIN app_payment_details d USING(payment_id);
CREATE FUNCTION app_write_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid bigint; eid integer; code text;
BEGIN
 SELECT c.claim_id,c.event_id,e.event_code INTO cid,eid,code FROM claims c JOIN events e USING(event_id) WHERE c.claim_ref=NEW.claim_ref;
 PERFORM app_assert_owned(code);
 INSERT INTO payments(payment_ref,claim_id,event_id,entry_type,amount,paid_date,recorded_by) VALUES('APP-'||substr(md5(random()::text),1,20),cid,eid,'PAYMENT',NEW.amount::numeric/100,NEW.paid_at::date,NEW.recorded_by) RETURNING payment_id INTO NEW.id;
 INSERT INTO app_payment_details VALUES(NEW.id,COALESCE(NEW.note,''));
 RETURN NEW;
END $$;
CREATE TRIGGER app_payment_insert INSTEAD OF INSERT ON app_runtime_payments FOR EACH ROW EXECUTE FUNCTION app_write_payment();
CREATE VIEW app_runtime_login_attempts AS SELECT attempt_id AS id,username,ip,attempted_at,successful::integer AS successful FROM app_login_attempts;
CREATE FUNCTION app_write_login_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN DELETE FROM app_login_attempts WHERE attempt_id=OLD.id; RETURN OLD; END IF;
 INSERT INTO app_login_attempts(username,ip,successful) VALUES(NEW.username,NEW.ip,NEW.successful=1) RETURNING attempt_id INTO NEW.id; RETURN NEW;
END $$;
CREATE TRIGGER app_login_attempt_write INSTEAD OF INSERT OR DELETE ON app_runtime_login_attempts FOR EACH ROW EXECUTE FUNCTION app_write_login_attempt();
