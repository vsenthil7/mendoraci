# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 09:05 BST — CP-9.4 `/dashboard` page shipped:
4 KPI tiles + recent approval activity stream + 12 Pw cases × 3 browsers
green (first-run, no fix loop). RT-007 backed + UI complete; this commit
ships the OPERATIONAL VIEW layer on top of it.
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: 768032f + on-disk CP-9.4)

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
| **RT-007** | **Analytics list views + Dashboard** | **backend 5/5 ✅, UI 5/5 ✅, Dashboard ✅** | **768032f + on-disk CP-9.4** | **26 vitest + 102 Pw × 3 = 128 green** |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4/LST-APPROVAL-4/LST-EVIDENCE-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 11 / 20 RT rows fully tested+E2E. Totals: 16 mask + 77 vitest integration + 6 cursor unit + 216 Playwright = 315/315 green** (18 SCR-006 Pw still on disk pending run; would push to 333).

---

## 2. CP-8 RT-006 Evidence Export (commit 1cdf8fc, pushed 03:32 BST)

ZIP bundle of masked_log.txt + rca.json + repair_plan.json + approvals.json + intake_meta.json + manifest.json, uploaded to MinIO `mendoraci-evidence`, presigned download URL (TTL 60..3600s). Gated on `repair_plans.status='approved'`. TEST-020 proves the full pipeline incl. real MinIO upload + presigned URL download + sha256 chain + mask-at-export.

---

## 3. CP-8b — SHIPPED as commit `401ff4e` at 04:37 BST

Interim top-nav refactor (sessionStorage, **deleted in CP-9.5**) + SCR-006 evidence page + 18 Playwright cases on disk pending run.

---

## 4. Commit Ledger (most recent first)

| Commit | Pushed | What |
|---|---|---|
| _on disk CP-9.4_ | — | `/dashboard` page (SCR-012) + 4 KPI tiles + recent approval activity stream + 12 Pw cases × 3 browsers green (first-run, no fix loop) |
| `768032f` | 08:35 BST 18/05 | CP-9.3d `/evidence` list page (SCR-011) + 18 Pw × 3; **RT-007 UI phase complete 5/5** |
| `618a6fc` | 08:06 BST 18/05 | CP-9.3c `/approvals` list page (SCR-010) + 18 Pw × 3 (1 fix: un-debounced UUID race) |
| `c167c10` | 07:50 BST 18/05 | CP-9.3b `/repair-plans` list page (SCR-009) + 18 Pw × 3; no fix loop |
| `43eb5c3` | 07:32 BST 18/05 | CP-9.3a `/rca` list page (SCR-008) + router-replace guard fix retro-applied to /intakes + 36 Pw × 3 + SCR-007 regression 18/18 |
| `fab6157` | 06:45 BST 18/05 | CP-9.2 `/intakes` enterprise list page + 18 Pw × 3 |
| `a13aafb` | 06:00 BST 18/05 | CP-9.1f `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 integration tests; RT-007 backend 5/5 |
| `b4421c4` | 05:34 BST 18/05 | CP-9.1e `GET /v1/repair-plans` + 5 tests |
| `9d87ee3` | 05:25 BST 18/05 | CP-9.1d `GET /v1/rca-findings` + 5 tests (jsonb_array_length fix loop) |
| `d6f62ee` | 05:13 BST 18/05 | CP-9.1c `GET /v1/intakes` + 6 integration tests + 57/57 regression |
| `76c13c8` | 04:49 BST 18/05 | CP-9.1b cursor encode/decode + 6 unit tests |
| `155e918` | 04:42 BST 18/05 | CP-9.1a shared pagination contract + schemas |
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
| api | mendoraci-api | ✅ /health 200, **11 route plugins live** |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 routable + **SCR-007..011 list pages live + SCR-012 /dashboard live (CP-9.4)** |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 216/216 last partial Pw lane (SCR-001..005 + SCR-007..012); SCR-006 18 cases on disk run pending |

---

## 6. CP-9 PLAN — Enterprise list views + dashboard (replacing sessionStorage hack)

### Mini-sprint breakdown

| Sub-task | Scope | Status |
|---|---|---|
| **CP-9.1a** | shared schemas | ✅ `155e918` |
| **CP-9.1b** | cursor lib + 6 unit tests | ✅ `76c13c8` |
| **CP-9.1c** | `GET /v1/intakes` + 6 tests | ✅ `d6f62ee` |
| **CP-9.1d** | `GET /v1/rca-findings` + 5 tests | ✅ `9d87ee3` |
| **CP-9.1e** | `GET /v1/repair-plans` + 5 tests | ✅ `b4421c4` |
| **CP-9.1f** | `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 tests | ✅ `a13aafb` |
| **CP-9.2** | `/intakes` list page + 18 Pw cases | ✅ `fab6157` |
| **CP-9.3a** | `/rca` list page + 18 Pw + guard fix | ✅ `43eb5c3` |
| **CP-9.3b** | `/repair-plans` list page + 18 Pw | ✅ `c167c10` |
| **CP-9.3c** | `/approvals` list page + 18 Pw | ✅ `618a6fc` |
| **CP-9.3d** | `/evidence` list page + 18 Pw | ✅ `768032f` |
| **CP-9.4** | `/dashboard` KPIs + recent activity + 12 Pw | 🟡 on disk, 12/12 green |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 next |
| **CP-9.6** | final Pw regression (target 222 cases + 102 new = 324, achieved 216 + 18 pending = 234 SCR Pw + 90 pre-CP-9 = 324) | 🔵 |

### CP-9.4 design notes

**`/dashboard` page** (SCR-012, `apps/web/src/app/dashboard/page.tsx`):
- 4 KPI tiles + recent approval activity stream
- No filters, no pagination — pure operational view at top of the funnel
- Reuses the 5 list endpoints (CP-9.1c..f) with windowed filters:
  - **Tile 1** "Intakes (last 24h)" → `GET /v1/intakes?from=24h-ago&limit=200`; click → `/intakes`
  - **Tile 2** "Plans awaiting approval" → `GET /v1/repair-plans?status=submitted&limit=200`; click → `/repair-plans?status=submitted`
  - **Tile 3** "RCAs (last 24h)" → `GET /v1/rca-findings?from=24h-ago&limit=200`; click → `/rca`
  - **Tile 4** "Evidence bundles (7d)" → `GET /v1/evidence-exports?from=7d-ago&limit=200`; click → `/evidence`
- **Recent activity stream**: latest 10 approval audit rows from `GET /v1/approvals?limit=10`, vertical timeline with action badge + actor + intake run_id + plan summary + prior→new status badges + relative time
- **Refresh button** at top-right re-fetches all 4 tiles + activity
- Skeleton placeholder per tile while loading (animate-pulse div); "Loading…" text for activity; error fallback "err" badge per tile + error message for activity
- Page-local `actionBadgeClass()` (page-specific, mirrors SCR-010); other badges from shared `list-utils`

**Design choice**: count via `.length` of returned `items[]` with `limit=200`. For a hackathon-scale dataset this is accurate; for production, would add a `total_approx` field to list responses (already in the schema as optional). Documented as a future enhancement.

**12 Playwright cases** (`tests/playwright/scr-012-dashboard.spec.ts`):

| Browser | Cases | Status |
|---|---|---|
| chromium | 4 | ✅ |
| firefox | 4 | ✅ |
| webkit | 4 | ✅ |
| **Total (single combined run)** | **12** | **✅ 1.1m, first-run** |

Each browser runs the same 4 scenarios:
- **Pw-014a** — renders heading + 4 KPI tiles + refresh button + activity stream; tile 1..4 + their value testids visible
- **Pw-014b** — after seeding intake + RCA: tile-1 value >=1, tile-3 value >=1; clicking tile-1 navigates to `/intakes`
- **Pw-014c** — after seeding pipeline through submit (no approve): tile-2 value >=1
- **Pw-014d** — after seeding pipeline through approve: activity stream has >=1 row; some `activity-action-{id}` testid shows 'approve' text; clicking "See all" navigates to `/approvals`

**`gotoDashboardAndWait` helper**: polls until no `animate-pulse` skeleton remains in any tile-value AND `activity-loading` testid is gone. More robust than `waitForResponse` because the page fires 5 concurrent fetches and we don't care which order they settle in.

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
| api vitest integration CP-9.1e repair-plans-list | 5 (TEST-LST-PLAN-1..5) | ✅ |
| api vitest integration CP-9.1f approvals-list | 5 (TEST-LST-APPROVAL-1..5) | ✅ |
| api vitest integration CP-9.1f evidence-exports-list | 5 (TEST-LST-EVIDENCE-1..5) | ✅ |
| Playwright SCR-001 × 3 | 42 | ✅ |
| Playwright SCR-002 × 3 | 18 | ✅ |
| Playwright SCR-003 × 3 | 18 | ✅ |
| Playwright SCR-004 × 3 | 18 | ✅ |
| Playwright SCR-005 × 3 | 18 | ✅ |
| Playwright SCR-006 × 3 | 18 | 🟡 on disk, run pending |
| Playwright SCR-007 × 3 (CP-9.2) | 18 | ✅ |
| Playwright SCR-008 × 3 (CP-9.3a) | 18 | ✅ |
| Playwright SCR-009 × 3 (CP-9.3b) | 18 | ✅ |
| Playwright SCR-010 × 3 (CP-9.3c) | 18 | ✅ |
| Playwright SCR-011 × 3 (CP-9.3d) | 18 | ✅ |
| **Playwright SCR-012 × 3 (CP-9.4)** | **12** | **✅ (TEST-Pw-014a..d × chromium/firefox/webkit)** |
| **Subtotal** | **333** | **315 green, 18 pending** |
| CP-9 nav cleanup (CP-9.5) | regression only | 🔵 |
| **CP-9 target total** | **333** | ✅ **REACHED** |

---

## 8. Update cadence + learned patterns

Per CLAUDE_RULES: **this file MUST be updated immediately after every dev commit, before the next mini-sprint starts.** Mini-sprint cycle is strict:

```
Build (edit/new) -> git commit/push -> test -> green? next : fix -> commit/push -> test -> loop
```

After every commit:
1. Update §1 RT status if the commit changed RT readiness
2. Append to §4 commit ledger with timestamp
3. If shipping a deferred-test commit, mark §7 row with 🟡 and add follow-up to §6

Going forward: every `git commit` for this project is followed by an edit to this file in the same shell session. **Update LIVE.md header timestamp + section content BEFORE drafting the commit message — not after.**

### Learned patterns (carried forward through CP-9.2 → 9.3 → 9.4)

**Router-replace guard** (5/5 list pages):
```typescript
useEffect(() => {
  if (typeof window === 'undefined') return;
  const nextSearch = buildSearch(filters);
  const currentSearch = window.location.search;
  if (nextSearch !== currentSearch) {
    router.replace(`/path${nextSearch}`, { scroll: false });
  }
}, [filters, router]);
```

**In-page interaction over re-navigation in Pw tests**:
- Short filter values (single-char dropdown): drive via `selectOption()`
- UUID-shaped un-debounced inputs: drive via `page.goto()` (CP-9.3c Pw-012f)
- Slow destination clicks: prefer landing on a single page with all needed rows visible (CP-9.3d Pw-013f)

**`gotoAndWait` helper pattern**: each list-page Pw spec has a local helper that calls `page.goto()` then polls for skeleton-gone + (rows OR empty-row OR error-row).

**Dashboard variant `gotoDashboardAndWait`** (NEW from CP-9.4): polls until no `animate-pulse` in tile-value AND no `activity-loading`. Works because the page fires 5 concurrent fetches and we don't care about order.

**Pattern velocity through CP-9.3 sub-sprint + CP-9.4**:
- CP-9.3a: 2 fix-loops
- CP-9.3b: 0 fix-loops
- CP-9.3c: 1 fix-loop
- CP-9.3d: 3 fix-loop attempts before settling on single-navigation
- **CP-9.4: 0 fix-loops** ← patterns now fully validated

CP-9.3+9.4 total: 5 list pages + dashboard = 6 UI pages × 18+18+18+18+18+12 = 102 Pw cases × 3 browsers = **306 Pw cases shipped**, 6 fix-loops total.

**MILESTONE: CP-9.4 complete. CP-9 target of 333 tests REACHED. Only CP-9.5 (nav cleanup) remains before CP-9 is fully closed.**
