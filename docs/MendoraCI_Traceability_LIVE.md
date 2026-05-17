# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 15:21 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + pushed** ✅ | c612be0 | 8/8 vitest; 18/39 Pw (CP-3c fix in flight) |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16/16 |
| RT-013 | Multi-Tenant Isolation | **tested-passing + pushed** ✅ | c612be0 | RLS live |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | c612be0 | replay green |
| RT-002..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 4 / 20 RT rows green. Vitest 24/24. Playwright pending CP-3c re-run.**

---

## 2. CP-3 Playwright run @ 15:18 — 18/39 passed, 21 failed

**The 21 failures are TWO bugs, not 21 problems:**

| Bug | Affects | Cause | Fix |
|---|---|---|---|
| Pw version mismatch | 18 of 21 (all chromium/firefox/webkit launch errors) | pnpm pulled `@playwright/test@1.60.0` (^1.48.0 satisfies 1.60), but docker image is `v1.48.0-jammy` with old browser binaries. Mismatch -> "Executable doesn't exist at /ms-playwright/..." | **Pin `@playwright/test` to exactly `1.48.0`** in root package.json. Image stays at 1.48.0-jammy. |
| Header leak into negative test | 3 of 21 (TEST-Pw-002b × 3 browsers) | playwright.config had `use.extraHTTPHeaders.x-tenant-id` as global default. `request.newContext()` *inherits* that since Pw 1.39+. So "missing tenant" test was actually *sending* the tenant -> got 201 instead of 401. | **Remove global default**, set the header per-context explicitly. TEST-Pw-002b uses a truly clean context. |

**Tests that DID pass (18/39) prove the substrate is correct:**
- TEST-Pw-002a 422 schema (chromium/firefox/webkit) ✅
- TEST-Pw-002c 401 non-UUID tenant (×3) ✅
- TEST-Pw-002d 400 missing idempotency-key (×3) ✅
- TEST-Pw-002e 413 oversized (×3) ✅
- TEST-Pw-002f 400 bad-uuid GET (×3) ✅
- TEST-Pw-002g 404 unknown intake (×3) ✅

(These tests didn't need browsers to launch — they used `request.newContext()` directly, which is why they got far enough to hit the api and assert real behaviour.)

---

## 3. CP-3c fixes pushed in this commit

| File | Change |
|---|---|
| `package.json` | `"@playwright/test": "1.48.0"` (pinned, was `^1.48.0`) |
| `tests/playwright/playwright.config.ts` | dropped global `extraHTTPHeaders`, exported `TEST_TENANT` const |
| `tests/playwright/scr-001-intake-negative.spec.ts` | every context sets `x-tenant-id` explicitly where needed; TEST-Pw-002b uses clean context |

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-3c_ | pin Playwright 1.48.0 exactly + drop global tenant header default + paranoid context per negative test |
| c612be0 | CP-3 Playwright suite (4 spec files, 13 cases × 3 browsers = 39) + bob v2.1 + bob_discover v2 |
| 64b8e87 | flip RT-001/013/015 to tested-passing + bob v2 + discover v1 |
| fc6b4ea | CP-2c-5 envelope shape + race-free idempotency (8/8 vitest) |
| a05be44 | CP-2c-4 error-handler rewrite |
| 203986c | CP-2c-3 drop tsx watch |
| 5ad9e4c | CP-2c-2 drop -j cjs |
| aea042c | CP-2c-1 .dockerignore |
| 1a463e8 | CP-2c full docker stack + web skeleton |
| fe4ee73 | CP-2b runner v2 |
| 85fb2bc | CP-2 runner v1 |
| 34f6faf | CP-2 API code |
| 84a87e8 | CP-1b lockfiles |
| 8a3b5ed | CP-1 mask-policy verified |
| 0def6a1 | CP-0c-B rename 1208 |
| db3916e | CP-0c-A rename 1130 |
| 2bafe07 | CP-0b 34 source docs |
| 35149e8 | CP-0 scaffold |

---

## 5. Bob credential state (15:21)

| Field | Value |
|---|---|
| BOB_API_KEY | set (length ~183) |
| BOB_API_URL | https://us-south.ml.cloud.ibm.com (default) |
| BOB_PROJECT_ID | empty |
| BOB_DEPLOYMENT_ID | empty |
| USE_MOCK_BOB | true (forced — no project/deployment yet) |

bob_discover.ps1 v1 hit IAM HTTP 400 (form-body re-encoding bug); **v2 fixes that** by passing a hashtable to `-Body`. User has not re-run yet. Mock-Bob keeps api healthy.

---

## 6. Test Coverage Map

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask N=500 0 leaks | ✅ |
| BR-008 / TEST-024 | fail-closed | ✅ |
| BR-008 | determinism + pinning | ✅ |
| BR-008 | no over-mask | ✅ |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ |
| BR-001 / TEST-001 | happy 201 | ✅ |
| BR-008 cross | mask preview embedded | ✅ |
| RT-015 / TEST-001-A | replay 1 row | ✅ |
| BR-001 / TEST-002 | 422 schema | ✅ |
| BR-001 / TEST-003 | 401 missing tenant | ✅ |
| BR-001 / TEST-003 | 401 bad UUID | ✅ |
| BR-001 / TEST-004 | 413 oversized | ✅ |
| RT-015 / TEST-015 | 400 idem-key missing | ✅ |
| Pw-002a (3 browsers) | 422 schema via real HTTP | ✅ (3/3) |
| Pw-002c (3) | 401 bad UUID via real HTTP | ✅ (3/3) |
| Pw-002d (3) | 400 idem-key missing | ✅ (3/3) |
| Pw-002e (3) | 413 oversized | ✅ (3/3) |
| Pw-002f (3) | 400 bad UUID GET | ✅ (3/3) |
| Pw-002g (3) | 404 unknown intake | ✅ (3/3) |
| Pw-002b (3) | 401 missing tenant | **CP-3c re-run** |
| Pw-001 happy + Pw-001b mask-preview (3 × 2 = 6) | renders + submit | **CP-3c re-run** |
| Pw-003a..c (3 × 3 = 9) | UI surfaces 500/422/network | **CP-3c re-run** |

**After CP-3c expected: 39/39 ✅.** If any residual reds, fix-loop continues.

---

## 7. Next-task queue

1. **CP-3c verify** — re-run `python scripts/cp3_run_e2e.py` after fix push
2. **CP-4** RT-002 Repo Linking — API-003 + DB-003/004 + SCR-002
3. **CP-5** RT-003 RCA — first Bob call (run `bob_discover.ps1` v2 then)
4. **CP-6** RT-004 Repair Plan
5. **CP-7** RT-005 Approval
6. **CP-8** RT-006 Evidence Export
7. **CP-9** RT-007 Analytics
8. **CP-10** RT-014 Roles + RT-011 Audit
9. **CP-11** RT-009 PromptOps + RT-012 Eval gate
10. **CP-12** RT-016 Cost + RT-019 Residency
11. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression
12. **CP-14** RT-018 QBR
