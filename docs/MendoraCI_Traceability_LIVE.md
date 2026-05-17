# MendoraCI Traceability — Live Implementation Status

> **Companion to `MendoraCI_Traceability.md`** (source-of-truth, preserved).
> Updated after every dev commit per CLAUDE_RULES (17/05/2026 13:40).

**Last update:** 2026-05-17 17:50 UK — RT-001 fully E2E green
**Repo:** https://github.com/vsenthil7/mendoraci

---

## 1. RT-001..RT-020 — Live Status

| RT | Subject | Status | Last commit | Tests passing |
|---|---|---|---|---|
| RT-001 | CI Log Intake | **tested-passing + pushed (E2E × 3 browsers)** ✅ | e9320a1 | 8/8 vitest + 14 Pw cases × 3 = 42/42 |
| RT-008 | Secret Masking | **tested-passing + pushed** ✅ | 35149e8 | 16/16 unit + verified in UI flow |
| RT-013 | Multi-Tenant Isolation | **tested-passing + pushed** ✅ | e9320a1 | RLS FORCE, Pw 401×2 green |
| RT-015 | Idempotency & Replay | **tested-passing + pushed** ✅ | e9320a1 | Pw replay + missing-key 400 green |
| RT-002 | Repo Linking | **NEXT (CP-4)** | — | — |
| RT-003 | RCA | not-started (needs Bob) | — | — |
| RT-004 | Repair Plan | not-started | — | — |
| RT-005 | Approval Workflow | not-started | — | — |
| RT-006 | Evidence Export | not-started | — | — |
| RT-007 | Analytics | not-started | — | — |
| RT-009..RT-012 | — | not-started | — | — |
| RT-014 | Role/Permission Model | not-started | — | — |
| RT-016..RT-020 | — | not-started | — | — |

**Roll-up: 4 / 20 RT rows green. Total tests: 24 vitest + 42 Playwright = 66 cases, all green.**

---

## 2. CP-3 Playwright trajectory (final)

| Run | Pass | Fail | Diagnosis | Fix |
|---|---|---|---|---|
| CP-3 (15:14) | 18/39 | 21 | Playwright ver + global tenant header | CP-3c pin 1.48 + drop default |
| CP-3c (15:39) | 27/39 | 12 | crypto.randomUUID secure-context | CP-3d fallback |
| CP-3d (16:55) | 27/39 | 12 | **same** — web image cached, fix not running | CP-3e bind-mount + force-rebuild |
| CP-3e (17:13) | 27/39 | 12 | Playwright resolved to 1.60 but image is 1.48 | CP-3f bump image |
| **CP-3f (17:45)** | **42/42** | **0** | — | Done ✅ |

---

## 3. Docker stack (all in Docker per CLAUDE_RULES, no scope shrink)

| Service | Status |
|---|---|
| postgres | ✅ healthy |
| redis | ✅ healthy |
| minio + minio-init | ✅ buckets ready |
| api-migrate | ✅ exited 0 |
| api | ✅ healthy /health 200 |
| web | ✅ http://localhost:3000 SCR-001 renders, bind-mounted for hot-reload |
| test (Playwright 1.60.0-jammy) | ✅ 42/42 green |

---

## 4. Live Commit Ledger (most recent first)

| Commit | What |
|---|---|
| _pending CP-3-DONE_ | flip RT-001 to E2E-green + Traceability_LIVE update + start CP-4 |
| e9320a1 | chore: gitignore commit-msg scratch |
| aeb04bb | CP-3f bump Playwright image 1.48 -> 1.60-jammy |
| 91fd8f1 | CP-3e force-rebuild web + bind-mount source |
| 54ac6a3 | chore gitignore demo recordings |
| 5b9b659 | demo 1-min SCR-001 walkthrough |
| dc5e9d4 | CP-3d crypto.randomUUID fallback |
| 647ce61 | CP-3c pin Playwright 1.48 + drop default header |
| c612be0 | CP-3 Playwright suite (4 specs) |
| 64b8e87 | RT-001/013/015 flip + bob v2 |
| fc6b4ea | CP-2c-5 envelope shape (8/8 vitest) |
| 35149e8 | CP-0 scaffold |

---

## 5. Test Coverage Map

| Anchor | Layer | Status |
|---|---|---|
| BR-008 / TEST-023 mask N=500 0 leaks | vitest unit | ✅ |
| BR-008 / TEST-024 fail-closed | vitest unit | ✅ |
| BR-008 determinism + pinning | vitest unit | ✅ |
| BR-008 no over-mask | vitest unit | ✅ |
| BR-008 applyMaskOrThrow surface | vitest unit | ✅ |
| BR-001 / TEST-001 happy 201 + p95 5s | vitest integration | ✅ |
| BR-008 cross / mask preview embedded | vitest integration | ✅ |
| RT-015 / TEST-001-A replay 1 row | vitest integration | ✅ |
| BR-001 / TEST-002 422 schema | vitest integration | ✅ |
| BR-001 / TEST-003 401 (missing + bad UUID) | vitest integration | ✅ ✅ |
| BR-001 / TEST-004 413 oversized | vitest integration | ✅ |
| RT-015 / TEST-015 400 idem-key missing | vitest integration | ✅ |
| Pw-001 renders + submit happy | Pw × 3 browsers | ✅ × 6 |
| Pw-001b mask not leaked | Pw × 3 | ✅ × 3 |
| Pw-002a 422 schema (real HTTP) | Pw × 3 | ✅ × 3 |
| Pw-002b 401 missing tenant | Pw × 3 | ✅ × 3 |
| Pw-002c 401 bad UUID | Pw × 3 | ✅ × 3 |
| Pw-002d 400 missing idem-key | Pw × 3 | ✅ × 3 |
| Pw-002e 413 oversized | Pw × 3 | ✅ × 3 |
| Pw-002f 400 bad UUID GET | Pw × 3 | ✅ × 3 |
| Pw-002g 404 unknown intake | Pw × 3 | ✅ × 3 |
| Pw-003a UI surfaces 500 | Pw × 3 | ✅ × 3 |
| Pw-003b UI surfaces 422 | Pw × 3 | ✅ × 3 |
| Pw-003c UI surfaces network down | Pw × 3 | ✅ × 3 |
| Demo recording 60s captioned walkthrough | Pw × 3 | ✅ × 3 |

**Totals: 24 vitest + 42 Playwright = 66 / 66 ✅ across what's coded so far.**

---

## 6. CP-4 RT-002 Repo Linking — starting now

**Scope per `docs/MendoraCI_Traceability.md`:**
- BG-001, BR-002, SCR-002, API-003, DB-003 + DB-004, TEST-005..007, EVID-002, RC-002 + RC-019, IMP-015
- Cross-cuts: RT-008 (PII in repo metadata), RT-013 (tenant scoping), RT-014 (perm to link)

**Build plan (mini-sprint):**
1. DB-003 `repo_links` table (intake_id, repo_provider, repo_url, default_branch, linked_at, linked_by, tenant_id + RLS)
2. DB-004 `repo_commits` table (intake_id, repo_link_id, commit_sha, message, author, authored_at, parents jsonb, tenant_id + RLS)
3. API-003 POST /v1/intake/:id/link-repo + GET /v1/intake/:id/repo
4. apps/web SCR-002 page (basic form behind /intake/:id route)
5. vitest integration: TEST-005 happy link, TEST-006 dup link 409, TEST-007 unauthorized cross-tenant 404 (RLS)
6. Playwright SCR-002 happy + negative cycle

Each step: edit → commit → push → test → fix → commit → push → next.
