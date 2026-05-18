# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 05:31 BST — CP-9.1e `GET /v1/repair-plans` shipped:
5/5 green first run + 67/67 full integration regression green.
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: 9d87ee3 + on-disk CP-9.1e)

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested + E2E** ✅ | 86f63cd | 8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested + E2E** ✅ | ccf8ec3 | 8 vitest + 6 Pw × 3 = 18 |
| RT-003 | Root-Cause Analysis | **tested + E2E + REAL BOB** ✅ | cf369b1 | 8 vitest + 6 Pw × 3 = 18 |
| RT-004 | Repair Plan | **tested + E2E** ✅ | bc0cd93 | 8 vitest + 6 Pw × 3 = 18 |
| RT-005 | Approval Workflow | **tested + E2E** ✅ | 3d5fef4 | 11 vitest + 6 Pw × 3 = 18 |
| RT-006 | Evidence Export | **backend tested + E2E** ✅, SCR-006 Pw on disk pending run | 401ff4e | 8 vitest, 18 Pw on disk |
| RT-007 | Analytics list views | **backend 3/5 endpoints live** 🟡 — Intakes+RCA+Plans shipped; Approvals/Evidence pending | 9d87ee3 + on-disk CP-9.1e | 16/16 vitest green |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 9 / 20 RT rows fully + RT-007 partial (3/5 endpoints). Totals: 16 mask + 67 vitest integration + 6 cursor unit + 114 Playwright = 203/203 green** (Pw SCR-006 18 cases on disk; will push Pw to 132 / 221 once next full run completes).

---

## 2. CP-8 RT-006 Evidence Export (commit 1cdf8fc, pushed 03:32 BST)

ZIP bundle of masked_log.txt + rca.json + repair_plan.json + approvals.json + intake_meta.json + manifest.json, uploaded to MinIO `mendoraci-evidence`, presigned download URL (TTL 60..3600s). Gated on `repair_plans.status='approved'`.

---

## 3. CP-8b — SHIPPED as commit `401ff4e` at 04:37 BST

Interim top-nav refactor (sessionStorage, **deleted in CP-9.5**) + SCR-006 evidence page + 18 Playwright cases on disk pending run.

---

## 4. Commit Ledger (most recent first)

| Commit | Pushed | What |
|---|---|---|
| _on disk CP-9.1e_ | — | `GET /v1/repair-plans` route + 5 integration tests green; 67/67 full integration regression green |
| `9d87ee3` | 05:25 BST 18/05 | CP-9.1d `GET /v1/rca-findings` + 5 tests green (jsonb_array_length fix loop) |
| `d6f62ee` | 05:13 BST 18/05 | CP-9.1c `GET /v1/intakes` + 6 integration tests + 57/57 regression |
| `76c13c8` | 04:49 BST 18/05 | CP-9.1b cursor encode/decode + 6 unit tests green |
| `155e918` | 04:42 BST 18/05 | CP-9.1a shared pagination contract + IntakesListQuery/IntakeListRow schemas |
| `401ff4e` | 04:37 BST 18/05 | CP-8b SCR-006 page + interim sessionStorage nav + Pw spec + LIVE doc catch-up |
| `1cdf8fc` | 03:32 BST 18/05 | CP-8 RT-006 Evidence Export backend + 8 integration tests |
| `3d5fef4` | 03:09 BST 18/05 | CP-7b SCR-005 approver page + 18 Pw cases |
| `5ce54ea` | 01:55 BST 18/05 | RT-005 TS fix (performTransition typing) |
| `038abe2` | 01:31 BST 18/05 | CP-7 RT-005 Approval backend + 11 integration tests |
| `bc0cd93` | 01:48 BST 18/05 | CP-6b SCR-004 Repair Plan UI + 18 Pw cases |
| `020a3b0` | 00:30 BST 18/05 | CP-6 RT-004 Repair Plan backend + 8 integration tests |
| `cf369b1` | 22:35 BST 17/05 | CP-5b SCR-003 RCA UI + 18 Pw cases |
| `67bccaa` | 21:11 BST 17/05 | RT-003 column fix body_masked |
| `04e6ffa` | 20:44 BST 17/05 | CP-5 RT-003 RCA backend + Bob client + 8 integration tests |
| `ccf8ec3` | 20:11 BST 17/05 | CP-4c SCR-002 Repo Linking UI + 18 Pw cases |
| `226d947` | 19:42 BST 17/05 | CP-4b RLS hardening (postgres role split) |
| `8010a34` | 18:21 BST 17/05 | CP-4 RT-002 Repo Linking backend |
| `86f63cd` | 16:50 BST 17/05 | RT-001 fully E2E (42 Pw × 3 browsers) |

---

## 5. Docker stack — all green

| Service | Image | Status |
|---|---|---|
| postgres | postgres:16-alpine | ✅ healthy, role split, 6 migrations applied |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets |
| api-migrate | mendoraci-api | ✅ exited 0 (6 migrations) |
| api | mendoraci-api | ✅ /health 200, 9 route plugins live (intake, repo-link, rca, repair-plan, approval, evidence-export, intakes-list, rca-list, repair-plans-list) |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 all routable |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 114/114 last full run; SCR-006 18 cases on disk run pending |

---

## 6. CP-9 PLAN — Enterprise list views (replacing sessionStorage hack)

### Mini-sprint breakdown (one row per commit, per CLAUDE_RULES)

| Sub-task | Scope | Status |
|---|---|---|
| **CP-9.1a** | shared `PaginationQueryV1` + `IntakesListQueryV1` + `IntakeListRowV1` schemas | ✅ `155e918` |
| **CP-9.1b** | `apps/api/src/lib/cursor.ts` encode/decode + 6 unit tests | ✅ `76c13c8` |
| **CP-9.1c** | `GET /v1/intakes` route + 6 integration tests | ✅ `d6f62ee` |
| **CP-9.1d** | `GET /v1/rca-findings` + 5 tests | ✅ `9d87ee3` |
| **CP-9.1e** | `GET /v1/repair-plans` + 5 tests | 🟡 on disk, 5/5 green |
| **CP-9.1f** | `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 tests | 🔵 next |
| **CP-9.2** | `/intakes` list page + 6 Pw cases × 3 browsers | 🔵 |
| **CP-9.3** | `/rca`, `/repair-plans`, `/approvals`, `/evidence` pages + 24 Pw | 🔵 |
| **CP-9.4** | `/dashboard` KPIs + recent activity | 🔵 |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 |
| **CP-9.6** | final Pw regression (target 222 cases + 90 new = 312) | 🔵 |

### List endpoints (CP-9.1)

| Endpoint | Status | Returns | Filters |
|---|---|---|---|
| `GET /v1/intakes?…` | ✅ `d6f62ee` | paginated intake_meta + roll-ups | has_rca/has_plan/has_export, plan_status, provider, q, from/to |
| `GET /v1/rca-findings?…` | ✅ `9d87ee3` | paginated RCA + intake context + counts | intake_id, confidence, provider, q on root_cause, from/to |
| `GET /v1/repair-plans?…` | 🟡 on disk | paginated plan + intake context + step_count + last_approval | intake_id, status, overall_risk, est_total_effort, provider, q on summary, from/to |
| `GET /v1/approvals?…` | 🔵 next | paginated approval audit log | action, actor, repair_plan_id, from/to |
| `GET /v1/evidence-exports?…` | 🔵 | paginated export list with sha256 + byte_size | intake_id, from/to |

### Top nav becomes (CP-9.5)
```
MendoraCI  |  Intakes · RCA · Plans · Approvals · Evidence · Dashboard
```
Each link → list page (always works, no sessionStorage). The sessionStorage helper is **deleted**.

---

## 7. Test Coverage Map

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| cursor unit (CP-9.1b) | 6 | ✅ (TEST-CUR-1..6) |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (TEST-007 RLS) | ✅ |
| api vitest integration RT-003 | 8 (TEST-009 RLS) | ✅ |
| api vitest integration RT-004 | 8 (TEST-013 RLS + TEST-014 412) | ✅ |
| api vitest integration RT-005 | 11 (TEST-015..018b + 019 RLS + 5 NEG) | ✅ |
| api vitest integration RT-006 | 8 (TEST-020 full pipeline + real MinIO + 022 RLS + 5 NEG) | ✅ |
| api vitest integration CP-9.1c intakes-list | 6 (TEST-LST-INTAKE-1..6) | ✅ |
| api vitest integration CP-9.1d rca-list | 5 (TEST-LST-RCA-1..5) | ✅ |
| **api vitest integration CP-9.1e repair-plans-list** | **5** | **✅ (TEST-LST-PLAN-1..5, LST-PLAN-4 cross-tenant RLS proof)** |
| Playwright SCR-001 × 3 | 42 | ✅ |
| Playwright SCR-002 × 3 | 18 | ✅ |
| Playwright SCR-003 × 3 | 18 | ✅ |
| Playwright SCR-004 × 3 | 18 | ✅ |
| Playwright SCR-005 × 3 | 18 | ✅ |
| Playwright SCR-006 × 3 | 18 | 🟡 on disk, run pending |
| **Subtotal** | **221** | **203 green, 18 pending** |
| CP-9 remaining list-endpoint vitest (CP-9.1f) | +~10 | 🔵 |
| CP-9 new list-page Pw (planned) | +90 (6 cases × 5 lists × 3 browsers) | 🔵 |
| **CP-9 target total** | **321** | |

---

## 8. Update cadence — going forward

Per CLAUDE_RULES: **this file MUST be updated immediately after every dev commit, before the next mini-sprint starts.** Mini-sprint cycle is strict:

```
Build (edit/new) -> git commit/push -> test -> green? next : fix -> commit/push -> test -> loop
```

After every commit:
1. Update §1 RT status if the commit changed RT readiness
2. Append to §4 commit ledger with timestamp
3. If shipping a deferred-test commit, mark §7 row with 🟡 and add follow-up to §6

Going forward: every `git commit` for this project is followed by an edit to this file in the same shell session. Adopted strictly from `155e918` onward. No idle pause between mini-sprints — proceed straight to the next sub-task without asking.
