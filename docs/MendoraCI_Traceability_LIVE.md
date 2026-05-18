# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 01:46 UK — CP-6b SCR-004 Repair Plan page E2E green (96/96 Pw)
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested + E2E** ✅ | 86f63cd | 8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested + E2E** ✅ | ccf8ec3 | 8 vitest + 6 Pw × 3 = 18 |
| RT-003 | Root-Cause Analysis | **tested + E2E + REAL BOB** ✅ | cf369b1 | 8 vitest + 6 Pw × 3 = 18 |
| RT-004 | Repair Plan | **tested + E2E** ✅ | _pending CP-6b_ | 8 vitest + 6 Pw × 3 = 18 |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013 RLS proven on 7 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-005..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 7 / 20 RT rows tested+E2E. Total: 16 mask + 32 vitest integration + 96 Playwright = 144/144 green.**

---

## 2. CP-6 + CP-6b — Repair Plan (RT-004)

### Bob CLI still the runtime — extended with plan-mode

bob.ts refactored to share `callRealBobGeneric<T>(opts, schema)` between RCA and Repair Plan so both go through one CLI invocation path. `runRepairPlan` defaults `chat_mode=plan`, RCA defaults `ask`. Same end-to-end with real Bob (verified 21:50 BST), same mock fallback for tests.

### CP-6 backend (commit 020a3b0, pushed)

| File | Purpose |
|---|---|
| `packages/shared/src/repair-plan.ts` | `RepairStepTypeEnum`, `RepairRiskEnum`, `RepairEffortEnum`, `RepairStepModelV1`, `RepairPlanModelOutputV1`, `RepairPlanRequest/Response/DetailV1` |
| `apps/api/src/db/migrations/1747800000000_rt004-repair-plan.cjs` | DB-007 repair_plans + DB-008 repair_steps + RLS FORCE |
| `apps/api/src/lib/bob.ts` | refactored: `callRealBobGeneric<T>()`, `runRepairPlan()`, `buildRepairPlanPrompt()`, `callMockBobRepairPlan()` (rotates AKIA**** first when secret detected) |
| `apps/api/src/routes/repair-plan.ts` | POST + GET `/v1/intake/:id/repair-plan`, 412 rca_required when RCA missing |
| `apps/api/test/integration/repair-plan.test.ts` | 8 cases (happy + cross-tenant + 412 + 5 NEG) |

### CP-6b SCR-004 web page + Playwright (_pending commit_)

| File | Purpose |
|---|---|
| `apps/web/src/app/intake/[id]/repair-plan/page.tsx` | SCR-004: chat-mode select, Run button, result panel: summary, overall_risk badge, total_effort badge, ordered step cards (title + description + type + files + risk badge + effort badge), rollback strategy |
| `apps/web/src/app/page.tsx` | Added "Repair plan (SCR-004) →" link after intake creation |
| `tests/playwright/scr-004-repair-plan.spec.ts` | 6 cases × 3 browsers (renders, happy structured, 412 rca_required surfaced, 404 surfaced, back-nav, API envelope) |

### Test results

**Integration (32/32 @ 00:33):**
- 8 RT-001 intake
- 8 RT-002 repo-link (TEST-007 cross-tenant)
- 8 RT-003 RCA (TEST-009 cross-tenant)
- **8 RT-004 Repair Plan (TEST-013 cross-tenant proves RLS for repair_plans/steps; TEST-014 412 rca_required)**

**Playwright E2E (96/96 @ 01:45, 5.5 min):**
- 42 SCR-001 (14 cases × 3 browsers, incl 60s demo)
- 18 SCR-002 (6 cases × 3)
- 18 SCR-003 (6 cases × 3)
- 18 SCR-004 (6 cases × 3) — NEW

---

## 3. Docker stack — all green

| Service | Image | Status |
|---|---|---|
| postgres | postgres:16-alpine | ✅ healthy, role split active |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets ready |
| api-migrate | mendoraci-api (node:22) | ✅ exited 0, 4 migrations applied |
| api | mendoraci-api (node:22 + bob CLI v1.0.3) | ✅ /health 200, runRca + runRepairPlan paths live |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..004 all live |
| test | mendoraci-test (Playwright 1.60-jammy) | ✅ 96/96 green |

---

## 4. Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-6b_ | SCR-004 web page + 18 Pw cases |
| 020a3b0 | CP-6 RT-004 Repair Plan schemas + migration + Bob plan-runner + API-005 + 8 integration tests |
| cf369b1 | CP-5b SCR-003 web page + 18 Pw cases |
| 67bccaa | RT-003 column fix body_masked |
| 04e6ffa | CP-5 RT-003 RCA backend |
| ccf8ec3 | CP-4c SCR-002 web page + 18 Pw cases |
| 226d947 | CP-4b RLS hardening role split |
| 8010a34 | CP-4 RT-002 Repo Linking backend |
| 12cf23a | untrack commit-msg scratch |
| 86f63cd | RT-001 fully E2E (42/42 Pw × 3) |
| _(earlier)_ | scaffold + mask + plumbing fix loops |

---

## 5. Test Coverage Map (144 / 144)

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (TEST-007 RLS proof) | ✅ |
| api vitest integration RT-003 | 8 (TEST-009 RLS proof) | ✅ |
| api vitest integration RT-004 | 8 (TEST-013 RLS proof + TEST-014 412) | ✅ |
| Playwright SCR-001 × 3 | 42 | ✅ |
| Playwright SCR-002 × 3 | 18 | ✅ |
| Playwright SCR-003 × 3 | 18 | ✅ |
| Playwright SCR-004 × 3 | 18 | ✅ |
| **Total** | **144** | **✅** |

---

## 6. Next-task queue

1. **CP-7** RT-005 Approval workflow (state machine: draft → submitted → approved/rejected; UI for approver/rejecter)
2. **CP-8** RT-006 Evidence Export (S3 / MinIO writes + ZIP bundle download)
3. **CP-9** RT-007 Analytics (rollup queries + dashboard tiles)
4. **CP-10** RT-014 Roles + RT-011 Audit
5. **CP-11** RT-009 PromptOps + RT-012 Eval gate
6. **CP-12** RT-016 Cost + RT-019 Residency
7. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression
8. **CP-14** RT-018 QBR
