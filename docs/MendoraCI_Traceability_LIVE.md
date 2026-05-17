# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 19:14 UK — RT-002 + RT-013 DB-enforced
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + E2E** ✅ | 86f63cd | 8/8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested-passing** ✅ (Pw next) | _pending CP-4b_ | 8/8 vitest integration |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16/16 unit + verified in UI |
| RT-013 | Multi-Tenant Isolation | **tested-passing (NOW DB-ENFORCED)** ✅ | _pending CP-4b_ | RLS proven via TEST-007 cross-tenant 404 |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | e9320a1 | replay green |
| RT-003..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 5 / 20 RT rows tested-passing. Total tests: 16 vitest unit + 16 vitest integration + 42 Playwright = 74/74 green.**

---

## 2. CP-4 + CP-4b — Repo Linking + RLS hardening

### CP-4 RT-002 (commit 8010a34, pushed)
- Schemas: `packages/shared/src/repo-link.ts` (RepoLinkRequestV1/ResponseV1/DetailV1)
- Migration: `1747600000000_rt002-repo-linking.cjs` — DB-003 repo_links + DB-004 repo_commits + RLS FORCE
- Routes: `apps/api/src/routes/repo-link.ts` — POST/GET wired under `/v1`
- Tests: 8 vitest integration cases

### CP-4b RLS hardening (CRITICAL — pending commit)

**Bug found by TEST-007**: `mendoraci_app` was bootstrap superuser (`rolsuper=t rolbypassrls=t`). Every RLS policy across the entire codebase was silently bypassed. RT-013 tests had passed via API-layer guards only; the DB was not enforcing.

**Fix shipped**:
| File | Change |
|---|---|
| `docker-compose.yml` | postgres uses POSTGRES_ADMIN_USER as bootstrap, api uses non-super `mendoraci_app` URL, api-migrate uses admin URL, DATABASE_URL_ADMIN exposed in api+test containers for test setup pools |
| `.env` + `.env.example` | split into POSTGRES_ADMIN_USER/PASSWORD + POSTGRES_APP_PASSWORD; DATABASE_URL left empty (per-service override) |
| `infra/sql/00-set-app-password.sh` | guard: refuse to start if POSTGRES_APP_PASSWORD missing |
| `infra/sql/01-create-app-role.sql` | CREATE ROLE mendoraci_app NOSUPERUSER NOBYPASSRLS + grants + default privileges |
| `infra/sql/02-finalize-app-role.sh` | sets mendoraci_app password from env via ALTER ROLE |
| `apps/api/test/integration/intake.test.ts` | uses DATABASE_URL_ADMIN for setup pool, DATABASE_URL (app role) for buildApp |
| `apps/api/test/integration/repo-link.test.ts` | same split |

**Verification @ 19:06**:
```
mendoraci_admin: rolsuper=t rolbypassrls=t   # used by api-migrate only
mendoraci_app:   rolsuper=f rolbypassrls=f   # used by api runtime — RLS fires
```

### Test results @ 19:14

**Integration: 16/16 green** (was 15/16 before role split):
- TEST-005 happy link + GET round-trip ✅
- TEST-005-A link without commits ✅
- TEST-006 dup link 409 ✅
- **TEST-007 cross-tenant 404 ✅** ← was 201 before, now properly blocked
- 4 NEG cases ✅
- All 8 RT-001 vitest still green ✅

**Playwright regression: 42/42 green** (3.5 min run) — chromium + firefox + webkit all clean.

---

## 3. Docker stack (all in Docker per CLAUDE_RULES)

| Service | Role | Status |
|---|---|---|
| postgres | runs as mendoraci_admin (bootstrap super); app role mendoraci_app non-super | ✅ healthy, fresh data dir 19:01 |
| redis | queue (not yet wired) | ✅ healthy |
| minio | S3-compat | ✅ healthy + 2 buckets ready |
| api-migrate | mendoraci_admin URL (DDL) | ✅ exited 0, both migrations applied |
| api | mendoraci_app URL (RLS-enforced) | ✅ /health 200 |
| web | Next.js dev w/ bind-mounted src | ✅ http://localhost:3000 |
| test | Playwright 1.60-jammy | ✅ 42/42 green |

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-4b_ | RLS hardening: role split + init SQL + test pool split + TEST-007 now 404 |
| 8010a34 | CP-4 RT-002 Repo Linking — schemas + migration + API-003 + 8 integration tests (TEST-007 caught the RLS gap) |
| 12cf23a | untrack commit-msg scratch + gitignore harden |
| 86f63cd | RT-001 fully E2E (42/42 Pw across 3 browsers) |
| e9320a1 | gitignore commit-msg scratch |
| aeb04bb | CP-3f Pw image 1.48 → 1.60-jammy |
| 91fd8f1 | CP-3e force-rebuild web + bind-mount src |
| 54ac6a3 | gitignore demo recordings |
| 5b9b659 | demo 60s SCR-001 walkthrough |
| dc5e9d4 | CP-3d crypto.randomUUID fallback |
| 647ce61 | CP-3c pin Pw 1.48 + drop default header |
| c612be0 | CP-3 Playwright suite |
| 64b8e87 | RT-001/013/015 flip + bob v2 |
| _(earlier)_ | scaffold + mask + plumbing fix loops |

---

## 5. Test Coverage Map (74/74)

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 | ✅ (incl TEST-007 proves RLS) |
| Playwright × 3 browsers | 42 (14 cases × 3) | ✅ |

---

## 6. Next-task queue

1. **CP-4c** SCR-002 web page (repo-link form behind `/intake/:id` route) + 6 Playwright cases
2. **CP-5** RT-003 RCA — first Bob call (`.\scripts\bob_discover.ps1` v2 to discover URL + project_id)
3. **CP-6** RT-004 Repair Plan
4. **CP-7** RT-005 Approval workflow
5. **CP-8** RT-006 Evidence Export
6. **CP-9** RT-007 Analytics
7. **CP-10** RT-014 Roles + RT-011 Audit
8. **CP-11** RT-009 PromptOps + RT-012 Eval gate
9. **CP-12** RT-016 Cost + RT-019 Residency
10. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay
11. **CP-14** RT-018 QBR
