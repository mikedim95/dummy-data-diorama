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
- All data access goes through `src/lib/wam/store.tsx` (demo data from `mock-data.ts`, persisted to localStorage) — swap to the real DB there only, so screens stay unchanged.
- Business rules (task sort, claim checks, shift finish) live as pure functions in `src/lib/wam/logic.ts` with tests.
- Management dashboard lives under `/admin`; all its data goes through `src/lib/wam/admin-api.ts` (demo data in `admin-data.ts`), KPI rules in `admin-logic.ts` with tests. Drill-down detail is the `d=type:id` search param rendered by `DetailDrawer`, so details are shareable and Back works.
- Admin access: `/admin` is client-only (`ssr: false`) and redirects signed-out users to `/auth`; its data comes only from the `getAdminSnapshot` server function, which checks `user_roles` (manager; finance for money data) and strips what the caller may not see. Never import `admin-data.ts` from client code — only dynamically inside server handlers — so data never ships in the browser bundle.
- Roles live in `public.user_roles` (`app_role`: manager, finance). The first account ever created is auto-granted both by a trigger; later accounts start with none.
