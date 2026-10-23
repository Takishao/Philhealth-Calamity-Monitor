
CREATE TABLE request_amendments(id INTEGER PRIMARY KEY,request_id INTEGER NOT NULL REFERENCES provider_requests(id),route TEXT NOT NULL CHECK(route IN ('A','B')),amount INTEGER NOT NULL CHECK(amount>0),note TEXT NOT NULL,actor_id INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TRIGGER amendments_no_update BEFORE UPDATE ON request_amendments BEGIN SELECT RAISE(ABORT,'request history is immutable'); END;
CREATE TRIGGER amendments_no_delete BEFORE DELETE ON request_amendments BEGIN SELECT RAISE(ABORT,'request history is immutable'); END;
