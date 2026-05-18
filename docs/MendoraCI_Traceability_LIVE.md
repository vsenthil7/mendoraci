# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 03:08 UK — CP-7b SCR-005 Approver page E2E green (114/114 Pw)
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested + E2E** ✅ | 86f63cd | 8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested + E2E** ✅ | ccf8ec3 | 8 vitest + 6 Pw × 3 = 18 |
| RT-003 | Root-Cause Analysis | **tested + E2E + REAL BOB** ✅ | cf369b1 | 8 vitest + 6 Pw × 3 = 18 |
| RT-004 | Repair Plan | **tested + E2E** ✅ | bc0cd93 | 8 vitest + 6 Pw × 3 = 18 |
| RT-005 | Approval Workflow | **tested + E2E** ✅ | _pending CP-7b_ | 11 vitest + 6 Pw × 3 = 18 |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019 RLS proven on 9 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-006..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 8 / 20 RT rows tested+E2E. Total: 16 mask + 43 vitest integration + 114 Playwright = 173/173 green.**

---

## 2. CP-7 + CP-7b — Approval Workflow (RT-005)

### State machine

Strict 3-transition state machine on `repair_plans.status`:
```
draft     -- submit  --> submitted
submitted -- approve --> approved   (terminal)
submitted -- reject  --> rejected   (terminal)
```
Every other transition returns **409 invalid_transition** with `{prior_status, attempted_action}` in the error envelope. All transitions run inside `withTenant()` tx so RLS guards reads + the INSERT into `approvals` + the UPDATE on `repair_plans.status` are atomic.

### CP-7 backend (commits 038abe2 + 5ce54ea, pushed)

| File | Purpose |
|---|---|
| `packages/shared/src/approval.ts` | `ApprovalStatusEnum` (4) + `ApprovalActionEnum` (3) + `StepDecisionV1` + `SubmitRequestV1` / `ApproveRequestV1` / `RejectRequestV1` + `ApprovalTransitionResponseV1` + `ApprovalLogV1` |
| `apps/api/src/db/migrations/1747900000000_rt005-approvals.cjs` | adds `repair_plans.status` (default `draft`, CHECK) + `current_approval_id` FK; DB-009 approvals with RLS FORCE |
| `apps/api/src/routes/approval.ts` | `performTransition()` state-machine helper (typed FastifyInstance + pg.PoolClient); 4 endpoints |
| `apps/api/test/integration/approval.test.ts` | 11 cases (TEST-015..019 + 5 NEG) |

### CP-7b SCR-005 web page + Playwright (_pending commit_)

| File | Purpose |
|---|---|
| `apps/web/src/app/repair-plan/[id]/approve/page.tsx` | SCR-005 approver page: current-status badge, approver/note/reason inputs, Submit/Approve/Reject buttons with state-machine-aware enable/disable, audit log list |
| `apps/web/src/app/intake/[id]/repair-plan/page.tsx` | Added "Approve this plan (SCR-005) →" link after plan generation |
| `tests/playwright/scr-005-approver.spec.ts` | 6 cases × 3 browsers (renders, submit, approve, reject, illegal transition 409, back-nav) |

### Test results

**Integration (43/43 @ 01:45):**
- 8 RT-001 intake
- 8 RT-002 repo-link (TEST-007 RLS)
- 8 RT-003 RCA (TEST-009 RLS)
- 8 RT-004 repair-plan (TEST-013 RLS)
- **11 RT-005 approval** (TEST-015 submit, TEST-016 approve, TEST-017 reject, TEST-018 invalid transition 409, TEST-018b double-approve 409, TEST-019 cross-tenant 404 RLS, 5 NEG)

**Playwright E2E (114/114 @ 03:08, 5.7 min):**
- 42 SCR-001 (14 × 3 browsers, incl 60s demo)
- 18 SCR-002 (6 × 3)
- 18 SCR-003 (6 × 3)
- 18 SCR-004 (6 × 3)
- 18 SCR-005 (6 × 3) — NEW

---

## 3. Docker stack — all green

| Service | Image | Status |
|---|---|---|
| postgres | postgres:16-alpine | ✅ healthy, role split active, 5 migrations applied |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets |
| api-migrate | mendoraci-api (node:22) | ✅ exited 0, 5 migrations |
| api | mendoraci-api (node:22 + bob CLI v1.0.3) | ✅ /health 200, all 5 route plugins live |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..005 all live |
| test | mendoraci-test (Playwright 1.60-jammy) | ✅ 114/114 green |

---

## 4. Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-7b_ | SCR-005 web page + 18 Pw cases + link-to-approver from SCR-004 |
| 5ce54ea | fix(rt-005): type performTransition properly (TS2347) |
| 038abe2 | CP-7 RT-005 Approval backend (state machine + DB-009 + 11 integration tests) |
| bc0cd93 | CP-6b SCR-004 web page + 18 Pw cases |
| 020a3b0 | CP-6 RT-004 Repair Plan backend |
| cf369b1 | CP-5b SCR-003 web page + 18 Pw cases |
| 67bccaa | RT-003 column fix body_masked |
| 04e6ffa | CP-5 RT-003 RCA backend |
| ccf8ec3 | CP-4c SCR-002 web page + 18 Pw cases |
| 226d947 | CP-4b RLS hardening role split |
| 8010a34 | CP-4 RT-002 Repo Linking backend |
| 86f63cd | RT-001 fully E2E |

---

## 5. Test Coverage Map (173 / 173)

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (TEST-007 RLS) | ✅ |
| api vitest integration RT-003 | 8 (TEST-009 RLS) | ✅ |
| api vitest integration RT-004 | 8 (TEST-013 RLS + TEST-014 412) | ✅ |
| api vitest integration RT-005 | 11 (TEST-015/016/017 + 018/018b 409 + TEST-019 RLS + 5 NEG) | ✅ |
| Playwright SCR-001 × 3 | 42 | ✅ |
| Playwright SCR-002 × 3 | 18 | ✅ |
| Playwright SCR-003 × 3 | 18 | ✅ |
| Playwright SCR-004 × 3 | 18 | ✅ |
| Playwright SCR-005 × 3 | 18 | ✅ |
| **Total** | **173** | **✅** |

---

## 6. Next-task queue

1. **CP-8** RT-006 Evidence Export (S3 / MinIO writes + ZIP bundle download)
2. **CP-9** RT-007 Analytics (rollup queries + dashboard tiles)
3. **CP-10** RT-014 Roles + RT-011 Audit
4. **CP-11** RT-009 PromptOps + RT-012 Eval gate
5. **CP-12** RT-016 Cost + RT-019 Residency
6. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression
7. **CP-14** RT-018 QBR
