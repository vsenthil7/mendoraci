# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 04:47 BST — CP-9.1b cursor helper shipped (155e918
was CP-9.1a; this commit will be the second of the CP-9.1 sequence).
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: 155e918 + on-disk CP-9.1b)

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
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 9 / 20 RT rows tested+E2E (backend). Total: 16 mask + 51 vitest integration + 6 cursor unit + 114 Playwright = 187/187 green** (Pw SCR-006 18 cases on disk; will push Pw to 132 / 205 once next full run completes).

---

## 2. CP-8 RT-006 Evidence Export (commit 1cdf8fc, pushed 03:32 BST)

### What it does
ZIP bundle of masked_log.txt + rca.json + repair_plan.json + approvals.json + intake_meta.json + manifest.json, uploaded to MinIO `mendoraci-evidence` at `<tenant_id>/<intake_id>/<evidence_export_id>.zip`, returns a presigned download URL (configurable TTL 60..3600s, default 300). Gated on `repair_plans.status='approved'`.

### Files
| File | Purpose |
|---|---|
| `packages/shared/src/evidence.ts` | `EvidenceExportRequestV1` (ttl 60..3600), `EvidenceExportResponseV1`, `EvidenceExportDetailV1` (response + manifest with per-file sha256 + byte_size) |
| `apps/api/src/db/migrations/1748000000000_rt006-evidence.cjs` | DB-010 evidence_exports + RLS FORCE (8th tenant-scoped table) |
| `apps/api/src/lib/s3.ts` | AWS SDK v3 client → MinIO via `forcePathStyle`, `putObjectBytes()`, `getPresignedGetUrl()`, `isBucketReachable()` |
| `apps/api/src/routes/evidence-export.ts` | POST + GET `/v1/intake/:id/evidence-export` |
| `apps/api/test/integration/evidence-export.test.ts` | 8 cases (TEST-020..023 + 4 NEG) |
| `apps/api/package.json` | Added `@aws-sdk/client-s3@^3.658.0`, `@aws-sdk/s3-request-presigner@^3.658.0`, `jszip@^3.10.1` |

### TEST-020 proves end-to-end
- 6-file ZIP built in memory (DEFLATE level 6)
- sha256 stored in DB + returned in envelope
- Real MinIO upload (`pending` placeholder s3_key → real path after success)
- Failure rollback: if MinIO upload fails, the DB row is DELETEd to avoid orphaned metadata, returns 503 s3_unavailable
- Presigned URL **actually fetched in the test** with `fetch()` → downloaded bytes match `byte_size` → sha256 of download matches stored sha256 → ZIP unzipped → manifest.intake_id verified → masked_log.txt confirmed NOT to contain raw `AKIAIOSFODNN7EXAMPLE` (mask policy holds at export layer too)

### Error map
| Status | Code | Trigger |
|---|---|---|
| 400 | `invalid_intake_id` | path not UUID |
| 400 | `invalid_ttl` | GET ?ttl outside 60..3600 |
| 401 | `unauthorized` | missing X-Tenant-Id |
| 404 | `intake_not_found` | intake missing or wrong tenant (RLS) |
| 404 | `evidence_not_found` | GET before any export |
| 412 | `rca_required` | no RCA finding yet |
| 412 | `plan_required` | no repair plan yet |
| 412 | `plan_not_approved` | plan in `draft`/`submitted`/`rejected` (with `current_status` in envelope) |
| 422 | `validation_failed` | ttl out of range on POST body |
| 503 | `s3_unavailable` | MinIO down (row rolled back) |

---

## 3. CP-8b — SHIPPED as commit `401ff4e` at 04:37 BST

Interim top-nav refactor + SCR-006 evidence page + 18 Playwright cases on disk. **The sessionStorage-based nav is explicitly INTERIM and will be deleted in CP-9.5** in favour of list-pages-as-top-nav. See §6 for the CP-9 plan.

Shipped files:
- `apps/web/src/app/intake/[id]/evidence/page.tsx` — SCR-006 page
- `apps/web/src/components/NavLinks.tsx` — interim sessionStorage-driven nav (TO BE DELETED in CP-9.5)
- `apps/web/src/lib/active-context.ts` — interim helper (TO BE DELETED in CP-9.5)
- `apps/web/src/app/layout.tsx` — wires NavLinks into header
- 5 SCR pages updated with stamping calls + cross-page links
- `tests/playwright/scr-006-evidence.spec.ts` — 6 cases × 3 browsers (run pending)

---

## 4. Commit Ledger (most recent first)

| Commit | Pushed | What |
|---|---|---|
| _on disk CP-9.1b_ | — | `apps/api/src/lib/cursor.ts` + 6 vitest unit tests (TEST-CUR-1..6) green |
| `155e918` | 04:42 BST 18/05 | CP-9.1a shared pagination contract + IntakesListQuery / IntakeListRow schemas (tsc clean) |
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
| postgres | postgres:16-alpine | ✅ healthy, role split (admin DDL / app NOSUPERUSER for runtime), 6 migrations applied |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets (`mendoraci-evidence`, `mendoraci-goldsets`) |
| api-migrate | mendoraci-api (node:22-alpine + bob CLI v1.0.3) | ✅ exited 0 (6 migrations) |
| api | mendoraci-api (node:22-alpine + bob CLI v1.0.3) | ✅ /health 200, 6 route plugins live (intake, repo-link, rca, repair-plan, approval, evidence-export) |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 all routable |
| test | mendoraci-test (Playwright 1.60.0-jammy × chromium/firefox/webkit) | ✅ 114/114 last full run (CP-7b); SCR-006 18 cases on disk run pending |

---

## 6. CP-9 PLAN — Enterprise list views (replacing sessionStorage hack)

User-driven scope correction at 04:18 BST: **the product needs persistent enterprise-grade list views, not a hack that loses state when the user opens a new tab or refreshes after a week.**

### Mini-sprint breakdown (one row per commit, per CLAUDE_RULES)

| Sub-task | Scope | Status |
|---|---|---|
| **CP-9.1a** | shared `PaginationQueryV1` + `IntakesListQueryV1` + `IntakeListRowV1` schemas | ✅ `155e918` |
| **CP-9.1b** | `apps/api/src/lib/cursor.ts` encode/decode + 6 unit tests | 🟡 on disk, 6/6 green |
| **CP-9.1c** | `GET /v1/intakes` route + 6 integration tests | 🔵 next |
| **CP-9.1d** | `GET /v1/rca-findings` + 5 tests | 🔵 |
| **CP-9.1e** | `GET /v1/repair-plans` + 5 tests | 🔵 |
| **CP-9.1f** | `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 tests | 🔵 |
| **CP-9.2** | `/intakes` list page + 6 Pw cases × 3 browsers | 🔵 |
| **CP-9.3** | `/rca`, `/repair-plans`, `/approvals`, `/evidence` pages + 24 Pw | 🔵 |
| **CP-9.4** | `/dashboard` KPIs + recent activity | 🔵 |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 |
| **CP-9.6** | final Pw regression (target 222 cases + 90 new = 312) | 🔵 |

### List endpoints (CP-9.1)

| Endpoint | Returns | Filters |
|---|---|---|
| `GET /v1/intakes?limit=&cursor=&has_rca=&has_plan=&plan_status=&has_export=&provider=&q=&from=&to=` | paginated `intake_meta` list + per-row roll-ups (has_rca, has_plan, plan_status, has_export) | status, provider, free-text search on run_id/branch/actor, time range |
| `GET /v1/rca-findings?limit=&cursor=&intake_id=&confidence=&from=&to=` | paginated RCA list with intake context | confidence, intake_id |
| `GET /v1/repair-plans?limit=&cursor=&intake_id=&status=&overall_risk=&from=&to=` | paginated plan list | status (state machine), overall_risk |
| `GET /v1/approvals?limit=&cursor=&repair_plan_id=&action=&actor=&from=&to=` | paginated approval audit log | action, actor, time range |
| `GET /v1/evidence-exports?limit=&cursor=&intake_id=&from=&to=` | paginated export list with sha256 + byte_size | time range |

### Top nav becomes (CP-9.5)
```
MendoraCI  |  Intakes · RCA · Plans · Approvals · Evidence · Dashboard
```
Each link → list page (always works, no sessionStorage). Detail pages keep deep-link semantics. The sessionStorage helper is **deleted**.

### List-page enterprise affordances (non-negotiable per user feedback)
- Sticky header table with sortable columns
- Server-side pagination (cursor + `limit` default 50, max 200)
- Filter bar (status, provider, time-range, text search) with URL-query persistence
- Row badges with consistent color tokens (status, risk, confidence)
- Empty state with a clear "Submit your first intake" CTA
- Loading skeleton (no flash of blank table)
- Error state with retry
- Selection checkboxes (groundwork for bulk approve/export in CP-10)

---

## 7. Test Coverage Map

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| **cursor unit (CP-9.1b)** | **6** | **✅ (TEST-CUR-1..6)** |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (TEST-007 RLS) | ✅ |
| api vitest integration RT-003 | 8 (TEST-009 RLS) | ✅ |
| api vitest integration RT-004 | 8 (TEST-013 RLS + TEST-014 412) | ✅ |
| api vitest integration RT-005 | 11 (TEST-015..018b + 019 RLS + 5 NEG) | ✅ |
| api vitest integration RT-006 | 8 (TEST-020 full pipeline + real MinIO + sha256 + mask-at-export + 022 RLS + 5 NEG) | ✅ |
| Playwright SCR-001 × 3 | 42 | ✅ |
| Playwright SCR-002 × 3 | 18 | ✅ |
| Playwright SCR-003 × 3 | 18 | ✅ |
| Playwright SCR-004 × 3 | 18 | ✅ |
| Playwright SCR-005 × 3 | 18 | ✅ |
| Playwright SCR-006 × 3 | 18 | 🟡 on disk, run pending |
| **Subtotal** | **205** | **187 green, 18 pending** |
| CP-9 new list-endpoint vitest (planned) | +~31 | 🔵 |
| CP-9 new list-page Pw (planned) | +90 (6 cases × 5 lists × 3 browsers) | 🔵 |
| **CP-9 target total** | **326** | |

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

Sessions to date that violated this rule and are now caught up:
- 5ce54ea (TS fix) — was not logged → now in §4
- 3d5fef4 (CP-7b) — was logged but stale → now reflects shipped state
- 1cdf8fc (CP-8 backend) — was not logged → now in §2 + §4
- 401ff4e (CP-8b) — logged here on the commit, not after
- 155e918 (CP-9.1a) — logged at commit time per the new cadence

Going forward: every `git commit` for this project is followed by an edit to this file in the same shell session. No exceptions.
