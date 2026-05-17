# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 20:08 UK — RT-002 fully E2E green (60/60 Pw)
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + E2E** ✅ | 86f63cd | 8/8 vitest + 14 Pw × 3 = 42 |
| RT-002 | Repo Linking | **tested-passing + E2E** ✅ | _pending CP-4c_ | 8/8 vitest + 6 Pw × 3 = 18 |
| RT-008 | Secret Masking | **tested-passing + E2E** ✅ | 35149e8 | 16/16 unit + verified in UI flow |
| RT-013 | Multi-Tenant Isolation | **tested-passing (DB-ENFORCED)** ✅ | 226d947 | RLS proven via TEST-007 cross-tenant 404 |
| RT-015 | Idempotency & Replay | **tested-passing + E2E** ✅ | e9320a1 | replay green vitest + Pw missing-key 400 |
| RT-003..RT-007, RT-009..RT-012, RT-014, RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 5 / 20 RT rows tested-passing+pushed. Total tests: 16 mask + 16 vitest integration + 60 Playwright = 92 / 92 green.**

---

## 2. CP-4c SCR-002 web page (RT-002 user-visible flow)

### Files added
- `apps/web/src/lib/client.ts` — `randomIdempotencyKey()` + `DEMO_TENANT_ID` extracted from page.tsx so SCR-001 + SCR-002 share.
- `apps/web/src/app/intake/[id]/repo/page.tsx` — SCR-002 form: provider select (github/gitlab/bitbucket/azure-devops), repo URL, default branch, submit → POST `/v1/intake/:id/link-repo`. Status / response / error panels.
- `apps/web/src/app/page.tsx` — SCR-001 now shows a link to SCR-002 once intake is created.
- `tests/playwright/scr-002-link-repo.spec.ts` — 6 cases × 3 browsers.

### Playwright SCR-002 cases (all green × 3 browsers)
| Case | What |
|---|---|
| TEST-Pw-004a | renders all primary controls |
| TEST-Pw-004b | happy 201 → link-response visible |
| TEST-Pw-004c | duplicate link → 409 repo_already_linked surfaced |
| TEST-Pw-004d | unknown intake → 404 intake_not_found surfaced |
| TEST-Pw-004e | invalid URL → 422 validation_failed surfaced |
| TEST-Pw-004f | back-to-intake navigates to / |

### Run @ 20:01 → 60 passed (3.9 min)

---

## 3. Docker stack (all in Docker per CLAUDE_RULES, no scope shrink)

| Service | Role | Status |
|---|---|---|
| postgres | bootstrap mendoraci_admin (super); app role mendoraci_app non-super | ✅ healthy |
| redis | queue (not yet wired) | ✅ healthy |
| minio | S3-compat | ✅ healthy + 2 buckets ready |
| api-migrate | mendoraci_admin URL (DDL) | ✅ exited 0, 2 migrations applied |
| api | mendoraci_app URL (RLS-enforced) | ✅ /health 200 |
| web | Next.js dev w/ bind-mounted src + lib + intake/[id]/repo route | ✅ http://localhost:3000 |
| test | Playwright 1.60-jammy | ✅ 60/60 green |

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-4c_ | SCR-002 web page (provider/url/branch form) + 6 Pw cases × 3 = 18 new tests |
| 226d947 | CP-4b RLS hardening: role split + init SQL + test pool split (TEST-007 now 404) |
| 8010a34 | CP-4 RT-002 Repo Linking — schemas + migration + API-003 + 8 integration tests |
| 12cf23a | untrack commit-msg scratch + gitignore harden |
| 86f63cd | RT-001 fully E2E (42/42 Pw × 3 browsers) |
| e9320a1 | gitignore commit-msg scratch |
| aeb04bb | CP-3f Pw image 1.48 → 1.60-jammy |
| 91fd8f1 | CP-3e force-rebuild web + bind-mount src |
| _(earlier)_ | scaffold + mask + plumbing fix loops |

---

## 5. Test Coverage Map (92/92)

| Layer | Cases | Status |
|---|---|---|
| mask-policy unit | 16 | ✅ |
| api vitest integration RT-001 | 8 | ✅ |
| api vitest integration RT-002 | 8 (incl TEST-007 proves RLS at DB) | ✅ |
| Playwright SCR-001 × 3 browsers | 42 (14 cases × 3) | ✅ |
| Playwright SCR-002 × 3 browsers | 18 (6 cases × 3) | ✅ |

---

## 6. Next-task queue

1. **CP-5** RT-003 RCA — first Bob call (`.\scripts\bob_discover.ps1` v2 to discover URL + project_id, then real Bob call from api/rca handler with mock-Bob fallback)
2. **CP-6** RT-004 Repair Plan (depends on RCA output)
3. **CP-7** RT-005 Approval workflow
4. **CP-8** RT-006 Evidence Export (S3 / MinIO writes + ZIP bundle)
5. **CP-9** RT-007 Analytics (rollup queries + dashboard tiles)
6. **CP-10** RT-014 Roles + RT-011 Audit
7. **CP-11** RT-009 PromptOps + RT-012 Eval gate
8. **CP-12** RT-016 Cost + RT-019 Residency
9. **CP-13** RT-010 Flaky + RT-017 Drift + RT-020 Replay/Regression
10. **CP-14** RT-018 QBR
