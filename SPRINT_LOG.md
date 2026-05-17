# MendoraCI Sprint Log

Live progress tracker against `docs/MendoraCI_Traceability.md` (RT-001..RT-020).

Status: `not-started` → `code-written` → `tested-passing` → `pushed`.
A row only flips to `tested-passing` when ALL related TEST-NNN cases are green.
A row only flips to `pushed` after the commit lands on origin/main.

---

## Slice 1 — RT-001 CI Log Intake (cross-cuts RT-008 mask + RT-015 idempotency)

| Sub-task | Anchor | Status | Commit | Notes |
|---|---|---|---|---|
| Monorepo scaffold + Docker compose + GitHub remote | infra | **pushed** | 35149e8 | pnpm workspaces, Postgres+Redis+MinIO |
| 22 baseline + 11 enhancement source-of-truth docs | docs | **pushed** | 2bafe07, db3916e, 0def6a1 | dates stripped from filenames |
| Mask Policy v1.0.0 package | BR-008, RT-008, DB-013 | **pushed** | 35149e8 | deterministic regex + entropy + SHA-256 pin |
| TEST-023 red-team N=500 (0 leaks) | BR-008 | **tested-passing** | 35149e8 | green in docker node:20-alpine, 64ms |
| TEST-024 mask engine failure → BLOCK | BR-008 | **tested-passing** | 35149e8 | block, no fallback |
| Determinism + version pinning | BR-008 | **tested-passing** | 35149e8 | SHA-256 input/output identical across runs |
| Negative — no over-masking | BR-008 | **tested-passing** | 35149e8 | prose + stack traces + low-entropy strings |
| applyMaskOrThrow + MaskBlockedError | BR-008 | **tested-passing** | 35149e8 | code/reason/policyVersion/name fields |
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
| RT-001 | CI Log Intake | in-progress (mask cross-cut done; API/DB pending CP-2) |
| RT-002 | Repo Linking | not-started |
| RT-003 | RCA | not-started |
| RT-004 | Repair Plan | not-started |
| RT-005 | Approval Workflow | not-started |
| RT-006 | Evidence Export | not-started |
| RT-007 | Analytics | not-started |
| RT-008 | Secret Masking | **tested-passing + pushed** (TEST-023 0/500 leaks + TEST-024 fail-closed) |
| RT-009 | PromptOps Governance | not-started |
| RT-010 | Flaky Detection | not-started |
| RT-011 | Audit Schema | not-started |
| RT-012 | Eval Gate Enforcement | not-started |
| RT-013 | Multi-Tenant Isolation | not-started |
| RT-014 | Role/Permission Model | not-started |
| RT-015 | Idempotency & Replay | not-started (cross-cuts RT-001, pending CP-2) |
| RT-016 | Cost Ceiling Enforcement | not-started |
| RT-017 | Drift Detection | not-started |
| RT-018 | Customer Success / QBR | not-started |
| RT-019 | Data Residency Config | not-started |
| RT-020 | Replay/Regression Harness | not-started |

---

## Commit ledger

| Commit | CP | Slice | RT touched | Status before | Status after |
|---|---|---|---|---|---|
| 35149e8 | CP-0 | scaffold | infra + RT-001 + RT-008 + RT-015 (code) | not-started | code-written |
| 2bafe07 | CP-0b | docs | source-of-truth pack landed | code-written | code-written |
| db3916e | CP-0c-A | docs rename | 1130 set names cleaned | code-written | code-written |
| 0def6a1 | CP-0c-B | docs rename | 1208 set names cleaned | code-written | code-written |
| _pending CP-1_ | CP-1 | mask-policy verified | RT-008 | code-written | **tested-passing** |

---

## CP-1 test evidence (docker run, 2026-05-17 13:38)

```
docker run --rm -v ${PWD}:/repo -w /repo/packages/mask-policy node:20-alpine \
  sh -c 'corepack enable && corepack prepare pnpm@9.12.0 --activate && \
         pnpm install --no-frozen-lockfile && pnpm test'

 RUN  v2.1.9 /repo/packages/mask-policy
 ✓ test/mask.test.ts (16 tests) 64ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
 Duration   5.04s
 Coverage   99.35% stmts | 90% branches | 100% funcs | 99.35% lines
 Thresholds 95 / 85 / 100 / 95 — ALL PASS
```
