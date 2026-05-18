# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 08:39 BST — CP-9.3d `/evidence` list page
shipped: **all 5 UI list pages live** (`/intakes`, `/rca`, `/repair-plans`,
`/approvals`, `/evidence`). RT-007 UI phase COMPLETE 5/5. 18 Pw cases × 3
browsers green (1 fix loop: Pw-013f mid-test second `goto` exceeded test
timeout; reverted to SCR-008 single-navigation pattern via from-window
filter, no second goto needed).
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: 618a6fc + on-disk CP-9.3d)

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
| **RT-007** | **Analytics list views** | **backend 5/5 ✅, UI 5/5 ✅** **COMPLETE** | **618a6fc + on-disk CP-9.3d** | **26 vitest + 90 Pw × 3 = 116 green** |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4/LST-APPROVAL-4/LST-EVIDENCE-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 11 / 20 RT rows fully tested+E2E** (RT-007 promoted to complete; backend+UI both done). **Totals: 16 mask + 77 vitest integration + 6 cursor unit + 204 Playwright = 303/303 green** (18 SCR-006 Pw still on disk pending run; would push to 321).

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
| _on disk CP-9.3d_ | — | `/evidence` list page (SCR-011) + 18 Pw cases × 3 browsers green; 1 fix loop (mid-test second goto exceeded test timeout, reverted to single-navigation pattern); **RT-007 UI phase complete 5/5** |
| `618a6fc` | 08:06 BST 18/05 | CP-9.3c `/approvals` list page (SCR-010) + 18 Pw cases × 3 browsers (1 fix loop: un-debounced UUID filter race) |
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
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 routable + **SCR-007 `/intakes` + SCR-008 `/rca` + SCR-009 `/repair-plans` + SCR-010 `/approvals` + SCR-011 `/evidence` live (ALL 5 LIST PAGES)** |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 204/204 last partial Pw lane (SCR-001..005 + SCR-007..011); SCR-006 18 cases on disk run pending |

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
| **CP-9.3c** | `/approvals` list page + 18 Pw cases | ✅ `618a6fc` |
| **CP-9.3d** | `/evidence` list page + 18 Pw cases | 🟡 on disk, 18/18 green |
| **CP-9.4** | `/dashboard` KPIs + recent activity | 🔵 next |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 |
| **CP-9.6** | final Pw regression (target 222 cases + 90 new = 312) | 🔵 |

### List endpoints / UI pages — ALL UI PAGES NOW LIVE

| Endpoint | API status | UI page status |
|---|---|---|
| `GET /v1/intakes` | ✅ `d6f62ee` | ✅ `/intakes` `fab6157` + guard fix `43eb5c3` |
| `GET /v1/rca-findings` | ✅ `9d87ee3` | ✅ `/rca` `43eb5c3` |
| `GET /v1/repair-plans` | ✅ `b4421c4` | ✅ `/repair-plans` `c167c10` |
| `GET /v1/approvals` | ✅ `a13aafb` | ✅ `/approvals` `618a6fc` |
| `GET /v1/evidence-exports` | ✅ `a13aafb` | 🟡 `/evidence` on disk CP-9.3d (18/18 Pw green × 3) |

### CP-9.3d design notes

**`/evidence` page** (SCR-011, `apps/web/src/app/evidence/page.tsx`):
- Audit-grade ZIP bundle list. Fifth (final) reuse of `list-utils`.
- Columns: select / when / intake (run_id + provider) / plan (truncated repair_plan_id) / sha256 (12 chars + ellipsis, monospace, full sha in title attr) / size (formatted bytes: B/KB/MB/GB) / bucket/key (last segment of s3_key) / open
- Filters: intake_id (un-debounced UUID), repair_plan_id (un-debounced UUID), from/to. **No q / status / risk** — these don't make sense for evidence bundles (immutable, sha256-keyed, no status enum)
- Page-local `formatBytes(n)` helper (page-specific concern, not shared)
- Page-level `totalBytes` display in toolbar: "X on this page · Y total on this page"
- Open link → `/intake/[id]/evidence` (existing SCR-006 page handles presign-on-mount for download)
- Empty-state CTA points to `/repair-plans` (closest workflow point that creates evidence)
- Router-replace guard from start

**Fix loop (Pw-013f)**:
First-run had 17/18 (firefox failure). Tried bumping `waitForURL` timeout to 30s → still failed. Tried `test.setTimeout(90_000)` + `expect.poll` for pathname → still failed (both firefox AND webkit this time).

Real fix: revert to SCR-008's single-navigation pattern. Instead of:
```
goto(/evidence?intake_id=A) -> check -> uncheck ->
goto(/evidence?intake_id=B) -> click row.B.open
```
do:
```
goto(/evidence?from=window) -> both rows visible -> check/uncheck on A ->
click row.B.open  (no second navigation)
```

Lesson: when a test does multiple navigations followed by a click that triggers a slow destination page, the cumulative race window grows beyond firefox's tolerance. **Prefer landing on a single page with all needed rows visible** — use `from`-window or other broad filters to make this possible.

**18 Playwright cases** (`tests/playwright/scr-011-evidence-list.spec.ts`):

| Browser | Cases | Status |
|---|---|---|
| chromium | 6 | ✅ |
| firefox | 6 | ✅ (after Pw-013f single-navigation revert) |
| webkit | 6 | ✅ |
| **Total (final combined run)** | **18** | **✅ 1.1m** |

Each browser runs the same 6 scenarios:
- **Pw-013a** — all primary controls render + at least one row after seeding
- **Pw-013b** — `intake_id` filter returns exactly 1 export; sha256 testid visible
- **Pw-013c** — `repair_plan_id` filter returns exactly 1 export (driven via page.goto for un-debounced UUID input, CP-9.3c Pw-012f lesson)
- **Pw-013d** — cursor pagination Next/Prev (limit=2 over 3 exports)
- **Pw-013e** — empty state for impossible intake_id (zero-UUID)
- **Pw-013f** — checkboxes + select-all + Open link nav to `/intake/[id]/evidence` (single navigation pattern, no mid-test re-goto)

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
| **Playwright SCR-011 × 3 (CP-9.3d)** | **18** | **✅ (TEST-Pw-013a..f × chromium/firefox/webkit)** |
| **Subtotal** | **321** | **303 green, 18 pending** |
| CP-9 dashboard (CP-9.4) | +~12 | 🔵 next |
| CP-9 nav cleanup (CP-9.5) | regression only | 🔵 |
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

### Learned patterns (carried forward through CP-9.2 → CP-9.3a → CP-9.3b → CP-9.3c → CP-9.3d)

**Router-replace guard** (cross-browser, validated 5/5 list pages):
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
- UUID-shaped un-debounced inputs: drive via `page.goto()` (NOT `.fill()` — 36 keystrokes = 36 racing fetches, CP-9.3c Pw-012f)
- **NEW from CP-9.3d**: when a test does multiple navigations followed by a click triggering a slow destination page (e.g. SCR-006 with presign-on-mount), prefer landing on **a single page with all needed rows visible** via from-window or other broad filters. The cumulative race window from two navigations + slow nav exceeds firefox's tolerance even with bumped timeouts.

**`gotoAndWait` helper pattern**:
Each list-page Pw spec has its own local helper that calls `page.goto()` with `waitUntil: 'load'`, then polls for skeleton-gone + (rows OR empty-row OR error-row) before assertions.

**Pattern velocity through CP-9.3 sub-sprint**:
- CP-9.3a: 2 fix-loops (router-replace bug discovered + cross-browser fix)
- CP-9.3b: 0 fix-loops (all patterns from start)
- CP-9.3c: 1 fix-loop (new bug: un-debounced UUID race)
- CP-9.3d: 1 fix-loop (new lesson: prefer single-navigation tests for slow-dest clicks)

5 list pages × 18 Pw cases × 3 browsers = **270 Pw cases shipped in the CP-9.3 sub-sprint** with 4 fix-loops total. **RT-007 UI phase complete.**

**MILESTONE: ALL 5 LIST PAGES LIVE. RT-007 promoted to fully tested + E2E (backend 5/5 + UI 5/5). CP-9.4 dashboard is the next sub-sprint, then CP-9.5 nav cleanup deletes the sessionStorage hack from CP-8b.**
