-- Keep the pre-existing ledger available separately. Its hash algorithm has
-- not been confirmed, so the API must not claim its chain was verified.
CREATE VIEW app_legacy_audit_log AS SELECT * FROM audit_log;
