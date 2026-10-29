# WAM database backend

The application now reads and writes the supplied WAM v4 PostgreSQL schema. The
original SQL is preserved byte for byte in `database/migrations/001_wam_v4.sql`;
the accompanying DBML is in `database/schema/`. The original schema has 25 business tables; migration 003 extends it to 28
and the `OPERATOR_MAINTENANCE` view. Migration bookkeeping is isolated in the
`wam_internal` schema.

## Local development

Use Node.js 22.20 or later. From this repository:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. Operator accounts are `OP-104` and `OP-117`, with
sample PIN `1234`. Management sign-in is at `/auth`, also with sample PIN `1234`.
Change `WAM_LOCAL_PIN` in `.env.local` to change the local PIN. These are explicitly
local sample accounts, not production credentials.

Without `DATABASE_URL`, the server uses PGlite: PostgreSQL running locally with
data persisted in `.data/wam`. No Docker service is needed. Uploaded documents and photos are stored transactionally in PostgreSQL
`wam_internal.document_content`, with metadata and links in `DOCUMENT` and `DOCUMENT_LINK`.
Stop the development server before running database CLI commands against PGlite;
only one process should open that data directory. Restarting the server preserves
database records; local sessions expire on restart unless `WAM_SESSION_SECRET` is
set consistently. Browser drafts stay local; mutations require a server connection.

Seeding runs only when `WAM_LOCAL_DEMO=true`, outside production, and the employee
table is empty. It never replaces existing WAM data. Sample designs/reference-file
paths are placeholders; the original NAS files were not supplied. Sample startup
and shutdown checklists are demonstration content, separate from recurring service
plans. Replace them with approved machine instructions before operational use.

## External PostgreSQL

To use Docker, set `WAM_POSTGRES_PASSWORD` in `.env.local`, then:

```powershell
docker compose --env-file .env.local up -d db
```

Set `DATABASE_URL=postgres://wam:YOUR_PASSWORD@127.0.0.1:5433/wam` in `.env.local`
(URL-encode special password characters). Stop the app, then run `npm run db:migrate`
and optionally `npm run db:seed` for a fresh local sample database, and restart it.
The same migration and query adapter supports a hosted PostgreSQL database.

This is a fresh-install schema, not a migration for an existing WAM database.
Migration checksums reject edits to already-applied SQL. Add a new numbered SQL
file for future changes. Normal startup checks/applies pending migrations.

## Authentication and production

Local sample login requires `WAM_LOCAL_DEMO=true`, a loopback host, and a
non-production process. Signed, HttpOnly, SameSite cookies last eight hours. Every
request rechecks that its account and employee are active. All writes require a
matching Origin header. The server supplies employee/account identities and audit
transaction settings; request bodies cannot choose an audit actor.

Production requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
and matching `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at build time.
Disable `WAM_LOCAL_DEMO`. Authentication uses verified Supabase claims. Provision a
`USER_ACCOUNT` with `auth_provider='supabase'`, `auth_subject` equal to the Supabase
user UUID, and the appropriate employee and role. Accounts are never auto-promoted.
Cloud management access also requires the existing Supabase `user_roles.manager`
grant; money data requires `user_roles.finance`. The local sample ADMIN sees finance;
MANAGER accounts without finance permission receive no finance records, restricted
documents, or material unit costs in their snapshot.

```powershell
npm run build
# Set production environment variables in the host/service, then:
npm start
```

The build targets a Node server. Keep the `database` folder available relative to
the application's working directory. Persist and back up external PostgreSQL and its internal document-content tables. For the password-protected, seeded Render preview, see
[Render setup](render.md). Its photo bytes are stored in PostgreSQL; it does not
change the existing Lovable/Supabase deployment.

## Data boundaries and endpoints

Screens continue using `src/lib/wam/store.tsx` and `admin-api.ts`. The operator
store now calls authenticated HTTP endpoints; authoritative state is no longer in
localStorage. Management dashboards use `getAdminSnapshot`; the records workspace uses
`getManagementRecords` and the role-checked records API. Fixtures are imported only by the server seeder.

All HTTP endpoints are under `/api/wam/`. JSON writes require `Content-Type:
application/json` and an Origin matching the app URL. Cloud clients supply a Bearer
token; local clients use the session cookie.

| Endpoint                                                      | Method | Purpose                                                                              |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `health`, `config`                                            | GET    | Database readiness and local sample-mode flag                                        |
| `login`                                                       | POST   | Local sample ID/PIN sign-in                                                          |
| `session`                                                     | GET    | Current verified account summary                                                     |
| `logout`                                                      | POST   | Clear local session                                                                  |
| `operator`                                                    | GET    | Current database-backed operator snapshot                                            |
| `shift/start`, `shift/finish`                                 | POST   | Attendance and handover                                                              |
| `machine`, `checks`                                           | POST   | Machine selection and recorded maintenance checks                                    |
| `tasks/:id/claim`, `tasks/:id/activity`, `tasks/:id/complete` | POST   | Production work with `recordVersion` conflict checks                                 |
| `files/:id`                                                   | GET    | Authorized task-photo bytes                                                          |
| `customers`, `orders`, `jobs`                                 | POST   | Office/manager intake and production-step planning                                   |
| `orders/:id`                                                  | PATCH  | Manager workflow, approval, QC, cancellation, and release; requires `record_version` |
| `stock-movements`                                             | POST   | Retry-safe posting with `request_key`; balances update through SQL triggers          |
| `audit`                                                       | GET    | Manager access to recent change metadata                                             |

`/admin/records` provides curated forms for every business table. Each entity has
an explicit create/edit field allowlist; derived balances and append-only histories
are read-only. Existing dashboard pages link to the corresponding collection.
See [table coverage](database-coverage.md) for workflows and permissions.

`GET /api/wam/records/:entity` lists/searches records; POST creates, PATCH updates
with `{values,version,reason?}`, and DELETE removes designated relationships only.
Uploads accept files up to 10 MB, record real SHA-256 checksums and immutable design
revisions, and serve bytes through the authorized `/api/wam/files/:id` route.

The SQL enforces exact-template approvals, sequential steps, completed quantities,
immutable revisions and completed jobs, nonnegative inventory, refund rules, and
append-only audit history. The API additionally enforces roles, one active job per
operator, machine pre-start checks, assigned-operator writes, and shift handover.
Completing the last job moves its order to QC, without automatically passing QC.

Migration 003 copies legacy activity, photos and checklist state into `JOB_ACTIVITY`,
`OPERATOR_SHIFT` and `SHIFT_CHECK`, retaining the original notes. New activity is
append-only; closed shifts and their checks are preserved. Instructions, priority,
estimates, machine model and customer city have typed columns. Plan completions
use `MACHINE_MAINTENANCE` retry keys and advance reminders through SQL triggers.
Operators see material requirements and post actual usage or returns from active
jobs; `JOB_MATERIAL` remains the plan and `STOCK_MOVEMENT` drives balances.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Backend tests execute the supplied SQL in PostgreSQL/PGlite and check the DBML
column set, authentication and role filtering, approval rules, concurrent claims,
version conflicts, photo persistence, audit attribution, inventory retries and
insufficient stock, and shift completion. Existing app/KPI tests also run.
