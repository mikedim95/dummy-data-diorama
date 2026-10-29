# Database coverage

The supplied v4 SQL and DBML remain unchanged. Migration 003 adds three missing
workflow tables and typed application fields. The current model is
[`WAM_app_28_tables_v5.dbml`](../database/schema/WAM_app_28_tables_v5.dbml).

All 28 tables are consumed by `/admin/records`, with search, relationship labels,
pagination and curated forms. Original dashboards remain available. Every write
uses authenticated actors, SQL constraints and optimistic versions where supported.

| Table | App use and supported management |
| --- | --- |
| EMPLOYEE | Employee dashboard; create/edit personnel, codes, contacts and activation |
| USER_ACCOUNT | Administrator-only employee/identity links, role and activation; self-lockout blocked |
| DEPARTMENT | Create/edit departments and responsible manager |
| EMPLOYEE_DEPARTMENT | Create/edit/remove membership and department role |
| ATTENDANCE | Daily attendance dashboard; operator arrival/departure, manager corrections |
| OPERATOR_SHIFT | Operator machine selection and handover; read-only session history |
| SHIFT_CHECK | Operator startup/shutdown checklist; read-only management history |
| CUSTOMER | Order intake and customer relationships; create/edit/archive |
| TEMPLATE | Actual design upload with checksum; immutable revision history |
| CUSTOMER_ORDER | Create intake; plan, approve exact design revision, release, QC, deliver or cancel |
| JOB | Plan and assign sequential steps; typed instructions, priority, duration and blockers; operator execution |
| JOB_MATERIAL | Create/edit/remove planned requirements before production; show planned versus actual usage |
| JOB_ACTIVITY | Operator comments, photos and status events; append-only timeline and management history |
| MACHINE | Machine dashboard and operator workstation selection; create/edit/archive equipment |
| ASSET | Create/edit/archive accessories and independent tools, machine/location/supplier relationships |
| LOCATION | Create/edit storage and equipment locations; operator stock location picker |
| MATERIAL | Inventory dashboard, job requirements and usage picker; create/edit/archive |
| SUPPLIER | Create/edit/archive vendor contacts and equipment/material relationships |
| SUPPLIER_MATERIAL | Create/edit/remove vendor-material links and finance-visible quotes |
| MACHINE_MATERIAL | Create/edit/remove supported material and purpose links |
| STOCK_BALANCE | Inventory dashboard and operator available stock; read-only, derived by posting movements |
| STOCK_MOVEMENT | Manager receipts/transfers/adjustments, operator consumption/returns; retry-safe immutable postings |
| MAINTENANCE_PLAN | Create/edit schedule, operator guidance, checklist phase, permissions and priorities |
| MACHINE_MAINTENANCE | Record service with plan/technician/supplier; completion advances recurring reminders |
| DOCUMENT | Upload/download preserved bytes; edit title/classification; visibility enforced server-side |
| DOCUMENT_LINK | Create/remove links to exactly one business target per row; supports activity photos |
| FINANCIAL_RECORD | Finance-only sales/purchases/expenses, payments and linked refunds; original postings preserved |
| AUDIT_LOG | Read-only actor/time/action/changed-field history; no raw before/after snapshots in management responses |

Manager access requires an active management account and the cloud manager grant
when using Supabase. Finance permissions control financial collections, cost fields,
restricted documents and financial links. Account management requires ADMIN.
Production accounts can modify their assigned active work through operator endpoints;
they cannot access management collections. Balance/history tables deliberately have
no direct create/edit forms.

Migration 003 preserves original notes, copies legacy shift/check/activity state,
links existing photos and keeps their bytes. Historical attendance without a recorded
checkout becomes LEGACY when a later attendance record exists, rather than inventing
a departure time. Original sample NAS paths remain placeholders until the files are
uploaded; uploading a new design preserves its actual bytes as a new revision.

Automated verification compares the management catalog with every public business
table and column, queries every collection with and without search, exercises record
creation/version conflicts/relationships, checks upload checksums and role redaction,
and upgrades a populated v4 database while verifying photos, completed jobs, checks
and original notes. Operator/backend tests cover execution, stock posting and shifts.
