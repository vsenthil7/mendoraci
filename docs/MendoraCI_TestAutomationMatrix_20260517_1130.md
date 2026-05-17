# MendoraCI_TestAutomationMatrix_20260517_1130

**Document Type:** Test Automation Matrix (TEST-001..TEST-028 + sub-tests)
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Coverage Map

| TEST | Type | Subject | Scope | Owner | Automation | Data dep | Frequency | Exit gate |
|---|---|---|---|---|---|---|---|---|
| TEST-001 | Integration | Intake webhook happy path | BR-001 | BE | CI on PR | fixture log | every PR | 5s p95 |
| TEST-001-A | Integration | Intake idempotency replay | BR-001, RT-015 | BE | CI on PR | x3 payload | every PR | 0 duplicates |
| TEST-002 | Integration | Intake schema validation | BR-001 | BE | CI on PR | malformed XML | every PR | 422 on invalid |
| TEST-003 | Negative | Unsigned webhook | BR-001, security | Sec | CI on PR | — | every PR | 401 returned |
| TEST-004 | Negative | Oversized payload | BR-001 | BE | CI on PR | >50MB fixture | every PR | 413 returned |
| TEST-005 | Integration | OAuth happy path | BR-002 | BE | Manual MVP, CI Phase 4 | GitHub app sandbox | weekly | install token issued |
| TEST-006 | Negative | Revoked PAT | BR-002 | BE | CI on PR | — | every PR | 403 + rotate hint |
| TEST-007 | Integration | Repo verify | BR-002 | BE | CI on PR | real repo | every PR | SHA ≤ 10s |
| TEST-008 | AI eval | EVAL-001 gold-set run | BR-003, BR-012 | AI | CI on prompt PR | Gold set v1 | every prompt PR | ≥ 85% MVP |
| TEST-009 | Negative | RCA model timeout | BR-003 | AI | CI on PR | mock 31s | every PR | fallback engaged |
| TEST-010 | Integration | RCA writes prompt_run | BR-003 | BE | CI on PR | — | every PR | row with all pins |
| TEST-011 | AI eval | EVAL-002 gold-set run | BR-004, BR-012 | AI | CI on prompt PR | Gold set v1 | every prompt PR | ≥ 80% MVP |
| TEST-012 | Schema | Plan JSON schema | BR-004 | BE | CI on PR | all plans | every PR | 100% validity |
| TEST-013 | Negative | Plan touches protected branch | BR-004 | BE | CI on PR | — | every PR | dual-approver flagged |
| TEST-013-A | Security | Multi-tenant RLS pen-test | RT-013, RC-006 | Sec | Manual quarterly | — | quarterly | 0 cross-tenant rows |
| TEST-013-B | Compliance | EU residency config | RT-019, RC-026 | SRE | CI on PR | — | every PR | data resident eu-west |
| TEST-014 | Integration | Approval sign happy path | BR-005 | BE | CI on PR | — | every PR | append-only row |
| TEST-014-A | RBAC | Permission matrix sweep | RT-014, RC-022 | Sec | CI on PR | RBAC fixtures | every PR | all 14 rows pass |
| TEST-015 | Negative | Approval token expired | BR-005 | BE | CI on PR | — | every PR | 410 returned |
| TEST-016 | Integration | Dual-approval prod path | BR-005 | BE | CI on PR | — | every PR | both signatures required |
| TEST-017 | UX | Slack DM deep-link | BR-005 | FE | Manual | — | weekly | opens SCR-005 |
| TEST-018 | Integration | Evidence ZIP generate | BR-006 | BE | CI on PR | E2E fixture | every PR | manifest valid |
| TEST-019 | Security | Evidence HMAC verify | BR-006 | Sec | CI on PR | — | every PR | offline-valid |
| TEST-020 | Compliance | 10-year retention | BR-006 | SRE | CI on PR | — | every PR | object-lock set |
| TEST-021 | Performance | Dashboard p95 load | BR-007 | FE | CI on PR | synthetic | every PR | ≤ 2s 90-day window |
| TEST-021-A | FinOps | Cost ceiling throttle | RT-016, RC-024 | BE | CI on PR | — | every PR | throttle at 100% |
| TEST-022 | Integration | CSV export schema | BR-007 | BE | CI on PR | — | every PR | columns stable |
| TEST-023 | Security | Mask v1 red-team | BR-008 | Sec | CI on PR | red-team corpus N=500 | every PR | 0 leaks |
| TEST-024 | Negative | Mask engine failure | BR-008 | Sec | CI on PR | fault injection | every PR | block, no fallback |
| TEST-025 | Governance | Prompt promotion blocked when EVAL red | BR-009, RC-016 | AI | CI on PR | — | every PR | 409 returned |
| TEST-026 | Parity | Flaky vs BuildPulse | BR-010 | AI | Manual quarterly | shared corpus | quarterly | ±10% list overlap |
| TEST-027 | Schema | audit_export schema | BR-011 | BE | CI on PR | — | every PR | JSON Schema 2020-12 valid |
| TEST-028 | AI eval | Eval gate enforcement | BR-012 | AI | CI on PR | bad-prompt fixture | every PR | gate fires |
| TEST-028-A | Drift | PSI > 0.2 alert | RT-017, RC-020 | AI | CI on PR | synthetic shift | every PR | alert generated |
| TEST-028-B | Regression | Replay harness on prior incidents | RT-020, RC-027 | AI | CI on PR | replay set | every PR | parity ≥ 95% |

---

## 2. Coverage Summary

| Coverage axis | Count | Notes |
|---|---|---|
| Functional BRs covered | 12 / 12 | all BR-001..BR-012 |
| Non-functional dims covered | 6 / 6 | security, perf, RBAC, FinOps, drift, retention |
| AI evaluations covered | 2 / 2 | EVAL-001, EVAL-002 |
| Negative paths | 8 | TEST-003, 004, 006, 009, 013, 015, 024, plus 028 fixtures |
| Schema-validity tests | 4 | 002, 012, 022, 027 |
| Security tests | 6 | 003, 013-A, 014-A, 019, 023, 024 |
| Compliance tests | 3 | 013-B, 020, 027 |
| Performance tests | 2 | 001, 021 |
| Manual / quarterly | 3 | 005 (MVP only), 013-A, 026 |

---

## 3. CI Pipeline Structure

```
PR opened
  │
  ▼
┌──────────────────────────────────────────┐
│ Stage 1: lint, type-check, unit (fast)   │ ~3 min
└──────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────┐
│ Stage 2: schema, security, RBAC          │ ~5 min
│ TEST-002, 003, 004, 012, 013, 014-A,     │
│ 015, 019, 020, 022, 023, 024, 027        │
└──────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────┐
│ Stage 3: integration + perf              │ ~12 min
│ TEST-001, 001-A, 005 (Phase 4), 006,     │
│ 007, 010, 013-B, 014, 016, 018, 021,     │
│ 021-A                                    │
└──────────────────────────────────────────┘
  │
  ▼  (only if prompt files changed)
┌──────────────────────────────────────────┐
│ Stage 4: EVAL gates                      │ ~8 min
│ TEST-008, 009, 011, 025, 028, 028-A,     │
│ 028-B                                    │
└──────────────────────────────────────────┘
  │
  ▼
PR mergeable only if all stages green
```

Manual tests (TEST-005 weekly, TEST-013-A quarterly, TEST-017 weekly, TEST-026 quarterly) run on schedule outside PR flow; reported to Grafana board.

---

## 4. Fixture & Gold-Set Management

| Fixture / Set | Owner | Storage | Versioning |
|---|---|---|---|
| Intake fixtures (10 per provider) | BE | `/test-fixtures/intakes/` in Git | Git tag |
| Red-team mask corpus (N=500) | Sec | `/test-fixtures/redteam/` in Git (LFS for binaries) | Git tag |
| EVAL-001 gold set | AI | S3 Object Lock | gold_set_v1.x semver |
| EVAL-002 gold set | AI | S3 Object Lock | gold_set_v1.x semver |
| Replay incident set | AI | S3 Object Lock | replay_set_v1.x semver |
| BuildPulse parity corpus | AI | Customer-loaned, NDA | external |

---

## 5. Test Data Privacy

- All fixtures use synthetic or anonymized data
- Red-team corpus uses synthetic AKIA*/ghp_* etc. tokens (NOT real)
- Customer-loaned corpora live in tenant-isolated test-only S3 with NDA
- No real PII in any test fixture
