# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (the source-of-truth doc, preserved unchanged).
> Updated after every development commit per CLAUDE_RULES (17/05/2026 13:40):
> "update the traceability document after each development and git commit push the traceability".

**Last update:** 2026-05-17 14:55 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + pushed** ✅ | fc6b4ea | 8 / 8 vitest integration green inside live api container |
| RT-002 | Repo Linking | not-started | — | — |
| RT-003 | RCA | not-started (needs Bob, mock OK) | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16 / 16 (TEST-023 N=500 0 leaks, TEST-024 fail-closed) |
| RT-009..RT-012 | — | not-started | — | — |
| RT-013 | Multi-Tenant Isolation | **tested-passing + pushed** ✅ | fc6b4ea | RLS FORCE policies live, TEST-003 (x2) green |
| RT-014 | Role/Permission Model | not-started | — | — |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | fc6b4ea | TEST-001-A 1-row replay green, TEST-015 missing-key 400 green |
| RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 3 / 20 RT rows tested-passing+pushed (RT-001, RT-008, RT-013, RT-015 — note RT-001 + RT-013 + RT-015 all cleared in CP-2c-5).**

---

## 2. Docker Service Coverage — ALL UP (NO scope shrink)

| Service | Status | Verified |
|---|---|---|
| postgres | ✅ healthy | `pg_isready` |
| redis | ✅ healthy | `redis-cli ping` |
| minio | ✅ healthy | http /minio/health/live |
| minio-init | ✅ exited 0 | buckets created |
| api-migrate | ✅ exited 0 | migration applied |
| api | ✅ healthy | http://localhost:4000/health |
| web | ✅ running | http://localhost:3000 (SCR-001 page renders, screenshot confirmed 14:31) |

Full stack: `docker compose up -d`.

---

## 3. CP-2c-5 — DONE ✅

**Commit `fc6b4ea` pushed.**

Verify output (paste from 14:47):
```
=== Step 4: smoke — missing idempotency-key → expect 400 + error.code ===
status=400 body={'error': {'code': 'idempotency_key_required', ...}}  ✓
=== Step 5: smoke — missing x-tenant-id → expect 401 + error.code='unauthorized' ===
status=401 body={'error': {'code': 'unauthorized', ...}}  ✓
=== Step 6: smoke — bad schema → expect 422 + error.code='validation_failed' ===
status=422 body={...validation_errors: [...4 errors...]}  ✓

Test Files  1 passed (1)
     Tests  8 passed (8)
Duration   3.44s

=== ALL GREEN — RT-001 + RT-013 + RT-015 tested-passing ===
```

---

## 4. Bob AI credential state (14:55)

| Field | Value | Source |
|---|---|---|
| BOB_API_KEY | **set** (length detected on container) | user-provided via set-bob-secrets.ps1 |
| BOB_API_URL | empty | user did not know — falling back |
| BOB_PROJECT_ID | empty | unknown |
| BOB_DEPLOYMENT_ID | empty | unknown |
| USE_MOCK_BOB | true (forced because no project/deployment) | safe default |

**Mock-Bob keeps the API container healthy.** No AI calls yet (CP-4 first user).

**Next when user wants live Bob:**
- `.\scripts\set-bob-secrets.ps1` (v2, relaxed — partial creds OK)
- `.\scripts\bob_discover.ps1` — uses the API key to fetch IAM token + probe regions + list projects + write complete `.env.bob`

---

## 5. Live Commit Ledger (most recent first)

| Commit | What | RT change |
|---|---|---|
| _pending CP-2c-6_ | bob-secrets v2 relaxed + bob_discover.ps1 + traceability flip RT-001/013/015 to tested-passing | RT-001/013/015 → **tested-passing + pushed** |
| fc6b4ea | CP-2c-5 duck-typed envelope + race-free idempotency | (verified 8/8) |
| a05be44 | CP-2c-4 error-handler shape rewrite | — |
| 203986c | CP-2c-3 drop tsx, use tsc+node | — |
| 5ad9e4c | CP-2c-2 drop -j cjs | — |
| aea042c | CP-2c-1 .dockerignore | — |
| 1a463e8 | CP-2c full docker stack + web skeleton | — |
| fe4ee73 | CP-2b runner v2 | — |
| 85fb2bc | CP-2 runner v1 | — |
| 34f6faf | CP-2 API + DB + tests | RT-001/013/015 → code-written |
| 84a87e8 | CP-1b lockfiles | — |
| 8a3b5ed | CP-1 mask-policy verified | RT-008 → **tested-passing + pushed** |
| 0def6a1 | CP-0c-B rename 1208 | — |
| db3916e | CP-0c-A rename 1130 | — |
| 2bafe07 | CP-0b 34 source docs | — |
| 35149e8 | CP-0 scaffold + mask code | — |

---

## 6. Test Coverage Map (against MendoraCI_TestAutomationMatrix.md)

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask red-team N=500 0 leaks | ✅ |
| BR-008 / TEST-024 | mask engine failure → BLOCK | ✅ |
| BR-008 | determinism + version pinning | ✅ |
| BR-008 | negative — no over-mask | ✅ |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ |
| BR-001 / TEST-001 | intake happy path p95 ≤ 5s | ✅ |
| BR-008 cross-cut | intake mask preview embedded | ✅ |
| RT-015 / TEST-001-A | idempotency replay 1 row | ✅ |
| BR-001 / TEST-002 | schema validation 422 | ✅ |
| BR-001 / TEST-003 | missing X-Tenant-Id 401 | ✅ |
| BR-001 / TEST-003 | invalid-UUID tenant 401 | ✅ |
| BR-001 / TEST-004 | oversized 413 | ✅ |
| RT-015 / TEST-015 | idempotency-key missing 400 | ✅ |
| Playwright TEST-Pw-001 | SCR-001 drop-zone E2E happy | **NEXT (CP-3)** |
| Playwright TEST-Pw-002 | SCR-001 drop-zone E2E negative (no file / oversize / bad type) | **NEXT (CP-3)** |
| Playwright TEST-Pw-003 | SCR-001 server-error UI surfacing | **NEXT (CP-3)** |

**Unit + integration coverage (CP-2c-5):** 8 / 8 RT-001+013+015. **24 / 24 across RT-008 + RT-001/013/015 combined.**

---

## 7. Next-task queue

1. **CP-3** Playwright (MANDATORY per CLAUDE_RULES, 100% coverage incl. negative). Installs in docker (`mendoraci-test` service), runs against live `web` + `api`. Will cover SCR-001 happy + negative + server-error.
2. **CP-4** RT-002 Repo Linking (API-003, DB-003/004, SCR-002).
3. **CP-5** RT-003 RCA — first Bob call. By then run `.\scripts\bob_discover.ps1` to flip out of mock mode (URL+project_id needed).
4. **CP-6** RT-004 Repair Plan.
5. **CP-7** RT-005 Approval.
6. **CP-8** RT-006 Evidence Export.
7. **CP-9** RT-007 Analytics.
8. **CP-10** RT-014 Roles/Perms + RT-011 Audit (cross-cuts).
9. **CP-11** RT-009 PromptOps + RT-012 Eval gate (cross-cuts on AI rows).
10. **CP-12** RT-016 Cost ceiling + RT-019 Residency (cross-cuts).
11. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression.
12. **CP-14** RT-018 Customer Success / QBR.
