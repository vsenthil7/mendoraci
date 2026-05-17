# MendoraCI_ReviewCommentsRegister_20260517_1130

**Document Type:** Review Comments Register — Deep Enhanced
**Version:** 2026-05-17 11:30 DEEP

Severity: Critical / High / Medium / Low. Status: Open / Closed / Deferred.

---

## 1. Register (RC-001..RC-030)

| RC | Comment | Severity | Severity rationale | Linked RT/BR | Evidence | Validation | Sign-off owner | Target date | Status |
|---|---|---|---|---|---|---|---|---|---|
| RC-001 | Intake XML schema validation before persist | Medium | Bad XML wastes downstream cycles | RT-001 / BR-001 | EVID-001 | TEST-004 + XSD review | Tech Lead | Phase 1 end | Closed |
| RC-002 | OAuth scope read-only minimal | High | Excess scope = compliance gap | RT-002 / BR-002 | EVID-002 | Manual OAuth scope review | Sec Lead | Phase 1 end | Closed |
| RC-003 | RCA card must show *why* not just *what* | High | Approver trust requires explainability | RT-003 / BR-003 | EVID-003 | UX review + EVAL-001 explainability slice | AI Lead | Phase 2 end | Closed |
| RC-004 | Repair plan explicit blast-radius field | High | Approvers cannot reason without it | RT-004 / BR-004 | EVID-004 | Schema review | AI Lead | Phase 2 end | Closed |
| RC-005 | Approval justification min 20 chars | Medium | Prevents "ok" rubber-stamps | RT-005 / BR-005 | EVID-005 | TEST-014 | Sec Lead | Phase 2 mid | Closed |
| RC-006 | Multi-tenant pen-test | Critical | Cross-tenant leak = product-existential | RT-013 | EVID-013 | External pen-test | Sec Lead | Phase 4 mid | **Open** |
| RC-007 | Analytics drill-through to incident | Medium | KPI tile unactionable without it | RT-007 / BR-007 | EVID-007 | UX review | PM | Phase 3 end | Closed |
| RC-008 | Mask false-positive rate measured | High | Over-masking degrades RCA | RT-008 / BR-008 | EVID-008 | TEST-023 normal-log corpus | Sec Lead | Phase 2 mid | **Open** |
| RC-009 | RCA confidence calibration (ECE) reported | High | Confidence threshold meaningful only if calibrated | RT-003 | EVID-003 | Calibration plot reviewed | AI Lead | Phase 2 end | **Open** |
| RC-010 | Approval delegation when OOO | Medium | Blocks deploys during PTO | RT-005 | EVID-005 | Manual flow test | Platform Lead | Phase 4 mid | **Open** |
| RC-011 | Evidence pack split-archive for >100MB | Medium | Customer artifacts can exceed limit | RT-006 / BR-006 | EVID-006 | TEST-018 with 150MB fixture | BE Lead | Phase 2 end | Closed |
| RC-012 | Prompt diff visible before promotion | High | Approver must see what's promoting | RT-009 / BR-009 | EVID-009 | UX review | AI Lead | Phase 2 end | Closed |
| RC-013 | Flaky parity vs BuildPulse | Medium | Customers benchmark | RT-010 / BR-010 | EVID-010 | Shared corpus run | AI Lead | Phase 3 end | **Open** |
| RC-014 | Secret-pattern provider extension | High | Datadog/Stripe/Cloudflare tokens missed in v1 | RT-001, RT-008 | EVID-008 | Red-team N=500 includes provider tokens | Sec Lead | Phase 2 mid | **Open** |
| RC-015 | Audit-export schema deprecation policy | Medium | Downstream GRC tools break on field change | RT-011 / BR-011 | EVID-011 | Schema review + version policy | GRC | Phase 3 end | Closed |
| RC-016 | Eval gate must be CI-blocking | Critical | Soft gate = no gate | RT-012 / BR-012 | EVID-012 | TEST-025 verifies 409 on red EVAL | AI Lead | Phase 2 end | Closed |
| RC-017 | Demo deterministic seed | Medium | Live demo failure = hackathon loss | (cross) | — | Demo dry-run x3 | PM | Phase 3 end | **Open** |
| RC-018 | Cross-persona reading order | Low | Reviewer comprehension | (doc-level) | Doc 7 | Per-persona reading order section | PM | Phase 3 mid | Closed |
| **RC-019** | Mask policy version pinned in every prompt_run | High | Without it, eval replay impossible | RT-008 | EVID-008 | Schema review | AI Lead | Phase 2 mid | Closed |
| **RC-020** | Drift detector emits alert at PSI > 0.2 | High | EVAL gate alone doesn't catch slow drift | RT-003, RT-017 | — | TEST-028-A | AI Lead | Phase 2 end | **Open** |
| **RC-021** | RLS on tenant_id enforced at query layer (defense in depth) | Critical | App-only checks fail open | RT-013 | EVID-013 | RLS audit + pen-test | Sec Lead | Phase 1 end | **Open** |
| **RC-022** | RBAC matrix documented and tested | High | Permission creep otherwise | RT-014 | EVID-014 | TEST-014-A | Sec Lead | Phase 2 end | **Open** |
| **RC-023** | Idempotency-Key REQUIRED on writes | High | Replay & at-least-once safety | RT-015 | — | TEST-001-A | BE Lead | Phase 1 end | Closed |
| **RC-024** | Cost ceiling soft (80%) + hard (100%) alerts | High | Runaway LLM cost is recurrent SaaS failure | RT-016 | — | TEST-021-A | Platform Lead | Phase 2 end | **Open** |
| **RC-025** | QBR template for CSM with KPI rollups | Medium | Renewal motion requires this | RT-018 | — | Template review | CSM Lead | Phase 4 mid | **Open** |
| **RC-026** | Data-residency admin flag per tenant | High | EU customer deal-breaker | RT-019 | — | TEST-013-B | SRE Lead | Phase 4 mid | **Open** |
| **RC-027** | Replay/regression harness | Medium | Prevents silent EVAL regressions | RT-020 | — | TEST-028-B | AI Lead | Phase 3 end | **Open** |
| **RC-028** | Model fallback registry with auto-failover | High | Single LLM provider = vendor risk | RT-004, RT-009 | — | Failover test in staging | AI Lead | Phase 2 end | **Open** |
| **RC-029** | Chaos test pack (kill workers, LLM, KMS) | Medium | Ops maturity for Phase 4 | (cross) | — | Quarterly chaos game day | SRE | Phase 4 mid | **Open** |
| **RC-030** | Security-approver role required for secret-rotation plans | High | Prevents accidental rotation by non-security approver | RT-005 | EVID-005 | RBAC test + manual flow | Sec Lead | Phase 4 mid | **Open** |

---

## 2. Summary — Open vs Closed by Severity

| Severity | Open | Closed | Deferred | Total |
|---|---|---|---|---|
| Critical | 2 (RC-006, RC-021) | 1 (RC-016) | 0 | 3 |
| High | 11 | 6 | 0 | 17 |
| Medium | 4 | 5 | 0 | 9 |
| Low | 0 | 1 | 0 | 1 |
| **Total** | **17** | **13** | **0** | **30** |

### Closure trajectory
- **By Phase 1 end:** RC-021, RC-023 → 2 critical/high closed.
- **By Phase 2 end:** RC-008, RC-009, RC-014, RC-019, RC-020, RC-022, RC-024, RC-028 close.
- **By Phase 3 end:** RC-013, RC-017, RC-027 close.
- **By Phase 4 mid:** RC-006, RC-010, RC-025, RC-026, RC-029, RC-030 close.

All 30 RC items planned for closure by Phase 4 mid (≈ week 9 post-hackathon).
