# Current setup

Recorded 29 October 2026. Repository inspection establishes file presence and documented design, not live service health.

| Component | Role | Source |
| --- | --- | --- |
| Lovable-connected frontend | Website, authentication screens, upload and model library | [Root README](../../README.md), src/routes |
| Three.js viewer | Client-only model preview | src/components/LazyViewer.tsx and ModelViewer.tsx |
| Supabase integration | Authentication and private data/storage integration | src/integrations/supabase |
| GPU backend | FastAPI and self-hosted TRELLIS.2 | backend/ |
| Job contract | Site/backend request and response contract | src/lib/backend-contract.ts |
| Project rules | Architecture and safe Lovable history handling | [AGENTS.md](../../AGENTS.md) |

## Operational status

The [existing roadmap](../../roadmap.md) records an RTX A6000 deployment, a successful GPU smoke test and a football end-to-end run (98,483 faces). These are repository-recorded historical results, not tests rerun during tracking setup.

The [backend guide](../../backend/README.md) still contains older “not tested” statements and installation instructions that need reconciliation. Follow issue #5 before treating that guide as a verified restart/reinstall runbook.

## Record these before the next backend change

- Frontend commit and deployment identifier:
- GPU backend commit and installed TRELLIS.2 revision:
- Current install directory and start command, checked on the pod:
- Persistent model/cache directories:
- Pipeline and texture settings:
- Last health check date and result:
- Secret locations (names only, never values):
- Restart instructions verified:
- Reinstall conditions verified:

Preserve existing internal 3DIT names where changing them would break API compatibility. Product branding is Majoto 3D.
