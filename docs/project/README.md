# Majoto 3D — project hub

Start here at every work session. GitHub issues track individual tasks; this notebook preserves context.

## Current work

| Status | Task |
| --- | --- |
| Needs testing | [#1 — Majoto branding](https://github.com/lrsdownunder/image-to-3d-studio/issues/1) |
| Needs testing | [#2 — Published viewer versus preview](https://github.com/lrsdownunder/image-to-3d-studio/issues/2) |
| Next | [#3 — Controlled Meshy comparison](https://github.com/lrsdownunder/image-to-3d-studio/issues/3) |
| Next | [#4 — Download and print validation](https://github.com/lrsdownunder/image-to-3d-studio/issues/4) |
| Next | [#5 — Reconcile setup documentation](https://github.com/lrsdownunder/image-to-3d-studio/issues/5) |

Use the issue links below if your Markdown viewer does not resolve repository-relative issue links:
https://github.com/lrsdownunder/image-to-3d-studio/issues

[Open the private Majoto 3D board](https://github.com/users/lrsdownunder/projects/2/views/1).

The table above is the initial snapshot on 29 October 2026 (Australia/Perth). Use the board Status field as the current source of truth. Update issue notes and this snapshot when useful; they do not automatically mirror board movements.

## Workflow

Ideas → Next → In progress → Needs testing → Done.

- Ideas: possible work, not committed.
- Next: understood and ready to start.
- In progress: actively being worked on; aim for one task at a time.
- Needs testing: implementation exists but acceptance checks remain.
- Done: criteria passed and evidence recorded; close the issue.
- If blocked, record the blocker and next action in the issue. Do not call it done.

Before starting, read the relevant issue, [current setup](setup.md) and latest [handover](handover.md).
After each session, update the issue status, add test evidence, and fill in the handover.
Record significant choices in [decisions](decisions.md). Keep [test results](tests.md) separate from assumptions.

## Rules for evidence

A code change or AI statement is not proof that a live flow works. Record commit/version, environment (preview/published/GPU), date, input, result and evidence. Historical success does not establish current server health.

Repository and issues are public. Keep credentials, private customer data and expiring signed file URLs out of these notes.

## End-of-session prompt

Summarise what changed, what was actually tested, what remains unverified, outstanding errors and the next action. Separate confirmed results from assumptions. Update the relevant issue and docs/project/handover.md; link the commit and test evidence.
