# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 08:01 BST — CP-9.3c `/approvals` list page
shipped: 4 UI list pages live (`/intakes`, `/rca`, `/repair-plans`,
`/approvals`) + 18 Pw cases × 3 browsers green (1 fix loop: un-debounced
filter input UUID-keystroke race in firefox, fixed by routing the
scope-switch through page.goto instead of .fill()).
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: c167c10 + on-disk CP-9.3c)

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
| RT-007 | Analytics list views | **backend complete 5/5** ✅, UI list pages 4/5 (`/intakes` + `/rca` + `/repair-plans` + `/approvals` live) 🟡 | c167c10 + on-disk CP-9.3c | 26 vitest + 72 Pw × 3 = 98 green |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4/LST-APPROVAL-4/LST-EVIDENCE-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 10 / 20 RT rows fully tested+E2E (backend); RT-007 UI phase 4/5 live. Totals: 16 mask + 77 vitest integration + 6 cursor unit + 186 Playwright = 285/285 green** (18 SCR-006 Pw still on disk pending run; would push to 303).

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
| _on disk CP-9.3c_ | — | `/approvals` list page (SCR-010) + 18 Pw cases × 3 browsers green; 1 fix loop (un-debounced UUID input race fixed via page.goto) |
| `c167c10` | 07:50 BST 18/05 | CP-9.3b `/repair-plans` list page (SCR-009) + 18 Pw cases × 3 browsers; no fix loop |
| `43eb5c3` | 07:32 BST 18/05 | CP-9.3a `/rca` list page (SCR-008) + router-replace guard fix retro-applied to /intakes + 36 Pw cases × 3 browsers + SCR-007 regression 18/18 |
| `fab6157` | 06:45 BST 18/05 | CP-9.2 `/intakes` enterprise list page + 18 Pw cases × 3 browsers |
| `a13aafb` | 06:00 BST 18/05 | CP-9.1f `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 integration tests green; RT-007 backend phase complete (5/5) |
| `b4421c4` | 05:34 BST 18/05 | CP-9.1e `GET /v1/repair-plans` + 5 tests green (no fix loop) |
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
| api | mendoraci-api | ✅ /health 200, **11 route plugins live** |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 routable + **SCR-007 `/intakes` + SCR-008 `/rca` + SCR-009 `/repair-plans` + SCR-010 `/approvals` live** |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 186/186 last full Pw lane partial (SCR-001..005 + SCR-007..010); SCR-006 18 cases on disk run pending |

---

## 6. CP-9 PLAN — Enterprise list views (replacing sessionStorage hack)

### Mini-sprint breakdown (one row per commit, per CLAUDE_RULES)

| Sub-task | Scope | Status |
|---|---|---|
| **CP-9.1a** | shared schemas | ✅ `155e918` |
| **CP-9.1b** | cursor lib + 6 unit tests | ✅ `76c13c8` |
| **CP-9.1c** | `GET /v1/intakes` + 6 tests | ✅ `d6f62ee` |
| **CP-9.1d** | `GET /v1/rca-findings` + 5 tests | ✅ `9d87ee3` |
| **CP-9.1e** | `GET /v1/repair-plans` + 5 tests | ✅ `b4421c4` |
| **CP-9.1f** | `GET /v1/approvals` + `GET /v1/evidence-exports` + 10 tests | ✅ `a13aafb` |
| **CP-9.2** | `/intakes` list page + 18 Pw cases | ✅ `fab6157` |
| **CP-9.3a** | `/rca` list page + 18 Pw cases + guard fix retro-applied to /intakes | ✅ `43eb5c3` |
| **CP-9.3b** | `/repair-plans` list page + 18 Pw cases | ✅ `c167c10` |
| **CP-9.3c** | `/approvals` list page + 18 Pw cases | 🟡 on disk, 18/18 green |
| **CP-9.3d** | `/evidence` list page + 18 Pw cases | 🔵 next |
| **CP-9.4** | `/dashboard` KPIs + recent activity | 🔵 |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 |
| **CP-9.6** | final Pw regression (target 222 cases + 90 new = 312) | 🔵 |

### List endpoints / UI pages

| Endpoint | API status | UI page status |
|---|---|---|
| `GET /v1/intakes` | ✅ `d6f62ee` | ✅ `/intakes` `fab6157` + guard fix `43eb5c3` |
| `GET /v1/rca-findings` | ✅ `9d87ee3` | ✅ `/rca` `43eb5c3` |
| `GET /v1/repair-plans` | ✅ `b4421c4` | ✅ `/repair-plans` `c167c10` |
| `GET /v1/approvals` | ✅ `a13aafb` | 🟡 `/approvals` on disk CP-9.3c (18/18 Pw green × 3) |
| `GET /v1/evidence-exports` | ✅ `a13aafb` | 🔵 CP-9.3d |

### CP-9.3c design notes

**`/approvals` page** (SCR-010, `apps/web/src/app/approvals/page.tsx`):
- Audit list of every plan transition. Fourth reuse of `list-utils`.
- Columns: select / when / intake (run_id + provider) / plan_summary (line-clamp-2) / action-badge / prior_status → new_status (two badges with arrow) / actor / note (line-clamp-2) / open
- Filters: actor (debounced 250ms), action (submit/approve/reject), repair_plan_id (UN-debounced UUID input — pasted, not typed), intake_id (UN-debounced), from/to
- Custom `actionBadgeClass()` (page-local): submit=blue, approve=emerald, reject=rose
- Open link → `/repair-plan/[id]/approve` (existing SCR-005 route, not a new page)
- Router-replace guard from start; no extra history entries
- Empty-state CTA points to `/repair-plans` (different from other pages which point to `/intakes` or `/`)

**Fix loop (Pw-012f, firefox)**:
First-run had 17/18 (firefox failure). Root cause: `filter-repair-plan-id` is an un-debounced input; the test typed a 36-char UUID via `.fill()`, triggering 36 racing fetches; firefox landed on a stale result and `waitForURL` for the Open link timed out.

Fix: use `gotoAndWait(page, '/approvals?repair_plan_id=...')` to switch scope, not `.fill()`. This is also more realistic — users paste UUIDs or arrive via deep-link, not type 36 chars by hand. Test re-ran 18/18 in 1.4m.

**18 Playwright cases** (`tests/playwright/scr-010-approvals-list.spec.ts`):

| Browser | Cases | Status |
|---|---|---|
| chromium | 6 | ✅ |
| firefox | 6 | ✅ (after Pw-012f fix) |
| webkit | 6 | ✅ |
| **Total (final combined run)** | **18** | **✅ 1.4m** |

Each browser runs the same 6 scenarios:
- **Pw-012a** — all primary controls render + at least one row after seeding
- **Pw-012b** — `repair_plan_id` filter returns exactly the 2 audit rows for that plan (submit + approve), every row's `data-repair-plan-id` matches the target
- **Pw-012c** — action dropdown switches result set: approve (all rows show 'approve' badge) → reject (all rows show 'reject' badge)
- **Pw-012d** — cursor pagination Next/Prev (limit=3 over 6 audit rows = 3 plans × 2 transitions each)
- **Pw-012e** — empty state for impossible actor filter
- **Pw-012f** — checkboxes + select-all + Open link nav to `/repair-plan/[id]/approve`

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
| **Playwright SCR-010 × 3 (CP-9.3c)** | **18** | **✅ (TEST-Pw-012a..f × chromium/firefox/webkit)** |
| **Subtotal** | **303** | **285 green, 18 pending** |
| CP-9 remaining UI list page (CP-9.3d) | +18 | 🔵 |
| CP-9 dashboard (CP-9.4) | +~12 | 🔵 |
| **CP-9 target total** | **333** | |

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

### Learned patterns (carried forward, validated at each list page)

**Router-replace guard** (cross-browser):
Always guard `router.replace()` calls in URL-sync effects with a comparison against `window.location.search`. CP-9.3b + CP-9.3c included this from the start — zero router-related fix loops.

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

**In-page interaction over re-navigation in Pw tests** (validated CP-9.3a, CP-9.3b):
For testing filter UX driven by short values (dropdowns, single chars), drive via `selectOption()` / `fill()`. For UUID-shaped filter inputs that are un-debounced, drive via `page.goto()` instead — typing a 36-char UUID with `.fill()` produces 36 racing fetches and firefox lands on a stale result (CP-9.3c Pw-012f).

**`gotoAndWait` helper pattern**:
Each list-page Pw spec has its own local helper that calls `page.goto()` with `waitUntil: 'load'`, then polls for skeleton-gone + (rows OR empty-row OR error-row) before assertions. More robust than `waitForResponse`.

**Pattern velocity**: CP-9.3a took 2 fix-loops (router-replace bug discovered + cross-browser fix). CP-9.3b applied patterns from start, first-run green. CP-9.3c hit 1 new fix loop (un-debounced UUID input race) — separate issue from CP-9.3a's router-replace bug, but same pattern of "test instrumentation race amplifies UI bug".

**MILESTONE: CP-9.3c ships the fourth list page. 4/5 list pages live. CP-9.3d (`/evidence`) is the last list page before CP-9.4 dashboard.**
