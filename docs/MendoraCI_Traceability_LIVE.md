# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (the source-of-truth doc, preserved unchanged).
> This file is updated after **every** development commit per CLAUDE_RULES new rule (17/05/2026 13:40): "update the traceability document after each development and git commit push the traceability".
>
> Status transitions: `not-started` → `code-written` → `tested-passing` → `pushed`.

**Last update:** 2026-05-17 13:59 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **code-written** | 34f6faf | 0 / 7 (plumbing fixed CP-2c; integration run pending) |
| RT-002 | Repo Linking | not-started | — | — |
| RT-003 | RCA | not-started | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-008 | Secret Masking | **tested-passing + pushed** | 35149e8 | 16 / 16 (TEST-023 N=500 0 leaks, TEST-024 fail-closed) |
| RT-009 | PromptOps Governance | not-started | — | — |
| RT-010 | Flaky Detection | not-started | — | — |
| RT-011 | Audit Schema | not-started | — | — |
| RT-012 | Eval Gate Enforcement | not-started | — | — |
| RT-013 | Multi-Tenant Isolation | **code-written** | 34f6faf | RLS migration written + withTenant() shim; tests pending |
| RT-014 | Role/Permission Model | not-started | — | — |
| RT-015 | Idempotency & Replay | **code-written** | 34f6faf | dedupe table + active-row partial UNIQUE; test pending |
| RT-016 | Cost Ceiling Enforcement | not-started | — | — |
| RT-017 | Drift Detection | not-started | — | — |
| RT-018 | Customer Success / QBR | not-started | — | — |
| RT-019 | Data Residency Config | not-started | — | — |
| RT-020 | Replay/Regression Harness | not-started | — | — |

---

## 2. Live Commit Ledger (most recent first)

| Commit | CP | Touched | RT status change |
|---|---|---|---|
| _pending CP-2c_ | CP-2c plumbing fix + web skeleton + compose-all | apps/web (Next.js 14 SCR-001 page), docker-compose full stack (api-migrate, api, web), api.Dockerfile / web.Dockerfile rebuilt, .cjs migration (was .ts), fastify-plugin dep, package.json hygiene | RT-001 stays code-written; setup for green |
| fe4ee73 | CP-2b | runner v2 (single container, set -e) | — |
| 85fb2bc | CP-2 | runner v1 | — |
| 34f6faf | CP-2 | apps/api (API-001, API-002, DB-001/002, idempotency, RLS, 7 integration tests) | RT-001/013/015 → code-written |
| 84a87e8 | CP-1b | lockfiles + .gitignore .pnpm-store | — |
| 8a3b5ed | CP-1 | mask-policy verified in docker | RT-008 → **tested-passing + pushed** |
| 0def6a1 | CP-0c-B | rename 1208 set | — |
| db3916e | CP-0c-A | rename 1130 set | — |
| 2bafe07 | CP-0b | 34 source-of-truth docs | — |
| 35149e8 | CP-0 | monorepo + docker + mask-policy code + 16 mask tests | RT-008 → code-written |

---

## 3. Docker Service Coverage (per CLAUDE_RULES DOCKER RULES)

| Service | docker-compose service | Status | Notes |
|---|---|---|---|
| Postgres 16 | `postgres` | **healthy** (manual `docker compose up -d postgres`) | RLS enabled in migration |
| Redis 7 | `redis` | not yet started | up next CP-2c |
| MinIO (S3-compat) | `minio` + `minio-init` | not yet started | buckets `mendoraci-evidence` + `mendoraci-goldsets` |
| API (Fastify) | `api` (+ `api-migrate` one-shot) | not yet started | depends_on postgres healthy + minio-init complete + api-migrate succeeded |
| Web (Next.js 14) | `web` | not yet started | depends_on api healthy |
| Test runner | `test` (profile=test) | not yet started | runs vitest + Playwright |

**Plan:** `docker compose up --build -d` runs all 6 services. CP-2c verifies that.

---

## 4. Test Coverage Map

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask red-team N=500 0 leaks | ✅ green (8a3b5ed in docker node:20-alpine) |
| BR-008 / TEST-024 | mask engine failure → BLOCK | ✅ green |
| BR-008 | determinism + version pinning | ✅ green |
| BR-008 | negative — no over-mask | ✅ green |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ green |
| BR-001 / TEST-001 | intake happy path p95 ≤ 5s | code-written, blocked on CP-2c plumbing |
| BR-008 cross-cut | intake mask preview embedded | code-written |
| RT-015 / TEST-001-A | idempotency replay 1 row | code-written |
| BR-001 / TEST-002 | schema validation 422 | code-written |
| BR-001 / TEST-003 | missing/invalid tenant 401 | code-written |
| BR-001 / TEST-004 | oversized 413 | code-written |
| RT-015 | idempotency-key missing 400 | code-written |
| Playwright TEST-Pw-001 | SCR-001 drop-zone E2E happy | not-started (CP-3) |
| Playwright TEST-Pw-002 | SCR-001 drop-zone E2E negative | not-started (CP-3) |
