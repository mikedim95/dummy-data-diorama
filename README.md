# WAM workshop app

Workshop operator app and management dashboard, connected to the supplied WAM v4 PostgreSQL database (25 tables).

## Run locally

Requires Node.js 22.20 or later.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. Operator: `OP-104` or `OP-117`, PIN `1234`.
Management: http://127.0.0.1:3000/auth, local PIN `1234`.

The default local database is PostgreSQL/PGlite, persisted to `.data/wam`; photos are
stored under `.data/uploads`. Docker is optional. Stop the server before running
CLI commands on the embedded database. The supplied SQL enforces approvals,
production steps, inventory posting, finance checks, maintenance reminders, and audit
history. Sample logins and seeding are disabled in production.

Read [backend setup and API documentation](docs/backend.md) for external PostgreSQL,
Docker, authentication, production hosting, endpoints, and data storage.

## Check

```powershell
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

The repository's existing lint setup also checks Prettier formatting throughout the
original source. `npm run lint` reports existing formatting differences; the backend
is linted independently during integration.

## Project

Original app: https://github.com/mikedim95/dummy-data-diorama

Built with React, TanStack Start, Tailwind CSS and Lovable. Management data remains
server-only and role-filtered. The cloud Supabase sign-in flow is preserved; real
accounts need a linked `USER_ACCOUNT` and cloud role grants, as documented.

[Continue in Lovable](https://lovable.dev/projects/c65c7673-f6a8-40e9-80ba-8ac6edb83b7e).

## Render preview

See [Render deployment and sign-in](docs/render.md). The hosted preview uses generated passwords and a managed PostgreSQL database; the local `1234` PIN is disabled there.
