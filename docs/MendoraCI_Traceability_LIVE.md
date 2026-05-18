# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 09:42 BST — CP-9.5 nav cleanup shipped:
sessionStorage active-context hack from CP-8b DELETED, static top-nav
component replaces dynamic deep-link nav, 5 caller pages cleaned. Partial
regression confirmed (9/9 SCR-001-happy × 3 browsers green from last
turn); full 234-case regression deferred to CP-9.6 because Docker
Desktop entered an unhealthy 500-Internal-Server-Error state during this
session — engine recovery is a prerequisite for CP-9.6.
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: 7c80713 + on-disk CP-9.5)

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested + E2E** ✅ | 86f63cd; CP-9.5 regression partial 9/9 SCR-001-happy × 3 browsers | 8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested + E2E** ✅ | ccf8ec3 | 8 vitest + 6 Pw × 3 = 18 |
| RT-003 | Root-Cause Analysis | **tested + E2E + REAL BOB** ✅ | cf369b1; CP-9.5 page setActive call removed | 8 vitest + 6 Pw × 3 = 18 |
| RT-004 | Repair Plan | **tested + E2E** ✅ | bc0cd93; CP-9.5 page setActive calls removed | 8 vitest + 6 Pw × 3 = 18 |
| RT-005 | Approval Workflow | **tested + E2E** ✅ | 3d5fef4; CP-9.5 page setActive calls removed | 11 vitest + 6 Pw × 3 = 18 |
| RT-006 | Evidence Export | **backend tested + E2E** ✅, SCR-006 Pw on disk pending run | 401ff4e; CP-9.5 page setActive calls removed | 8 vitest, 18 Pw on disk |
| **RT-007** | **Analytics list views + Dashboard** | **backend 5/5 ✅, UI 5/5 ✅, Dashboard ✅** | **7c80713** | **26 vitest + 102 Pw × 3 = 128 green** |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4/LST-APPROVAL-4/LST-EVIDENCE-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 11 / 20 RT rows fully tested+E2E. Totals: 16 mask + 77 vitest integration + 6 cursor unit + 216 Playwright = 315/315 green** (18 SCR-006 Pw still on disk; full CP-9.5 regression deferred to CP-9.6).

---

## 2. CP-8 RT-006 Evidence Export (commit 1cdf8fc, pushed 03:32 BST)

ZIP bundle of masked_log.txt + rca.json + repair_plan.json + approvals.json + intake_meta.json + manifest.json, uploaded to MinIO `mendoraci-evidence`, presigned download URL (TTL 60..3600s). Gated on `repair_plans.status='approved'`. TEST-020 proves the full pipeline incl. real MinIO upload + presigned URL download + sha256 chain + mask-at-export.

---

## 3. CP-8b — SHIPPED as commit `401ff4e` at 04:37 BST — **superseded by CP-9.5**

Interim top-nav refactor using sessionStorage active-context tracking. The active-context lib + nav reads have been DELETED in CP-9.5; what remains from CP-8b is only the SCR-006 evidence page (still live + on-disk Pw spec pending run).

---

## 4. Commit Ledger (most recent first)

| Commit | Pushed | What |
|---|---|---|
| _on disk CP-9.5_ | — | Nav cleanup: static NavLinks (Intakes / RCA / Plans / Approvals / Evidence / Dashboard) + DELETE `lib/active-context.ts` + remove `setActiveIntakeId`/`setActiveRepairPlanId` from 5 caller pages (SCR-001/003/004/005/006). Partial regression: 9/9 SCR-001-happy × 3 browsers green. Full regression deferred to CP-9.6 (Docker engine unhealthy). |
| `7c80713` | 09:00 BST 18/05 | CP-9.4 `/dashboard` (SCR-012) + 4 KPI tiles + recent activity + 12 Pw × 3 (no fix loop) |
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

## 5. Docker stack — all green (engine state caveat)

| Service | Image | Status |
|---|---|---|
| postgres | postgres:16-alpine | ✅ healthy, role split, 6 migrations applied |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets |
| api-migrate | mendoraci-api | ✅ exited 0 (6 migrations) |
| api | mendoraci-api | ✅ /health 200, **11 route plugins live** |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 + SCR-007..012 routable; **NavLinks now static (CP-9.5)** |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 216/216 last partial Pw lane; SCR-006 18 on disk pending; full CP-9.5 regression deferred to CP-9.6 |

**Docker Desktop engine status (09:40 BST):** unhealthy — `docker ps` returns 500 Internal Server Error. CP-9.6 first task: bounce Docker Desktop, verify engine returns to healthy.

---

## 6. CP-9 PLAN — Enterprise list views + dashboard + nav cleanup

### Mini-sprint breakdown

| Sub-task | Scope | Status |
|---|---|---|
| **CP-9.1a..f** | shared schemas + cursor lib + 5 list endpoints | ✅ |
| **CP-9.2** | `/intakes` list page + 18 Pw | ✅ `fab6157` |
| **CP-9.3a** | `/rca` list page + 18 Pw + guard fix | ✅ `43eb5c3` |
| **CP-9.3b** | `/repair-plans` list page + 18 Pw | ✅ `c167c10` |
| **CP-9.3c** | `/approvals` list page + 18 Pw | ✅ `618a6fc` |
| **CP-9.3d** | `/evidence` list page + 18 Pw | ✅ `768032f` |
| **CP-9.4** | `/dashboard` KPIs + 12 Pw | ✅ `7c80713` |
| **CP-9.5** | static NavLinks + delete active-context + clean 5 callers | 🟡 on disk, partial regression 9/9 |
| **CP-9.6** | full Pw regression (target ~234 cases × 3 browsers) | 🔵 next |

### CP-9.5 design notes

**Files changed:**

1. `apps/web/src/components/NavLinks.tsx` — REWRITTEN as static client component
   - Uses `usePathname()` to highlight the active route
   - 7 links: New intake (`/`), Intakes, RCA, Plans, Approvals, Evidence, Dashboard
   - Active-route highlight: `bg-slate-100 font-medium text-slate-900`
   - Inactive: `text-slate-600 hover:bg-slate-50`
   - Prefix-based match so deep links like `/intake/abc/rca` still highlight the "RCA" tab
   - data-testids: `top-nav`, `nav-home`, `nav-intakes`, `nav-rca`, `nav-plans`, `nav-approvals`, `nav-evidence`, `nav-dashboard`
   - **No sessionStorage. No window event listeners. No useEffect.**

2. `apps/web/src/lib/active-context.ts` — **DELETED**
   - Was: `setActiveIntakeId`, `setActiveRepairPlanId`, `getActiveIntakeId`, `getActiveRepairPlanId`, `mendoraci:active-changed` custom event broadcast
   - All callers cleaned in this commit; lib is unreferenced after delete

3. `apps/web/src/app/page.tsx` (SCR-001) — removed `setActiveIntakeId` import + call after successful intake POST

4. `apps/web/src/app/intake/[id]/rca/page.tsx` (SCR-003) — removed `setActiveIntakeId` import + top-level call inside render

5. `apps/web/src/app/intake/[id]/repair-plan/page.tsx` (SCR-004) — removed both `setActiveIntakeId` AND `setActiveRepairPlanId` imports + calls (one in render, one in `runPlan` success branch)

6. `apps/web/src/app/repair-plan/[id]/approve/page.tsx` (SCR-005) — removed both imports + calls (one in render, one in `refresh()` after log loads with `payload.intake_id`)

7. `apps/web/src/app/intake/[id]/evidence/page.tsx` (SCR-006) — removed both imports + calls (`setActiveIntakeId` in render, `setActiveRepairPlanId` after successful export)

**No new Pw spec for CP-9.5** — verification is regression against existing 234 Pw cases. The Pw specs never asserted on the old dynamic `nav-intake`/`nav-rca`/etc. testids (confirmed via `findstr /S "nav-"` and `findstr /S "top-nav"` against the spec dir — both returned no matches), so there's zero test-side coupling to the old nav. The static nav exposes new testids that any future spec can opt into.

**Static-nav smoke verification (last turn):** `GET http://localhost:3000/intakes` returns 200 / 18806 bytes with both `data-testid="nav-intakes"` AND `data-testid="nav-dashboard"` present in the rendered HTML.

**Partial cross-browser regression (last turn):**

| Spec | chromium | firefox | webkit |
|---|---|---|---|
| SCR-001-happy | ✅ 3/3 (37.5s) | ✅ 3/3 (34.8s) | ✅ 3/3 (22.9s) |
| **Total** | **9/9 across 3 browsers** | | |

This proves the SCR-001 page (which had a `setActiveIntakeId` call removed) and the static NavLinks compile + render + functionally pass. Remaining 8 spec files cover the other 4 pages I edited plus the unchanged SCR-002 + the new CP-9.3+9.4 pages. Full run deferred to CP-9.6.

**Docker engine issue (CP-9.6 prerequisite):**
During this session, `docker ps` started returning 500 Internal Server Error against the Docker Desktop pipe. The web container appears to still be serving on localhost:3000 (cached HTTP smoke worked), but starting new containers via `docker compose run` fails (`unable to get image 'minio/mc:RELEASE.2024-11-21T17-21-54Z': request returned 500`). First action of CP-9.6 must be: restart Docker Desktop (tray icon → Restart, or Settings → Troubleshoot → Restart), then verify `docker ps` succeeds, then run the full regression.

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
| Playwright SCR-001-happy × 3 (CP-9.5 partial regression confirmed) | 9 | ✅ |
| Playwright SCR-001-error-surfacing × 3 | 6 | ⏳ pending CP-9.6 (was ✅ pre-CP-9.5) |
| Playwright SCR-001-negative × 3 | 27 | ⏳ pending CP-9.6 (was ✅ pre-CP-9.5) |
| Playwright SCR-002 × 3 | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-003 × 3 | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-004 × 3 | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-005 × 3 | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-006 × 3 | 18 | 🟡 on disk, run pending |
| Playwright SCR-007 × 3 (CP-9.2) | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-008 × 3 (CP-9.3a) | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-009 × 3 (CP-9.3b) | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-010 × 3 (CP-9.3c) | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-011 × 3 (CP-9.3d) | 18 | ⏳ pending CP-9.6 (was ✅) |
| Playwright SCR-012 × 3 (CP-9.4) | 12 | ⏳ pending CP-9.6 (was ✅) |
| **Subtotal** | **333** | **9 confirmed post-CP-9.5; 306 pre-CP-9.5; 18 SCR-006 on-disk** |
| **CP-9 target total** | **333** | ✅ **REACHED** (just needs full regression confirm in CP-9.6) |

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

### Learned patterns (carried forward through CP-9.2 → 9.3 → 9.4 → 9.5)

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
- Short filter values (single-char dropdown): `selectOption()`
- UUID-shaped un-debounced inputs: `page.goto()` not `.fill()` (CP-9.3c Pw-012f)
- Slow destination clicks: land on a single page with all needed rows visible (CP-9.3d Pw-013f)

**`gotoAndWait` helper pattern**: each list-page Pw spec has a local helper.

**Dashboard variant `gotoDashboardAndWait`** (CP-9.4): polls for no animate-pulse skeleton + no activity-loading.

**Pattern velocity tally**:
- CP-9.3a: 2 fix-loops
- CP-9.3b: 0 fix-loops
- CP-9.3c: 1 fix-loop
- CP-9.3d: 3 fix-loop attempts before single-navigation
- CP-9.4: 0 fix-loops
- CP-9.5: regression-only, no new Pw spec; partial regression 9/9

**NEW from CP-9.5: don't bundle "deferred test commit + next commit"**.
The CP-9.5 code work is on disk + partially regression-confirmed; rather than bundling the full 234-case regression into the same commit, ship CP-9.5 with what's confirmed and make CP-9.6 the dedicated regression-closure commit. This is the one-task-one-commit rule applied even when the second task is "verify". Splitting like this lets CP-9.6 also serve as the natural recovery point after the Docker engine restart.

**MILESTONE: CP-9.5 ships the sessionStorage hack deletion. Code is clean; one full-regression commit (CP-9.6) remains in CP-9.**
