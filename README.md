# MendoraCI

**AI-Powered CI/CD Reliability Platform.**
RCA → repair-plan → HITL approval → signed evidence pack.

> AT-Hack0020 (IBM Bob hackathon). Source of truth: `docs/` (22-doc BRD package, 17/05/2026 11:30 + 12:08 enhancements).

---

## Build rules (hackathon mode, from CLAUDE_RULES)

1. **Strictly follow traceability.** Every commit names the RT / BR / US / TEST IDs it touches. No deviation, no scope shrink.
2. **Docker from day one.** Local dev, CI, prod all run in containers.
3. **COMMIT-FIRST (hard rule).** Edit → `git add` → `git commit` → `git push` → test → fix-commit-push-retest if fail. No stacking uncommitted edits.
4. **100% test coverage target.** Unit + integration + Playwright E2E + negative paths. Floor is 95% lines with annotated defensive guards.
5. **Mini-sprint = one RT row.** RT-001, then RT-002, then RT-003, in traceability order.

---

## Quick start

```powershell
# 1. Generate secrets
.\scripts\set-secrets.ps1

# 2. Bring everything up
docker compose up --build

# 3. Run all tests
docker compose --profile test run --rm test
```

See `docs/` and `SPRINT_LOG.md`.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| API | Node.js 20 + Fastify + TypeScript |
| DB | Postgres 16 (RLS enabled) |
| Queue | Redis 7 |
| Object store | MinIO (dev) / S3 Object Lock (prod) |
| AI | IBM Bob AI (primary); `rca_fallback_v1` rules |
| Tests | Vitest + Fastify-inject + Playwright |
| CI | GitHub Actions |

---

## Live traceability

See `SPRINT_LOG.md`.

---

## Repo

https://github.com/vsenthil7/mendoraci
