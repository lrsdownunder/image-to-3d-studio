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

# Architecture rules
- 3D generation runs only on the self-hosted GPU backend in `backend/` (FastAPI + TRELLIS.2 on RunPod); never call proprietary 3D APIs — the product must stay independent.
- `src/lib/backend-contract.ts` is the single source of truth for the site↔backend API; change it and `backend/` together.
- Job status is written only by server code (service role) and the HMAC-verified callback route; users have read-only access to jobs, so progress can't be faked from the browser.
- Uploads and outputs live in private buckets under `<user_id>/...` and are served via signed URLs; the GPU only gets signed URLs, never Cloud keys.
- The three.js viewer is loaded through `LazyViewer` (ClientOnly + lazy) so three never runs during SSR.
