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
