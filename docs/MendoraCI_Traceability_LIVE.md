# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-18 07:24 BST — CP-9.3a `/rca` list page shipped:
2 UI list pages live (`/intakes`, `/rca`) + cross-browser router-replace
guard fix retro-applied to /intakes + 36 Pw cases green across 3 browsers
(no regression on SCR-007).
**Repo:** https://github.com/vsenthil7/mendoraci (HEAD: fab6157 + on-disk CP-9.3a)

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
| RT-007 | Analytics list views | **backend complete 5/5** ✅, UI list pages 2/5 (`/intakes` + `/rca` live) 🟡 | fab6157 + on-disk CP-9.3a | 26 vitest + 36 Pw × 3 = 62 green |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | TEST-007/009/013/019/022/LST-INTAKE-4/LST-RCA-4/LST-PLAN-4/LST-APPROVAL-4/LST-EVIDENCE-4 RLS proven on 10 tables |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 10 / 20 RT rows fully tested+E2E (backend); RT-007 UI phase 2/5 live. Totals: 16 mask + 77 vitest integration + 6 cursor unit + 150 Playwright = 249/249 green** (18 SCR-006 Pw still on disk pending run; would push to 267).

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
| _on disk CP-9.3a_ | — | `/rca` list page (SCR-008) + router-replace guard fix retro-applied to /intakes + 18 Pw cases × 3 browsers green + SCR-007 18/18 regression green |
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
| web | mendoraci-web (Next.js 14) | ✅ SCR-001..006 routable + **SCR-007 `/intakes` live (CP-9.2)** + **SCR-008 `/rca` live (CP-9.3a)** |
| test | mendoraci-test (Playwright 1.60.0-jammy × 3 browsers) | ✅ 150/150 last full Pw lane partial (SCR-001..005 + SCR-007 + SCR-008); SCR-006 18 cases on disk run pending |

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
| **CP-9.3a** | `/rca` list page + 18 Pw cases + guard fix retro-applied to /intakes | 🟡 on disk, 36/36 green |
| **CP-9.3b** | `/repair-plans` list page + 18 Pw cases | 🔵 next |
| **CP-9.3c** | `/approvals` list page + 18 Pw cases | 🔵 |
| **CP-9.3d** | `/evidence` list page + 18 Pw cases | 🔵 |
| **CP-9.4** | `/dashboard` KPIs + recent activity | 🔵 |
| **CP-9.5** | replace `NavLinks.tsx` with static list-page links; delete `active-context.ts`; delete per-page stamping calls | 🔵 |
| **CP-9.6** | final Pw regression (target 222 cases + 90 new = 312) | 🔵 |

### List endpoints / UI pages

| Endpoint | API status | UI page status |
|---|---|---|
| `GET /v1/intakes` | ✅ `d6f62ee` | ✅ `/intakes` `fab6157` (with CP-9.3a guard fix on disk) |
| `GET /v1/rca-findings` | ✅ `9d87ee3` | 🟡 `/rca` on disk CP-9.3a (18/18 Pw green × 3) |
| `GET /v1/repair-plans` | ✅ `b4421c4` | 🔵 CP-9.3b |
| `GET /v1/approvals` | ✅ `a13aafb` | 🔵 CP-9.3c |
| `GET /v1/evidence-exports` | ✅ `a13aafb` | 🔵 CP-9.3d |

### CP-9.3a design notes (what shipped on this disk-iteration)

**`/rca` page** (SCR-008, `apps/web/src/app/rca/page.tsx`):
- Mirror of SCR-007 with RCA-specific columns: when / intake (run_id + provider + branch) / model (model_id + provider) / confidence-badge / root_cause (line-clamp-2) / evidence-count / actions-count / bob-ms / open
- Reuses shared `list-utils` library (no duplication; lib was specifically built for this in CP-9.2)
- Filters: q (root_cause ILIKE), confidence (low/medium/high), provider (bob/mock-bob), intake_id (uuid), from/to (ISO)
- Cursor pagination, selection checkboxes, empty/loading/error states, page-size selector
- Color-coded confidence badge using shared `confidenceBadgeClass`
- "← Intakes" link at top-right for cross-page nav

**ROUTER-REPLACE GUARD FIX** (applied to both `/intakes` and `/rca`):
- Bug: previous version called `router.replace(...)` unconditionally on every filter change. On first mount with a partial URL (e.g. `/rca?confidence=high`), the default-limit normalisation would replace to `/rca?confidence=high&limit=50` immediately.
- Two real-user impacts: (1) extra browser history entry on every page-load (back button takes user to the *same* page they just opened); (2) in webkit/Playwright this manifests as "Navigation to A is interrupted by another navigation to A&limit=50"
- Fix: guard `router.replace()` so it only fires when `buildSearch(filters) !== window.location.search`
- Applied to `apps/web/src/app/intakes/page.tsx` (CP-9.2) and `apps/web/src/app/rca/page.tsx` (CP-9.3a)
- SCR-007 18/18 regression confirms no behavioural change on /intakes

**Test fix lesson** (TEST-Pw-010c):
- Original: two `page.goto('/rca?confidence=high')` then `page.goto('/rca?confidence=low')` — flaked on firefox + webkit due to in-flight request races
- Fixed by: drive the confidence dropdown via `selectOption(...)` instead of a second goto. Mimics real-user behaviour and avoids the cross-browser navigation race entirely.
- General rule: prefer in-page interaction to repeated page.goto() when validating filter UX

**18 Playwright cases** (`tests/playwright/scr-008-rca-list.spec.ts`):

| Browser | Cases | Duration | Status |
|---|---|---|---|
| chromium | 6 | 16.0s | ✅ |
| firefox | 6 | 26.0s | ✅ (after dropdown-interaction fix) |
| webkit | 6 | 28.9s | ✅ (after router-replace guard fix) |
| **Total** | **18** | **~71s** | **✅** |

Each browser runs the same 6 scenarios:
- **Pw-010a** — all primary controls render + at least one RCA row after seeding
- **Pw-010b** — `intake_id` filter returns exactly the target RCA
- **Pw-010c** — confidence dropdown switches result set (high → low → empty) — uses in-page dropdown to avoid firefox NS_BINDING_ABORTED race
- **Pw-010d** — cursor pagination Next/Prev (limit=2 over 3 RCAs, no overlap, Prev returns to first page exactly)
- **Pw-010e** — empty state for impossible q filter
- **Pw-010f** — row checkbox + select-all + Open link nav to `/intake/[id]/rca`

**SCR-007 18/18 regression confirmation:** after applying the same router-replace guard to `/intakes`, SCR-007's 18 cases ran clean (1.1m).

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
| Playwright SCR-007 × 3 (CP-9.2) | 18 | ✅ (regression-tested with CP-9.3a guard fix) |
| **Playwright SCR-008 × 3 (CP-9.3a)** | **18** | **✅ (TEST-Pw-010a..f × chromium/firefox/webkit)** |
| **Subtotal** | **267** | **249 green, 18 pending** |
| CP-9 remaining UI list pages (CP-9.3b/c/d) | +54 (3 pages × 6 × 3) | 🔵 |
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

### Learned patterns from CP-9.3a

**Router-replace guard** (cross-browser):
Always guard `router.replace()` calls in URL-sync effects with a comparison against `window.location.search`. Without the guard, default-value normalisation triggers an extra history entry on every page load and causes webkit/firefox to abort in-flight requests when tests navigate twice in quick succession.

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
When a test verifies filter UX, prefer driving the dropdown / input directly (`selectOption`, `fill`) over two consecutive `page.goto()` calls. This both mimics real-user behaviour AND avoids cross-browser in-flight request races (`NS_BINDING_ABORTED` on firefox, "navigation interrupted" on webkit).

**`gotoAndWait` helper pattern**:
Each list-page Pw spec includes a local helper that calls `page.goto()` with `waitUntil: 'load'`, then polls until the skeleton is gone AND either rows / empty-row / error-row is present. This is more robust than `waitForResponse` because it doesn't care which intermediate XHRs fire — it cares about the rendered terminal state.

**MILESTONE: CP-9.3a ships the second list page. 2/5 list pages live (`/intakes`, `/rca`).**
