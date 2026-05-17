# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 22:32 UK — CP-5b SCR-003 RCA page E2E green (78/78 Pw)
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested + E2E** ✅ | 86f63cd | 8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested + E2E** ✅ | ccf8ec3 | 8 vitest + 6 Pw × 3 = 18 |
| RT-003 | Root-Cause Analysis | **tested + E2E + REAL BOB VERIFIED** ✅ | _pending CP-5b_ | 8 vitest + 6 Pw × 3 = 18 |
| RT-008 | Secret Masking | **tested + E2E** ✅ | 35149e8 | 16 unit + cross-test |
| RT-013 | Multi-Tenant Isolation | **DB-enforced** ✅ | 226d947 | proven via TEST-007 + TEST-009 |
| RT-015 | Idempotency & Replay | **tested + E2E** ✅ | e9320a1 | replay vitest + Pw missing-key |
| RT-004..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 6 / 20 RT rows tested+E2E. Total tests: 16 mask + 24 vitest integration + 78 Playwright = 118 / 118 green.**

---

## 2. CP-5 + CP-5b — Root-Cause Analysis (RT-003)

### Bob CLI integration — REAL BOB VERIFIED END-TO-END

- **Bob Shell CLI v1.0.3** installed on host (Node 24.14) AND in api container (Node 22.22-alpine)
- **Auth env var:** `BOBSHELL_API_KEY` (the docs use this — our original `BOB_API_KEY` was wrong)
- **Key scope required:** `Inference` (set in Bob web portal at https://bob.ibm.com)
- **Runtime invocation:**
  ```
  echo "<prompt>" | bob --auth-method api-key --trust --accept-license \
                          --hide-intermediary-output --chat-mode ask -o text
  ```
- **Verified at 21:50 BST:** real RCA prompt for OOM build → 18.2s response, valid JSON,
  smart insights including unprompted security action (rotate masked AWS key AKIA****)
- Default `USE_MOCK_BOB=true` for deterministic tests + demo; flip to `false` to run with
  real Bob (one-line `.env.bob` edit + `docker compose restart api`)

### CP-5 backend (commits 04e6ffa + 67bccaa, pushed)

| File | Purpose |
|---|---|
| `packages/shared/src/rca.ts` | RcaRequestV1/ResponseV1/DetailV1 + RcaConfidenceEnum |
| `apps/api/src/db/migrations/1747700000000_rt003-rca.cjs` | DB-005 rca_findings + DB-006 rca_evidence + RLS FORCE |
| `apps/api/src/lib/bob.ts` | runRca() dispatch; callRealBob() spawns CLI with stdin pipe; callMockBob() deterministic; typed errors mapped to 502/503/504 |
| `apps/api/src/routes/rca.ts` | POST + GET `/v1/intake/:id/rca` |
| `apps/api/test/integration/rca.test.ts` | 8 cases (happy mock-Bob, cross-tenant 404 RLS, unknown 404, missing mask 412, 4 NEG) |
| `infra/docker/api.Dockerfile` | node:20 → node:22, apk python3+make+g++ for node-pty rebuild, npm install -g bobshell tarball, smoke `bob --version` |

### CP-5b SCR-003 web page + Playwright (_pending commit_)

| File | Purpose |
|---|---|
| `apps/web/src/app/intake/[id]/rca/page.tsx` | SCR-003: chat-mode select, Run RCA button, result panel (provider+model_id+latency, root cause, confidence, evidence list, recommended actions list) |
| `apps/web/src/app/page.tsx` | Added "Run RCA with Bob (SCR-003) →" link next to repo-link link after intake creation |
| `tests/playwright/scr-003-rca.spec.ts` | 6 cases × 3 browsers (renders, happy 201 RCA, 404 surfacing, 422 surfacing, back-nav, API envelope structural) |

### Test results

**Integration (24/24 @ 21:09):**
- 8 RT-001 intake
- 8 RT-002 repo-link (TEST-007 cross-tenant 404 proves RLS for repo_links/repo_commits)
- 8 RT-003 RCA (TEST-009 cross-tenant 404 proves RLS for rca_findings/rca_evidence)

**Playwright E2E (78/78 @ 22:32, 4.8 min run):**
- 42 SCR-001 (14 cases × 3 browsers, incl 60s demo recording)
- 18 SCR-002 (6 cases × 3)
- 18 SCR-003 (6 cases × 3)

---

## 3. Docker stack — all green

| Service | Image | Status |
|---|---|---|
| postgres | postgres:16-alpine | ✅ healthy, mendoraci_admin bootstrap, mendoraci_app non-super for RLS |
| redis | redis:7-alpine | ✅ healthy |
| minio | minio:RELEASE.2024-12-13 | ✅ healthy + 2 buckets ready |
| api-migrate | mendoraci-api (node:22) | ✅ exited 0, 3 migrations applied |
| api | mendoraci-api (node:22 + bob CLI v1.0.3 installed) | ✅ /health 200 |
| web | mendoraci-web (Next.js 14) | ✅ SCR-001 + SCR-002 + SCR-003 routes live |
| test | mendoraci-test (Playwright 1.60-jammy) | ✅ 78/78 green |

---

## 4. Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-5b_ | SCR-003 web page + 6 Pw cases × 3 = 18 new tests + .env.bob default USE_MOCK_BOB=true |
| 67bccaa | RT-003 column fix body_masked (not body_masked_preview) |
| 04e6ffa | CP-5 RT-003 RCA schemas + migration + Bob client + API-004 + 8 integration tests |
| ccf8ec3 | CP-4c SCR-002 web page + 6 Pw cases × 3 |
| 226d947 | CP-4b RLS hardening role split (TEST-007 now 404 not 201) |
| 8010a34 | CP-4 RT-002 Repo Linking schemas + migration + API-003 + tests |
| 12cf23a | untrack commit-msg scratch + gitignore harden |
| 86f63cd | RT-001 fully E2E (42/42 Pw × 3 browsers) |
| _(earlier)_ | scaffold + mask + plumbing fix loops |

---

## 5. Test Coverage Map (118/118)

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (TEST-007 RLS proof) | ✅ |
| api vitest integration RT-003 | 8 (TEST-009 RLS proof for rca_*) | ✅ |
| Playwright SCR-001 × 3 browsers | 42 | ✅ |
| Playwright SCR-002 × 3 browsers | 18 | ✅ |
| Playwright SCR-003 × 3 browsers | 18 | ✅ |
| **Total** | **118** | **✅** |

---

## 6. Next-task queue

1. **CP-6** RT-004 Repair Plan (consumes RCA output; generates JSON plan via Bob)
2. **CP-7** RT-005 Approval workflow (DB state machine + UI approver/rejecter)
3. **CP-8** RT-006 Evidence Export (S3 / MinIO writes + ZIP bundle download)
4. **CP-9** RT-007 Analytics (rollup queries + dashboard tiles)
5. **CP-10** RT-014 Roles + RT-011 Audit
6. **CP-11** RT-009 PromptOps + RT-012 Eval gate
7. **CP-12** RT-016 Cost + RT-019 Residency
8. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression
9. **CP-14** RT-018 QBR
