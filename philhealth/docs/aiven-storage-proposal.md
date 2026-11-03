# Approved application storage plan

Owner approved this plan and its mappings on 2026-11-03, requesting demo/testing records. Implementation is complete for local testing. See aiven-postgresql-integration.md for the current storage boundaries, commands and verification.

Aiven amounts remain pesos, converted exactly at the API boundary to safe integer centavos. Confirmed native role codes map to existing app roles. service_date maps to discharge date, filed_date to filing date, and case_type to claim type.

Missing claim fields, text settings/history, event closure/revisions, monetary provider requests/decisions/amendments, derived exceptions, permissions and a separate immutable audit chain use app-owned tables. app_claim_refs protects the globally unique claim-reference contract without changing the native schema. Native sessions/login attempts are reused. Native business data stays readable, while mutations are restricted to events created by the app. Existing native audit data is available separately, without a verified-chain claim.

Nine demo accounts and four illustrative testing events were added. Initial reporting date is 2026-11-03. Backups are in ignored work/backups. Archive listing and decoding passed. Isolated restoration remains untested.
