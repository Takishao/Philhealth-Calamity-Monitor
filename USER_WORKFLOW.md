# PhilHealth Calamity Monitor: User Workflow and Roles

This guide describes the current application as of 20 November 2026. All examples are illustrative. Do not enter real patient names, identifying information or actual PhilHealth figures into the demo.

## 1. How the system works

Finance registers an event and its budget. Regional staff submit claims for that event. Finance reviews the claims and records decisions. Accounting records payments against approved amounts. Dashboards, exceptions and reports show the resulting budget position.

| Stage | Person responsible | Page | Result |
|---|---|---|---|
| Register event and regional budgets | Central Finance | Events & budgets | Event and allocations saved |
| Register a provider | Finance or regional staff | Provider requests | Provider becomes available for claim entry |
| Submit provider request, if needed | Finance or regional staff | Provider requests | Route A/B request saved with its event |
| Decide provider request | Independent Finance, executive or regional approver | Provider requests | Decision added to request history |
| Encode claims or import CSV | Regional staff | Claims | Validated claims saved as Submitted |
| Review and decide claims | Central Finance | Claims, open a reference | Status and approved amount recorded |
| Record payments | Accounting / Treasury | Claims, open a reference | Payment saved and matched to approved balance |
| Monitor and export | Authorized viewing roles | Dashboard, Exceptions, Analytics, Reports | Current totals, forecasts and export files |
| Review evidence | Finance or auditor | Audit trail | Action history and evidence export |

Provider-request approval and claim approval are separate workflows. Approving a provider request does not automatically approve or pay a claim. Recording a payment logs a payment in the database. It does not send money through a bank.

## 2. Start and sign in

Install Node.js 22.9 or newer. On this Mac:

```sh
cd '/Users/takishao/Downloads/Personal Workspace/Philhealth-Calamity-Monitor'
./start.sh
```

Open http://localhost:3000. Keep the terminal open. Press Control-C to stop the server. On Windows, double-click start.bat.

The existing Aiven setup needs the owner's private philhealth/.env and CA certificate. They are intentionally excluded from GitHub. A source download alone does not grant Aiven access. For an independent offline demo, use SQLite:

```sh
DB_DRIVER=sqlite SEED_DEMO=1 ./start.sh
```

SQLite account names omit the demo_ prefix. For example, use cfb instead of demo_cfb. Refer to README.md for setup and all offline accounts. The demo password is demo1234. These credentials are illustrative and must not be used for a public deployment.

## 3. Every application account and role

The following are the supplied Aiven demo accounts. All use the illustrative password above.

| Username | Role | What the user can do | Important limits |
|---|---|---|---|
| demo_cfb | Central Finance | Register events and budgets, propose allocation revisions, register providers and requests, review claims, approve/return/deny claims, resolve exceptions, view analytics/reports/audit and export evidence | Cannot encode new claims through the regional entry form or record payments. Cannot approve a provider request they created |
| demo_act | Accounting / Treasury | View dashboard and claims, record partial/full payments on approved claims, view exceptions and reports | Cannot approve claims, create events or change settings. Payment cannot exceed the approved unpaid balance |
| demo_exe | Executive approver | Record independent provider-request decisions, approve allocation revisions, close events, view dashboard/claims/exceptions/analytics/reports | The current claim approval endpoint does not allow this role. Claim approval is handled by Finance |
| demo_aud | Read-only auditor | View events, requests, dashboard, claims, exceptions, analytics, reports and audit evidence | Cannot create business records, approve claims or requests, record payments or change settings |
| demo_adm | Administrator | Change thresholds, reporting date and other settings through Admin | No normal claim/budget/payment screens. Administrator is not a Finance substitute. There is no user-management screen in the current UI |
| demo_ros_iva | Regional staff, IVA | Register regional providers/requests, encode IVA claims, validate/commit CSV, move permitted claims into review or resubmission, view regional dashboard/claims/exceptions/reports | IVA records only. Cannot approve/deny claims, record payments or change budgets |
| demo_ros_vii | Regional staff, VII | Same regional entry and viewing workflow for VII | VII records only. Same restrictions as IVA staff |
| demo_ros_xi | Regional staff, XI | Same regional entry and viewing workflow for XI | XI records only. Same restrictions as IVA staff |
| demo_rvp_vii | Regional approver, VII | Review VII provider requests and record independent decisions, view regional dashboard/claims/exceptions/reports | VII scope. Cannot approve claims, enter claims, record payments or approve budget revisions through the current UI |

GitHub repository permissions and application roles are separate. Inviting a teammate to GitHub does not create an application login or assign them Finance, Accounting or Administrator privileges. Each teammate can use the appropriate existing demo login for practice. Do not assign permanent business responsibilities merely by sharing a demo password.

## 4. Create an event and its budget

Sign in as demo_cfb.

1. Open Events & budgets and scroll to Register event.
2. Enter a unique event ID and a clear event name.
3. Enter the ceiling in integer centavos.
4. Enter valid start/end dates and the circular reference.
5. Enter one regional allocation per line, using region,amount.
6. Click Register event.
7. Select the new event in the dropdown at the top.

| Example field | Illustrative value | Meaning |
|---|---|---|
| Event ID | TRAINING-2026-01 | Unique identifier |
| Event name | Training event, illustrative | Identifies test data |
| Ceiling in centavos | 1000000 | PHP10,000.00 |
| Starts on | 2026-01-01 | First allowed filing date |
| Ends on | 2026-12-31 | Last allowed filing date |
| Circular reference | Illustrative training circular | Reference text |
| Regional allocation line | XI,1000000 | Allocate PHP10,000.00 to XI |

Allocations together cannot exceed the ceiling. Dates must be valid and ordered. Older Aiven events that existed before the app integration are read-only. Use a labeled testing event or a new event for practice.

## 5. Register a provider and an optional request

As Finance or regional staff, open Provider requests and find Register provider. Enter the provider name and region, then submit. Regional staff can register providers only in their own region.

To submit a provider request, select the correct event, choose the provider and Route A or B, enter requested centavos and a note, then click Register request.

An independent permitted approver opens Record decision, chooses Approved, Returned or Denied, supplies a reason and saves. The creator cannot approve their own provider request. Regional approvers must stay within their region. Later changes use Append request amendment and preserve the earlier record.

Route A/B criteria and the full official approval chains have not been supplied. The app records the chosen route and decision history. It does not determine which route official policy requires.

## 6. Encode one claim

Sign in with the correct regional account, select the event and open Claims. Scroll to Encode claim.

| Field | Example | Rule |
|---|---|---|
| Reference | TRAINING-XI-001 | Unique claim reference |
| Token | PT-20260001 | Pseudonymous token. PT- followed by at least four digits |
| Case type | Inpatient | Required descriptive case type |
| Claimed centavos | 125000 | PHP1,250.00, positive integer |
| Filing date | 2026-11-01 | Must fall inside the selected event period |
| Discharge date | 2026-10-30 | Required for Aiven claim entry |
| Provider | A registered XI provider | Must match the account's region |

Click Submit claim. A success message confirms the request completed. Reopen Claims to refresh the table and verify the reference. Click the reference to view status history.

| Pesos you mean | Centavos to enter |
|---:|---:|
| PHP100.00 | 10000 |
| PHP1,250.00 | 125000 |
| PHP10,000.00 | 1000000 |
| PHP1,000,000.00 | 100000000 |

The server rejects duplicates, invalid or negative amounts, missing providers and out-of-period filing dates. Do not manually edit database rows to bypass validation.

## 7. Import several claims with CSV

Regional staff can upload a CSV file or paste its contents under Claims. Use this header:

```csv
ref,event_id,region,token,type,claimed,provider_id,filing_date,discharge_date
```

Use the event's exact ID, the staff account's region, a real registered provider ID and integer centavos. Ask the owner for the provider ID if you only know the display name. Do not guess it.

1. Choose the file or paste the CSV.
2. Click Validate CSV.
3. Read the row, field and error table.
4. Correct all errors and validate again.
5. Click Commit validated import.
6. Reopen Claims to confirm the saved records.

Validation is a preview. It does not save claims. Editing the CSV requires validation again. The server rechecks the entire import before committing it. A failing batch does not partially save accepted rows. Do not include a patient_name column or real identifying information.

## 8. Review, approve, return or deny a claim

Finance signs in as demo_cfb and opens Claims for the selected event.

1. Click the claim reference.
2. Select Under Review, enter a note and click Record status.
3. Reopen the claim when ready to decide.
4. Choose Approved, Returned (RTH) or Denied.
5. For approval, enter approved centavos. The amount must be positive and no greater than the claimed amount.
6. For return or denial, enter both a reason code and a note.
7. Click Record status and verify the new history entry.

| Current status | Allowed next step | Who handles it |
|---|---|---|
| Submitted | Under Review | Finance or regional staff in scope |
| Under Review | Approved | Finance |
| Under Review | Returned (RTH) or Denied | Finance, with reason code and note |
| Returned (RTH) | Resubmitted | Regional staff in scope or Finance |
| Denied | Resubmitted | Regional staff in scope or Finance |
| Resubmitted | Under Review | Regional staff in scope or Finance |
| Approved | Partial payment or full payment | Accounting through Record payment |
| Paid | Reconciliation | Accounting API workflow. No separate reconciliation control is exposed in the current claim modal |

An encoder cannot approve their own claim. Regional encoders cannot approve or deny claims even if a status option appears in the modal. The server enforces the restriction. Over-ceiling approval needs a Finance override reason. Other date and transition checks still apply.

A return/resubmission currently records a new status and note. The UI does not provide a general claim-edit form for changing an already submitted amount or provider. Escalate incorrect saved fields to the owner rather than altering database records directly.

## 9. Record a payment

Accounting signs in as demo_act, selects the event and opens the approved claim reference.

1. Enter Payment centavos and Payment date.
2. Click Record payment.
3. Reopen the claim to verify payment history and balance.

Partial payments are allowed. The total cannot exceed the approved amount. A full payment sets the claim to Paid. Payment dates are checked against the configured reporting as-of date, which may be earlier than today. Ask the Administrator to review that setting if a valid current payment date is rejected.

| Approved amount | Recorded payment | Approved but unpaid |
|---:|---:|---:|
| PHP1,250.00 | PHP1,000.00 | PHP250.00 |
| PHP1,250.00 | PHP1,250.00 total | PHP0.00 |

If the database connection drops during a payment, check history before submitting again. An interrupted commit can have an uncertain result and is not automatically replayed.

## 10. Revise a regional budget or close an event

Finance opens Events & budgets, enters a region and revised allocation under Propose allocation revision, then submits. The revised amount replaces that region's allocation rather than adding to it.

Executive demo_exe enters the revision ID under Approve revision and approves it. The approver must be independent, and allocations together must stay within the event ceiling. Executive can also use Close selected event. Closure prevents new claims, so read the confirmation before proceeding.

## 11. Read the dashboard and reports

| Indicator | Calculation | Meaning |
|---|---|---|
| Event ceiling | B | Available budget ceiling |
| Committed | A | Approved commitments |
| Paid | P | Recorded payments |
| Remaining | B - A | Budget not yet committed |
| Utilization | A / B x 100 | Committed share of budget |
| Paid utilization | P / B x 100 | Paid share of budget |
| Approved but unpaid | A - P | Outstanding approved balance |
| Variance | A - B | Negative is under budget, positive is over budget |
| Variance percent | (A - B) / B x 100 | Variance relative to budget |

Illustrative worked example: B=PHP50M, A=PHP40M, P=PHP32M. Remaining PHP10M, utilization 80%, paid utilization 64%, unpaid PHP8M, variance -PHP10M and -20%.

| Condition | Suggested default | Display |
|---|---|---|
| Normal | Below 80% | Green, icon and label |
| Warning | At least 80% | Amber, icon and label |
| Danger | At least 90% | Red, icon and label |
| Critical | At least 100% or forecast exceeds ceiling | Deep red, icon and Over ceiling/Critical label |

Administrator can change the thresholds. They are illustrative defaults, not official PhilHealth rules. A low current utilization can still show Over ceiling when the forecast predicts a breach.

Exceptions lists late, returned, denied, unusual and unmatched items. Finance can record resolution reasons where the Resolve button is available. Resolving an exception records its handling. It does not itself change the claim's approval or payment amount.

Analytics uses aging, population z-scores, a three-week moving average, a four-week forecast, scenarios and advisory fund allocations. Scenario results do not move funds automatically. Forecasts and aging use the configured reporting date.

| Report | Purpose |
|---|---|
| Budget versus Actual Variance | Compare ceiling, commitments, payments and variance |
| Claims Status Summary | Review counts and approved amounts by status |
| Claims Aging | Find claims with long elapsed filing time |
| Exceptions Register | Review recorded and derived exception items |
| Payment Reconciliation | Compare approved and paid balances |
| Regional Summary | Compare allocations, commitments and payments by region |

Open Reports and choose PDF, Excel or CSV. Shared totals must equal the dashboard for the same event and role scope. Regional accounts see regional financial totals. Central accounts see the national view.

## 12. Where data is stored and what GitHub contains

The active configured app saves to Aiven PostgreSQL through the server. The UI/API work in centavos, and the database integration converts monetary values to Aiven's peso representation. A separate SQLite mode supports local offline testing.

GitHub contains source code, migrations, illustrative seed scripts, tests, assets and documentation. It does not contain the live Aiven database, the private .env, CA files, database dumps, local SQLite databases or installed node_modules. Downloading source does not copy the owner's live database.

Audit and status histories preserve the actor, action and supporting notes. The app-owned audit ledger is append-only. Legacy audit evidence is separate, and its original hash algorithm is not verified by the app.

## 13. Common problems

| Problem | Check |
|---|---|
| No claim-entry form | Use a regional staff account, not Finance, Auditor or Administrator |
| Provider dropdown is empty | Register a provider in the staff account's region |
| Claim rejected as duplicate | Use a unique reference and avoid duplicate provider/token/date/amount combinations |
| Filing date rejected | Select the correct event and use a date within its period |
| Approval rejected | Move the claim to Under Review, use Finance, and enter a valid approved amount |
| Return or denial rejected | Supply both reason code and note |
| Payment date rejected | Review the Administrator's reporting as-of date |
| Payment rejected | Confirm claim is approved and payment fits the unpaid balance |
| Old event cannot be edited | Use an app-created event or labeled testing event |
| Figures show the wrong region/event | Check the selected event and the signed-in account's scope |
| Downloaded project cannot reach Aiven | Obtain authorized private configuration separately or use the offline SQLite demo |

## 14. Current limits

This is an illustrative local application, not an official policy engine or production certification. Route criteria and the paper's missing Table II wording remain open. Email/SMS notifications are future work. The application has no user-management screen, general claim-edit screen or dedicated reconciliation button. Do not confuse backend capability with a visible workflow.

Verification on 20 November 2026: 35 automated checks passed, one live write suite skipped, nine Aiven demo accounts authenticated, all 18 report exports returned and dashboard/report totals matched. These checks do not guarantee every possible input or deployment condition.
