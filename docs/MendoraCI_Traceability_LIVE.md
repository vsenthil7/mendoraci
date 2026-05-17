# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (the source-of-truth doc, preserved unchanged).
> Updated after every development commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 14:28 UK
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **code-written + 1/8 green** | 203986c | TEST-004 oversized 413 ✅. 7 failing — error-handler shape bug. |
| RT-002 | Repo Linking | not-started | — | — |
| RT-003 | RCA | not-started | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-008 | Secret Masking | **tested-passing + pushed** | 35149e8 | 16 / 16 |
| RT-009 | PromptOps Governance | not-started | — | — |
| RT-010 | Flaky Detection | not-started | — | — |
| RT-011 | Audit Schema | not-started | — | — |
| RT-012 | Eval Gate Enforcement | not-started | — | — |
| RT-013 | Multi-Tenant Isolation | **code-written, migration applied** | 203986c | RLS live in DB; happy-path test green needed |
| RT-014 | Role/Permission Model | not-started | — | — |
| RT-015 | Idempotency & Replay | **code-written, dedupe table live** | 203986c | TEST-015 still red (error shape) |
| RT-016..RT-020 | — | not-started | — | — |

---

## 2. Docker Service Coverage — ALL UP

| Service | Status | Verified |
|---|---|---|
| postgres | ✅ healthy | `pg_isready` passes |
| redis | ✅ healthy | `redis-cli ping` passes |
| minio | ✅ healthy | http /minio/health/live |
| minio-init | ✅ exited 0 | buckets created |
| api-migrate | ✅ exited 0 | migration applied (raw_intake, intake_meta, idempotency_keys, RLS) |
| api | ✅ healthy | http://localhost:4000/health → `{status:"ok", db:"ok", mask_policy_version:"v1.0.0"}` |
| web | ✅ started | first compile ~30s |

Full stack reproducible: `docker compose up -d`.

---

## 3. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-2c-4_ | error-handler fix (Zod 422 + 401 + 413 + 400 envelope shape) |
| 203986c | CP-2c-3 drop tsx, use tsc+node (workspace resolution honours exports) |
| 5ad9e4c | CP-2c-2 drop -j cjs flag (node-pg-migrate auto-detects) |
| aea042c | CP-2c-1 add .dockerignore |
| 1a463e8 | CP-2c full docker stack + web skeleton + plumbing |
| fe4ee73 | CP-2b runner v2 |
| 85fb2bc | CP-2 runner v1 |
| 34f6faf | CP-2 API code |
| 84a87e8 | CP-1b lockfiles |
| 8a3b5ed | CP-1 mask-policy tested-passing (16/16) |
| 0def6a1 | CP-0c-B rename 1208 |
| db3916e | CP-0c-A rename 1130 |
| 2bafe07 | CP-0b 34 source docs |
| 35149e8 | CP-0 scaffold |

---

## 4. CP-2c-4 next-turn fix-plan (carry-forward)

**Symptom:** 7/8 integration tests fail with statusCode 500 (expected 201/422/401/413/400) and `res.json().error.code` undefined.

**Root causes:**
- B-005: My custom errorHandler isn't catching ZodError or Fastify httpErrors — they fall through to default Fastify error format `{statusCode, error, message}` not `{error: {code, message}}`.
- B-006: In Fastify v5 `app.httpErrors.unauthorized('msg')` may throw differently from v4 expectations.
- B-007: TEST-001 happy path returns 500 — probably the IntakeRequestV1.parse throws *before* error handler can wrap it.

**Fix plan (one commit):**
1. Move ZodError + payload-too-large to Fastify's `setErrorHandler` and verify request hits it before any builtin handler.
2. Replace `throw app.httpErrors.X` with explicit `reply.code(X).send({error:{code, message}})` for deterministic shape.
3. Add Fastify `errorResponseBuilder` for v5-style fallback.
4. Re-run; cycle on residual failures until 8/8 green.

**One green test today:** TEST-004 oversized payload → 413 ✅. Docker compose full stack ✅. End turn.
