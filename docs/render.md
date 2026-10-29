# Seeded Render preview

The frontend and backend run together in the `wam-v4-preview` Node web service.
The `wam-v4-preview-db` PostgreSQL instance stores the 28 WAM tables, audit history,
and uploaded photos. Both resources belong to the existing **WAM / Preview**
environment in Frankfurt.

The app deploys from `codex/wam-v4-backend`. Build: `npm ci --include=dev && npm run
build`. Start: `npm run start:render`. Readiness: `/api/wam/health`. The start command
applies numbered migrations and seeds an empty database before starting the server;
it never resets an existing seeded database. The original v4 SQL remains unchanged.

`render.yaml` describes this setup. The initial resources are created directly in
the existing project through Render's authenticated MCP/API connection. The file
can subsequently be used to manage these same resources as a Blueprint.

## Access

Hosted preview accounts use server-configured, generated passwords over HTTPS.
They never accept the local sample password. There is no public signup or automatic
promotion in preview mode.

Everyone signs in at `/` with email and password. `/auth` redirects there.

- `admin@wam.example`: management access from its database role.
- `nikos@wam.example`, `eleni@wam.example`: operator workspaces from their database roles.

The existing generated preview passwords remain valid. Identity/role are queried
after authentication; no login choice or hardcoded manager identity is sent by the form.
Migration 004 preserves account IDs and provisions salted password hashes in the
private schema. The old ID/PIN and preview-specific login endpoints are removed.

Passwords are stored as Render environment secrets, and initial access details are
saved privately in the local workspace's ignored `.data/render-access.txt` file.
To rotate access, replace `WAM_PREVIEW_ADMIN_PASSWORD` and/or
`WAM_PREVIEW_OPERATOR_PASSWORD` in Render. Rotate `WAM_SESSION_SECRET` as well to
invalidate existing sessions immediately. Cookies are signed, HttpOnly, Secure,
SameSite=Strict, scoped to preview authentication, and expire after eight hours.
Each request checks the account and employee activation status in PostgreSQL.

## Required environment

| Variable                        | Value                                                 |
| ------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                  | Internal Render PostgreSQL connection string          |
| `NODE_VERSION`                  | `22.20.0`                                             |
| `NODE_ENV`                      | `production`                                          |
| `HOST`                          | `0.0.0.0`                                             |
| `TZ`                            | `Europe/Athens`                                       |
| `WAM_LOCAL_DEMO`                | `false`                                               |
| `WAM_PREVIEW_MODE`              | `true`                                                |
| `WAM_SEED_PREVIEW`              | `true`                                                |
| `WAM_PHOTO_STORAGE`             | `database`                                            |
| `WAM_PUBLIC_ORIGIN`             | Exact HTTPS origin, with no trailing slash            |
| `WAM_SESSION_SECRET`            | Generated secret of at least 32 characters            |
| `WAM_PREVIEW_ADMIN_PASSWORD`    | Generated manager password of at least 20 characters  |
| `WAM_PREVIEW_OPERATOR_PASSWORD` | Generated operator password of at least 20 characters |

Preview mode fails closed if its origin or secrets are incomplete. The existing
Supabase login path remains available for a future deployment with preview mode
disabled and real WAM identity mappings provisioned.

Photo bytes are stored transactionally in `wam_internal.document_content` and are
served only after document authorization. This internal storage table does not
change the 25-table business schema. In production, local ephemeral disk is not
used for new uploaded photos.

## Free preview limits

The deployment uses free web/database plans. The initial database expires on
**28 November 2026**, as reported by Render when it was created. Upgrade or export
it before that date to retain the data. A free web service can sleep when idle, so
its first request can take longer to respond. This deployment is a seeded preview;
it does not import live WAM business records or change the existing `wam-studio`
static site.
