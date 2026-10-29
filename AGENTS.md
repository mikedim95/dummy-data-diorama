<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## WAM operator app
- Operator data access goes through `src/lib/wam/store.tsx` and `client-api.ts`, calling authenticated `/api/wam/*` endpoints. Server code lives in `src/server/wam`. Do not restore browser-local authoritative state.
- Business rules (task sort, claim checks, shift finish) live as pure functions in `src/lib/wam/logic.ts` with tests.
- Management dashboard lives under `/admin`; all its data goes through `src/lib/wam/admin-api.ts` and the role-checked `getAdminSnapshot` server function, with PostgreSQL queries in `src/server/wam/read-models.ts`. KPI rules live in `admin-logic.ts` with tests. Drill-down detail is the `d=type:id` search param rendered by `DetailDrawer`, so details are shareable and Back works.
- Admin access: `/admin` is client-only (`ssr: false`) and redirects signed-out users to `/auth`; its data comes only from the `getAdminSnapshot` server function, which checks `user_roles` (manager; finance for money data) and strips what the caller may not see. Never import `admin-data.ts` from client code — only dynamically inside server handlers — so data never ships in the browser bundle.
- Roles live in `public.user_roles` (`app_role`: manager, finance). The first account ever created is auto-granted both by a trigger; later accounts start with none.

## WAM v4 backend
- Preserve the supplied SQL/DBML in `database/`. Add numbered migrations rather than editing applied migrations; initialization is for fresh databases only.
- There are exactly 25 public business tables. Internal migration metadata lives in `wam_internal`.
- PGlite is local development storage. Production requires `DATABASE_URL`; normal deployments use verified Supabase identities linked to active WAM accounts. The explicitly configured seeded Render preview uses generated passwords and `seed-preview` identities instead.
- Local sample login requires `WAM_LOCAL_DEMO=true`, non-production mode, and a loopback host. Never expose sample PIN login in production.
- Cloud dashboard access requires both a WAM management role and the existing Supabase manager grant; finance data additionally requires the finance grant.
- Set transaction-local audit actor/reason only after authentication. Respect SQL workflow triggers and optimistic versions. Stock balances are only changed by stock movements.
- Demo fixtures are imported only by the server seeder. Management snapshots must never return demo fixture modules or bypass role checks.
- `npm test`, `npm run typecheck`, and `npm run build` verify integration. See `docs/backend.md`.

## Render preview
- `render.yaml` targets the existing WAM / Preview environment. The frontend and backend share one Node web service; Postgres holds the seeded schema and photo bytes.
- Hosted preview login is separate from local PIN login. Require configured HTTPS origin, long generated manager/operator passwords, a stable session secret, secure mode-scoped cookies, and active database accounts. Never publish default PIN access.
- `npm run start:render` applies migrations and idempotently seeds an empty external database through the explicit preview seeding guard. Never reset or overwrite existing business data to deploy.
- Store production photos transactionally in `wam_internal.document_content`; ephemeral service disk must not be the only copy.
- See `docs/render.md` for secrets, account access, and free-plan expiry. Keep deployment credentials in ignored local files and Render environment secrets.
