ALTER TABLE event_details ADD COLUMN circular_reference TEXT NOT NULL DEFAULT '';
INSERT OR IGNORE INTO settings(key,value) VALUES ('danger_pct','90');
CREATE TABLE provider_requests(id INTEGER PRIMARY KEY, event_id TEXT NOT NULL REFERENCES calamity_events(id), provider_id INTEGER NOT NULL REFERENCES providers(id), route TEXT NOT NULL CHECK(route IN ('A','B')), amount INTEGER NOT NULL CHECK(amount>0), note TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE request_decisions(id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES provider_requests(id), decision TEXT NOT NULL CHECK(decision IN ('Approved','Denied','Returned')), note TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TRIGGER decisions_no_update BEFORE UPDATE ON request_decisions BEGIN SELECT RAISE(ABORT,'approval history is immutable'); END;
CREATE TRIGGER decisions_no_delete BEFORE DELETE ON request_decisions BEGIN SELECT RAISE(ABORT,'approval history is immutable'); END;
