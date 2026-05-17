# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (the source-of-truth doc, preserved unchanged).
> Updated after every development commit per CLAUDE_RULES (17/05/2026 13:40):
> "update the traceability document after each development and git commit push the traceability".

**Last update:** 2026-05-17 15:08 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + pushed** ✅ | 64b8e87 | 8/8 vitest; Pw-001 added (pending run) |
| RT-002 | Repo Linking | not-started | — | — |
| RT-003 | RCA | not-started (needs Bob, mock OK) | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16/16 |
| RT-013 | Multi-Tenant Isolation | **tested-passing + pushed** ✅ | 64b8e87 | RLS FORCE live |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | 64b8e87 | replay green |
| RT-002..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 4 / 20 done. Vitest 24 / 24. Playwright 0 / 12 (pending CP-3 run).**

---

## 2. CP-3 Playwright — files on disk, pending run

| File | Purpose |
|---|---|
| `tests/playwright/playwright.config.ts` | 3-browser config (chromium/firefox/webkit), runs against live web+api |
| `tests/playwright/scr-001-intake-happy.spec.ts` | TEST-Pw-001 (×3) happy + mask preview |
| `tests/playwright/scr-001-intake-negative.spec.ts` | TEST-Pw-002 (×7) 422/401(×2)/400/413/400/404 |
| `tests/playwright/scr-001-intake-error-surfacing.spec.ts` | TEST-Pw-003 (×3) UI surfacing on 500/422/network-error |
| `infra/docker/test.Dockerfile` | mcr.microsoft.com/playwright:v1.48.0-jammy base, all 3 browsers pre-installed |
| `docker-compose.yml` `test` service | profile=test, depends_on api healthy, mounts ./playwright-report |
| `scripts/cp3_run_e2e.py` | one-command: stack up + wait + build test image + run E2E |

**Total Playwright cases:** 13 (3 happy/mask + 7 negative + 3 error-surfacing).
**Per CLAUDE_RULES:** 100% functional + 100% negative + Playwright mandatory. CP-3 will green all of these.

---

## 3. Bob credential state (15:07)

| Field | Value | Source |
|---|---|---|
| BOB_API_KEY | **set** (length ~183 chars based on PS asterisks) | user pasted via set-bob-secrets v1, then v2 |
| BOB_API_URL | https://us-south.ml.cloud.ibm.com | v2 default |
| BOB_PROJECT_ID | empty | unknown |
| BOB_DEPLOYMENT_ID | empty | unknown |
| USE_MOCK_BOB | true | safe default |

**bob_discover.ps1 v1 hit IAM 400.** Cause: form-body was URL-encoded twice. **v2 fixes this** by passing a hashtable to `-Body` (PS handles encoding).

When user wants live Bob (CP-5 earliest):
```powershell
.\scripts\bob_discover.ps1
```
This will: IAM-exchange → probe 6 regions → list projects → pick one → write complete `.env.bob` → restart api.

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-2c-7 + CP-3_ | bob v2.1 verify fix + bob_discover v2 + Playwright CP-3 (4 files in tests/, test.Dockerfile, cp3_run_e2e.py, compose test service) |
| 64b8e87 | flip RT-001/013/015 to tested-passing + bob v2 + bob_discover v1 |
| fc6b4ea | CP-2c-5 envelope shape + race-free idempotency (8/8 green) |
| a05be44 | CP-2c-4 error-handler rewrite |
| 203986c | CP-2c-3 drop tsx watch |
| 5ad9e4c | CP-2c-2 drop -j cjs flag |
| aea042c | CP-2c-1 .dockerignore |
| 1a463e8 | CP-2c full docker stack + web SCR-001 |
| fe4ee73 | CP-2b runner v2 |
| 85fb2bc | CP-2 runner v1 |
| 34f6faf | CP-2 API + DB + tests |
| 84a87e8 | CP-1b lockfiles |
| 8a3b5ed | CP-1 mask-policy verified |
| 0def6a1 | CP-0c-B rename 1208 |
| db3916e | CP-0c-A rename 1130 |
| 2bafe07 | CP-0b 34 source docs |
| 35149e8 | CP-0 scaffold |

---

## 5. Test Coverage Map (against MendoraCI_TestAutomationMatrix.md)

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask N=500 0 leaks | ✅ |
| BR-008 / TEST-024 | mask fail-closed | ✅ |
| BR-008 | determinism + pinning | ✅ |
| BR-008 | negative no over-mask | ✅ |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ |
| BR-001 / TEST-001 | happy 201 + p95 ≤ 5s | ✅ |
| BR-008 cross | mask preview embedded | ✅ |
| RT-015 / TEST-001-A | replay 1 row | ✅ |
| BR-001 / TEST-002 | 422 schema | ✅ |
| BR-001 / TEST-003 | 401 missing tenant | ✅ |
| BR-001 / TEST-003 | 401 bad UUID | ✅ |
| BR-001 / TEST-004 | 413 oversized | ✅ |
| RT-015 / TEST-015 | 400 idem-key missing | ✅ |
| **Pw-001 / SCR-001** | happy submit + UI status flip | **pending CP-3 run** |
| **Pw-001b / SCR-001** | AKIA key not leaked in render | **pending** |
| **Pw-002a..g / SCR-001** | 422/401x2/400/413/400/404 envelope via real HTTP | **pending** |
| **Pw-003a..c / SCR-001** | UI surfaces 500/422/network-error | **pending** |

---

## 6. Next-task queue (after CP-3 green)

1. **CP-4** RT-002 Repo Linking — API-003 + DB-003/004 + SCR-002 + tests
2. **CP-5** RT-003 RCA — first Bob call (run `.\scripts\bob_discover.ps1` then)
3. **CP-6** RT-004 Repair Plan
4. **CP-7** RT-005 Approval
5. **CP-8** RT-006 Evidence Export
6. **CP-9** RT-007 Analytics
7. **CP-10** RT-014 Roles + RT-011 Audit
8. **CP-11** RT-009 PromptOps + RT-012 Eval gate
9. **CP-12** RT-016 Cost + RT-019 Residency
10. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay
11. **CP-14** RT-018 QBR
