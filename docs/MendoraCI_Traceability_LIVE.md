# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (the source-of-truth doc, preserved unchanged).
> Updated after every development commit per CLAUDE_RULES (17/05/2026 13:40):
> "update the traceability document after each development and git commit push the traceability".

**Last update:** 2026-05-17 14:36 UK (CP-2c-5 — robust error-handler shape + explicit reply.send routes)
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **code-written** (CP-2c-5 robust error envelope) | _pending CP-2c-5_ | 1 / 8 last run; rerun after CP-2c-5 |
| RT-002 | Repo Linking | not-started | — | — |
| RT-003 | RCA | not-started | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-008 | Secret Masking | **tested-passing + pushed** | 35149e8 | 16 / 16 (TEST-023 N=500 0 leaks, TEST-024 fail-closed) |
| RT-009..RT-012 | — | not-started | — | — |
| RT-013 | Multi-Tenant Isolation | **code-written + migration applied** | _pending CP-2c-5_ | RLS live in DB; 401 envelope shape now explicit-reply |
| RT-014 | Role/Permission Model | not-started | — | — |
| RT-015 | Idempotency & Replay | **code-written** | _pending CP-2c-5_ | dedupe table live; pre-check then insert (race-free) |
| RT-016..RT-020 | — | not-started | — | — |

---

## 2. Docker Service Coverage — ALL UP (NO scope shrink)

| Service | docker-compose service | Status |
|---|---|---|
| Postgres 16 + RLS FORCE | `postgres` | ✅ healthy |
| Redis 7 | `redis` | ✅ healthy |
| MinIO (S3-compat) | `minio` + `minio-init` | ✅ healthy, buckets created |
| API migrations (one-shot) | `api-migrate` | ✅ exited 0 |
| API (Fastify 5 + RLS + mask) | `api` | ✅ healthy on http://localhost:4000/health |
| Web (Next.js 14) | `web` | ✅ running on http://localhost:3000 (SCR-001) |

Full stack: `docker compose up -d`.

---

## 3. CP-2c-5 plan (this cycle)

**Bugs fixed:**
- B-005: error-handler used `instanceof ZodError` which fails across pnpm-workspace + compiled-dist class identities. Replaced with duck-typed `err.name === 'ZodError' && Array.isArray(err.issues)`.
- B-006: Routes threw `app.httpErrors.X` for 400/401/413 — flow into setErrorHandler was producing Fastify default envelope `{statusCode,error,message}` instead of contract `{error:{code,message}}`. Routes now use explicit `reply.code(N).send({error:{code,message}})`.
- B-007: `tenant-context` preHandler threw `httpErrors.unauthorized` — replaced with direct `reply.code(401).send({error:{code:'unauthorized',message:...}})`.
- B-008: Idempotency check changed from `INSERT ... ON CONFLICT DO NOTHING RETURNING` (which mis-counted rowCount in some pg versions) to **pre-check SELECT then INSERT** — race-free under `withTenant()` transaction.

**Verify (one command):**
```
python scripts/cp2c5_verify.py
```
This script: builds `api`, restarts compose, waits for healthy, runs 3 HTTP smoke tests (400, 401, 422 envelope shape), then runs full vitest integration inside the live api container. Exit 0 only if all green.

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-2c-5_ | error-handler duck-typed ZodError + routes use explicit reply.send + tenant-context direct 401 + idempotency pre-check + cp2c5_verify.py |
| a05be44 | CP-2c-4 error-handler shape (1/8 green, 7 still red) |
| 203986c | CP-2c-3 drop tsx watch (workspace exports resolution) |
| 5ad9e4c | CP-2c-2 drop unsupported `-j cjs` flag |
| aea042c | CP-2c-1 add .dockerignore |
| 1a463e8 | CP-2c full docker stack + web SCR-001 + plumbing fixes |
| fe4ee73 | CP-2b runner v2 |
| 85fb2bc | CP-2 runner v1 |
| 34f6faf | CP-2 API code (API-001/002 + DB-001/002 + idempotency + RLS + 8 integration tests) |
| 84a87e8 | CP-1b lockfiles + .gitignore .pnpm-store |
| 8a3b5ed | CP-1 mask-policy 16/16 **tested-passing + pushed** |
| 0def6a1 | CP-0c-B rename 1208 set |
| db3916e | CP-0c-A rename 1130 set |
| 2bafe07 | CP-0b 22 baseline + 11 enhancement docs |
| 35149e8 | CP-0 monorepo + docker + mask-policy code + 16 mask tests |

---

## 5. Test Coverage Map (against MendoraCI_TestAutomationMatrix.md)

| Anchor | Test | Status |
|---|---|---|
| BR-008 / TEST-023 | mask red-team N=500 0 leaks | ✅ |
| BR-008 / TEST-024 | mask engine failure → BLOCK | ✅ |
| BR-008 | determinism + version pinning | ✅ |
| BR-008 | negative — no over-mask | ✅ |
| BR-008 | applyMaskOrThrow + MaskBlockedError | ✅ |
| BR-001 / TEST-001 | intake happy path p95 ≤ 5s | code-written (CP-2c-5 verify pending) |
| BR-008 cross-cut | intake mask preview embedded | code-written |
| RT-015 / TEST-001-A | idempotency replay 1 row | code-written (pre-check approach) |
| BR-001 / TEST-002 | schema validation 422 | code-written (safeParse + explicit reply) |
| BR-001 / TEST-003 | missing/invalid tenant 401 | code-written (direct reply in preHandler) |
| BR-001 / TEST-004 | oversized 413 | ✅ (was already green) |
| RT-015 / TEST-015 | idempotency-key missing 400 | code-written (explicit reply) |
| Playwright TEST-Pw-001 | SCR-001 drop-zone E2E happy | not-started (CP-3) |
| Playwright TEST-Pw-002 | SCR-001 drop-zone E2E negative | not-started (CP-3) |

**Coverage target (per CLAUDE_RULES):** 100% functional + 100% negative + Playwright E2E mandatory.

---

## 6. Next-task queue (after CP-2c-5 green)

1. **CP-3** Playwright SCR-001 drop-zone E2E (happy + negative). Use `@playwright/test`. Wire into docker compose test profile.
2. **CP-4** RT-002 Repo Linking (next RT in order).
3. **CP-5..** RT-003 RCA, RT-004 Plan, RT-005 Approval, RT-006 Evidence, RT-007 Analytics in strict traceability order.
4. Bob AI credentials still on mock-bob (`USE_MOCK_BOB=true`). `scripts/set-secrets.ps1` ready to flip when user provides them.
