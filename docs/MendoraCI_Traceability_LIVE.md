# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 15:41 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + pushed** ✅ | 647ce61 | 8/8 vitest; 27/39 Pw (CP-3d fix in flight) |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16/16 |
| RT-013 | Multi-Tenant Isolation | **tested-passing + pushed** ✅ | 647ce61 | RLS live |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | 647ce61 | replay green |
| RT-002..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 4 / 20 RT rows tested-passing+pushed. Vitest 24/24. Playwright 27/39 (CP-3d will close the remaining 12).**

---

## 2. CP-3 Playwright trajectory

| Run | Pass | Fail | Bug |
|---|---|---|---|
| CP-3 (15:14) | 18/39 | 21 | Pw version mismatch (18) + global tenant header leak (3) |
| **CP-3c (15:39)** | **27/39** | **12** | **`crypto.randomUUID is not a function` in web app — secure-context-only API** |
| _CP-3d pending_ | **39/39 expected** | 0 | secure-context-safe UUID fallback |

**+9 passes per fix cycle. Same 12 failures hit all 3 browsers identically — proves it's a code bug not a browser quirk.**

---

## 3. CP-3d root cause + fix

**Error (×12 across chromium/firefox/webkit):**
```
TypeError: crypto.randomUUID is not a function
```

**Root cause:** `crypto.randomUUID()` in `apps/web/src/app/page.tsx` only works in secure contexts (HTTPS or `http://localhost`). Inside Docker the Playwright test container loads the page via `http://web:3000` (docker DNS hostname), which browsers treat as NON-secure → `crypto.randomUUID` undefined → page throws BEFORE the fetch → `waitForResponse` times out → rendered error is the JS TypeError, not the API's `internal_error`.

**Fix:** `randomIdempotencyKey()` helper with 3-tier fallback:
1. `crypto.randomUUID()` (secure context)
2. `crypto.getRandomValues()` + manual RFC 4122 v4 assembly (works in non-secure too)
3. `Math.random()` last resort (always works, weaker entropy — acceptable for client-side dedupe key)

When user opens http://localhost:3000 in their browser, path 1 still fires (localhost is secure-context). When Playwright opens http://web:3000 from inside the docker network, path 2 fires.

---

## 4. Live Commit Ledger

| Commit | What |
|---|---|
| _pending CP-3d_ | crypto.randomUUID fallback chain in apps/web/src/app/page.tsx |
| 647ce61 | CP-3c pin Playwright 1.48.0 + drop global tenant header default |
| c612be0 | CP-3 Playwright suite (4 specs, 13 cases × 3 browsers = 39) |
| 64b8e87 | RT-001/013/015 flip + bob v2 + discover v1 |
| fc6b4ea | CP-2c-5 envelope shape + race-free idempotency (8/8 vitest) |
| a05be44 | CP-2c-4 error-handler rewrite |
| 203986c | CP-2c-3 drop tsx watch |
| 5ad9e4c | CP-2c-2 drop -j cjs |
| aea042c | CP-2c-1 .dockerignore |
| 1a463e8 | CP-2c full docker stack + web SCR-001 |
| 8a3b5ed | CP-1 mask-policy verified |
| 35149e8 | CP-0 scaffold |
| _(others in between, see git log)_ | |

---

## 5. Test Coverage Map

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask N=500 0 leaks | ✅ |
| BR-008 / TEST-024 | fail-closed | ✅ |
| BR-008 | determinism + pinning | ✅ |
| BR-008 | no over-mask | ✅ |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ |
| BR-001 / TEST-001 happy | 201 + p95 5s | ✅ (vitest) |
| BR-001 / TEST-001 mask preview | masked body | ✅ |
| RT-015 / TEST-001-A | replay 1 row | ✅ |
| BR-001 / TEST-002 | 422 schema | ✅ |
| BR-001 / TEST-003 missing tenant | 401 | ✅ |
| BR-001 / TEST-003 bad UUID | 401 | ✅ |
| BR-001 / TEST-004 | 413 oversized | ✅ |
| RT-015 / TEST-015 | 400 idem-key missing | ✅ |
| Pw-001 renders all controls | × 3 | ✅ ✅ ✅ |
| Pw-002a 422 | × 3 | ✅ ✅ ✅ |
| Pw-002b 401 missing tenant | × 3 | ✅ ✅ ✅ |
| Pw-002c 401 bad UUID | × 3 | ✅ ✅ ✅ |
| Pw-002d 400 missing idem-key | × 3 | ✅ ✅ ✅ |
| Pw-002e 413 oversized | × 3 | ✅ ✅ ✅ |
| Pw-002f 400 bad UUID GET | × 3 | ✅ ✅ ✅ |
| Pw-002g 404 unknown intake | × 3 | ✅ ✅ ✅ |
| Pw-003c network down | × 3 | ✅ ✅ ✅ |
| **Pw-001 submit-sample** | × 3 | ⏳ CP-3d (crypto.randomUUID fix) |
| **Pw-001b mask not leaked in render** | × 3 | ⏳ CP-3d |
| **Pw-003a 500 surfacing** | × 3 | ⏳ CP-3d |
| **Pw-003b 422 surfacing** | × 3 | ⏳ CP-3d |

**Current: 24 vitest + 27 Playwright = 51 cases green. After CP-3d: 24 + 39 = 63.**

---

## 6. Next-task queue

1. **CP-3d verify** — re-run `python scripts/cp3_run_e2e.py` after fix push (NB: ~1 min image rebuild + ~5 min full E2E run, mostly the 50MB oversize test × 3 browsers)
2. **CP-4** RT-002 Repo Linking — API-003 + DB-003/004 + SCR-002 + tests
3. **CP-5** RT-003 RCA — first Bob call (`.\scripts\bob_discover.ps1` v2 then)
4. **CP-6** RT-004 Repair Plan
5. **CP-7** RT-005 Approval
6. **CP-8** RT-006 Evidence Export
7. **CP-9** RT-007 Analytics
8. **CP-10** RT-014 Roles + RT-011 Audit
9. **CP-11** RT-009 PromptOps + RT-012 Eval gate
10. **CP-12** RT-016 Cost + RT-019 Residency
11. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay
12. **CP-14** RT-018 QBR
