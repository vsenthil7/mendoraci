# MendoraCI Sprint Log

Live progress tracker against `docs/MendoraCI_Traceability_20260517_1130.md` (RT-001..RT-020).

Status: `not-started` → `code-written` → `tested-passing` → `pushed`.
A row only flips to `tested-passing` when ALL related TEST-NNN cases are green.
A row only flips to `pushed` after the commit lands on origin/main.

---

## Slice 1 — RT-001 CI Log Intake (cross-cuts RT-008 mask + RT-015 idempotency)

| Sub-task | Anchor | Status | Commit | Notes |
|---|---|---|---|---|
| Monorepo scaffold + Docker compose + GitHub remote | infra | code-written | _pending CP-0_ | pnpm workspaces, Postgres+Redis+MinIO |
| Mask Policy v1.0.0 package | BR-008, RT-008, DB-013 | code-written | _pending CP-1_ | deterministic regex + entropy + SHA-256 pin |
| TEST-023 red-team N=500 (0 leaks) | BR-008 | not-started | _pending CP-1_ | |
| TEST-024 mask engine failure → BLOCK | BR-008 | not-started | _pending CP-1_ | |
| API-001 POST /intake | BR-001, RT-001 | not-started | _pending CP-2_ | Idempotency-Key required |
| API-002 GET /intake/:id | BR-001, RT-001 | not-started | _pending CP-2_ | |
| DB-001 raw_intake migration | RT-001 | not-started | _pending CP-2_ | RLS |
| DB-002 intake_meta migration | RT-001 | not-started | _pending CP-2_ | |
| idempotency_keys table | RT-015 | not-started | _pending CP-2_ | dedupe 24h |
| TEST-001 happy path | BR-001 | not-started | _pending CP-2_ | p95 ≤ 5s |
| TEST-001-A idempotency replay | RT-015 | not-started | _pending CP-2_ | 0 duplicates |
| TEST-002 schema validation | BR-001 | not-started | _pending CP-2_ | 422 |
| TEST-003 unsigned webhook | BR-001 security | not-started | _pending CP-2_ | 401 |
| TEST-004 oversized payload | BR-001 | not-started | _pending CP-2_ | 413 |
| Playwright E2E SCR-001 drop-zone | BR-001 + UX | not-started | _pending CP-3_ | drag-drop, masked preview |

---

## Roll-up — one row per RT

| RT | Subject | Status |
|---|---|---|
| RT-001 | CI Log Intake | in-progress |
| RT-002 | Repo Linking | not-started |
| RT-003 | RCA | not-started |
| RT-004 | Repair Plan | not-started |
| RT-005 | Approval Workflow | not-started |
| RT-006 | Evidence Export | not-started |
| RT-007 | Analytics | not-started |
| RT-008 | Secret Masking | in-progress (cross-cuts RT-001) |
| RT-009 | PromptOps Governance | not-started |
| RT-010 | Flaky Detection | not-started |
| RT-011 | Audit Schema | not-started |
| RT-012 | Eval Gate Enforcement | not-started |
| RT-013 | Multi-Tenant Isolation | not-started |
| RT-014 | Role/Permission Model | not-started |
| RT-015 | Idempotency & Replay | in-progress (cross-cuts RT-001) |
| RT-016 | Cost Ceiling Enforcement | not-started |
| RT-017 | Drift Detection | not-started |
| RT-018 | Customer Success / QBR | not-started |
| RT-019 | Data Residency Config | not-started |
| RT-020 | Replay/Regression Harness | not-started |

---

## Commit ledger

| Commit | Slice | RT touched | Status before | Status after |
|---|---|---|---|---|
| _pending CP-0_ | CP-0 scaffold | infra | not-started | code-written |
