# MendoraCI_Traceability_20260517_1130

**Document Type:** Traceability Master (Primary Anchor) — Deep Enhanced
**Version:** 2026-05-17 11:30 DEEP

Every row cross-references BG / BR / US / SCR / API / DB / TEST / EVID / RC / IMP / EVAL / PR identifiers.

---

## 1. Traceability Index (RT-001..RT-020)

| RT | Subject | BG | BR | SCR | API | DB | TEST | EVID | RC | IMP | EVAL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RT-001 | CI Log Intake | BG-001 | BR-001 | SCR-001 | API-001, API-002 | DB-001, DB-002 | TEST-001..004 | EVID-001 | RC-001, RC-014 | IMP-016 | — |
| RT-002 | Repo Linking | BG-001 | BR-002 | SCR-002 | API-003 | DB-003, DB-004 | TEST-005..007 | EVID-002 | RC-002, RC-019 | IMP-015 | — |
| RT-003 | Root-Cause Analysis | BG-001, BG-005 | BR-003, BR-012 | SCR-003 | API-004 | DB-005, DB-006 | TEST-008..010 | EVID-003 | RC-003, RC-009 | IMP-009 | EVAL-001 |
| RT-004 | Repair Plan | BG-002, BG-005 | BR-004, BR-012 | SCR-004 | API-005 | DB-007 | TEST-011..013 | EVID-004 | RC-004 | IMP-023 | EVAL-002 |
| RT-005 | Approval Workflow | BG-004 | BR-005 | SCR-005 | API-006, API-007 | DB-008 | TEST-014..017 | EVID-005 | RC-005, RC-010 | IMP-019 | — |
| RT-006 | Evidence Export | BG-004 | BR-006, BR-011 | SCR-006 | API-008 | DB-009, DB-010 | TEST-018..020 | EVID-006 | RC-006, RC-011 | IMP-025 | — |
| RT-007 | Analytics | BG-006 | BR-007 | SCR-007 | API-009 | DB-011, DB-012 | TEST-021..022 | EVID-007 | RC-007 | IMP-024 | — |
| RT-008 | Secret Masking | BG-004, BG-005 | BR-008 | (cross) | (cross) | DB-013 | TEST-023..024 | EVID-008 | RC-008, RC-014, RC-019 | IMP-016 | — |
| RT-009 | PromptOps Governance | BG-005 | BR-009 | (admin) | API-010 | DB-014, DB-015 | TEST-025 | EVID-009 | RC-012, RC-020 | IMP-009, IMP-023 | EVAL-001/002 |
| RT-010 | Flaky Detection | BG-003 | BR-010 | SCR-003 sub | API-004 ext | DB-016 | TEST-026 | EVID-010 | RC-013 | IMP-015 | — |
| RT-011 | Audit Schema | BG-004 | BR-011 | (export) | API-008 | DB-010 | TEST-027 | EVID-011 | RC-015 | IMP-025 | — |
| RT-012 | Eval Gate Enforcement | BG-005 | BR-012 | (CI internal) | (internal) | DB-017, DB-018 | TEST-028 | EVID-012 | RC-016 | IMP-022 | EVAL-001/002 |
| **RT-013** | **Multi-Tenant Isolation** | BG-004 | (NFR) | all | all | tenant_id RLS | TEST-013-A | EVID-013 | RC-006, RC-021 | IMP-020 | — |
| **RT-014** | **Role/Permission Model** | BG-004, BG-005 | (NFR) | SCR-005 admin | API-006 | DB-008 + role_perms | TEST-014-A | EVID-014 | RC-022 | IMP-024 | — |
| **RT-015** | **Idempotency & Replay** | BG-001 | BR-001 | SCR-001 | API-001 | idempotency_keys | TEST-001-A | (rolls EVID-001) | RC-023 | — | — |
| **RT-016** | **Cost Ceiling Enforcement** | BG-006 | (NFR) | SCR-007 admin | API-009 | tenant_quotas | TEST-021-A | — | RC-024 | IMP-017 | — |
| **RT-017** | **Drift Detection** | BG-005 | BR-012 | (admin) | (internal) | drift_events | TEST-028-A | — | RC-020 | IMP-009 | EVAL-001/002 |
| **RT-018** | **Customer Success / QBR** | BG-006 | (commercial) | SCR-007 exec | API-009 | qbr_packs | — | EVID-007 ext | RC-025 | IMP-024 | — |
| **RT-019** | **Data Residency Config** | (NFR) | (compliance) | (admin) | API-010 | tenant_region | TEST-013-B | — | RC-026 | IMP-021 | — |
| **RT-020** | **Replay/Regression Harness** | BG-005 | BR-012 | (internal) | (internal) | regression_runs | TEST-028-B | — | RC-027 | IMP-014, IMP-025 | EVAL-001/002 |

---

## 2. BG → BR Weighted Contribution
See BRD §6.1.

---

## 3. BR → US → SCR → API Mapping

| BR | Rep US | SCR | API | Acceptance anchor | Edge case | Negative path | Exit gate |
|---|---|---|---|---|---|---|---|
| BR-001 | US-001 | SCR-001 | API-001, API-002 | Webhook 5s p95 | Matrix run, multi-job | Unsigned webhook → 401 | TEST-001..004 |
| BR-002 | US-008 | SCR-002 | API-003 | OAuth issues install token | Archived repo, SSO required | Invalid PAT → 403 + rotate | TEST-005..007 |
| BR-003 | US-005, US-006 | SCR-003 | API-004 | Inference p95 ≤ 8s | Mixed-cause, non-English | Model timeout → rules fallback | EVAL-001 ≥ 85% MVP |
| BR-004 | US-005 | SCR-004 | API-005 | JSON schema valid | Protected branch | Generation fails → manual form | EVAL-002 ≥ 80% MVP |
| BR-005 | US-003, US-007 | SCR-005 | API-006, API-007 | Signature + justification ≥ 20ch | OOO delegation | Rejected → optional re-plan max 3 | 100% executed plans signed |
| BR-006 | US-004, US-010 | SCR-006 | API-008 | ZIP HMAC-signed; receipt 10y | >100MB split-archive | Signing key down → block, page | EVID verifiable offline |
| BR-007 | US-002 | SCR-007 | API-009 | Dashboard p95 ≤ 2s | Sparse tenant | — | TEST-021..022 |
| BR-008 | US-008 | (cross) | n/a | 0 leak N=500 | Provider-specific tokens | Mask fail → block, no fallback | TEST-023..024 |
| BR-009 | US-009 | (admin) | API-010 | Promotion blocked on red EVAL | Rollback ≤ 30s | Red EVAL promotion → 409 | PromptOps L3 |
| BR-010 | (Platform) | SCR-003 sub | API-004 ext | Flaky list ≤ 15min stale | Parameterized tests | FP > 5% → tune | ±10% parity vs BuildPulse |
| BR-011 | US-010 | (export) | API-008 | Schema versioned, JSON Schema 2020-12 | — | Consumer breakage → deprecation notice | TEST-027 |
| BR-012 | US-009 | (CI) | (internal) | EVAL gates enforced in CI | Drift PSI > 0.2 → alert | Eval-set corruption → block all promotions | TEST-028 |

---

## 4. API → DB → Queue → Evidence Mapping

| API | Request schema | Response | DB writes | Queue emits | Evidence | Idempotency | Timeout |
|---|---|---|---|---|---|---|---|
| API-001 POST /intake | intake.request.v1 | intake.response.v1 | DB-001 raw_intake, DB-002 intake_meta, idempotency_keys | intake.received | EVID-001 | Idempotency-Key REQUIRED, dedupe 24h | 5s soft, 15s hard |
| API-002 GET /intake/{id} | path id | intake.detail.v1 | (read) | — | — | n/a (read) | 2s |
| API-003 POST /repos/link | repo.link.v1 | repo.link.result.v1 | DB-003 repos, DB-004 tenant_secrets | repo.linked | EVID-002 | unique (tenant_id, repo_url) | 10s |
| API-004 POST /rca/run | rca.request.v1 | rca.result.v1 | DB-005 rca_runs, DB-006 prompt_runs | rca.completed / rca.manual_review | EVID-003 | unique intake_id per active run | 30s; 8s p95 |
| API-005 POST /plan/generate | plan.request.v1 | plan.result.v1 | DB-007 repair_plans | plan.generated | EVID-004 | unique rca_run_id | 30s |
| API-006 POST /approval/sign | approval.sign.v1 | approval.signed.v1 | DB-008 approval_records | approval.signed | EVID-005 | unique (plan_id, approver_id) | 5s |
| API-007 POST /approval/notify | approval.notify.v1 | ack | (read) | notify.email, notify.slack | — | unique plan_id+channel | 5s |
| API-008 POST /evidence/export | evidence.export.v1 | evidence.export.result.v1 | DB-009 audit_exports, DB-010 export_manifests | evidence.signed | EVID-006 | unique export_id | 60s |
| API-009 GET /analytics/* | query params | analytics.kpi.v1 | DB-011 kpi_rollups, DB-012 evidence_events | — | EVID-007 | n/a | 2s |
| API-010 POST /admin/prompt/promote | prompt.promote.v1 | prompt.promotion.result.v1 | DB-014 prompts, DB-015 prompt_promotions | prompt.promoted, prompt.canary_started | EVID-009 | unique prompt_version | 10s |

**Cross-cutting:** Retry exponential 1s/4s/16s × 5; DLQ inspect daily (>50/hr → auto-incident); OTel root span per API with tenant_id, intake_id, prompt_version.

---

## 5. AI Evaluation Traceability — EVAL-001 & EVAL-002

### EVAL-001 — Root-Cause Classification

| Attribute | Value |
|---|---|
| Task | 12-class classification of CI failure |
| Primary metric | Slice-weighted macro-F1 |
| Secondary | Top-3 accuracy, confidence calibration (ECE), p95 latency, refusal rate |
| Gold-set | N=250 stratified, 12 classes (≥15 each), 30% adversarial slice |
| Label provenance | 2-of-2 IAA + 3rd-annotator tiebreak |
| Slice definitions | (a) class, (b) provider, (c) language, (d) log-length quartile, (e) repo-age quartile |
| MVP / Pilot / Promotion | 85% / 90% / 92% |
| Degradation policy | >3pp drop any slice 7-day → page; >5pp → auto-rollback |
| Review cadence | Weekly slice review; monthly drift report; quarterly gold-set refresh |
| Owner | AI Lead |
| Escalation | AI Lead → VPE → CTO |
| Drift detection | PSI > 0.2 alert; chi-square on output distribution |
| Fairness | No provider/language slice < 80% |

### EVAL-002 — Repair-Plan Usefulness

| Attribute | Value |
|---|---|
| Task | Structured repair plan; useful = approver accepts with ≤ 1 minor edit |
| Primary metric | Usefulness rate |
| Hard gate | Schema validity 100%; hallucinated-file rate 0 |
| Gold-set | N=250 incidents with approved-plan ground truth |
| Slice | (a) root-cause class, (b) plan-action-type, (c) blast-radius, (d) language |
| MVP / Pilot / Promotion | 80% / 85% / 88% |
| Degradation | Hallucinated-file in any week → hard rollback |
| Owner | AI Lead |
| Fairness | Usefulness parity across action-type slices within 8pp |

---

## 6. Test Coverage (TEST-001..TEST-028 + sub-tests)

| TEST | Type | Subject | Exit gate | Owner | Automation | Data dep |
|---|---|---|---|---|---|---|
| TEST-001 | Integration | Intake webhook happy path | 5s p95 | BE | CI | fixture |
| TEST-001-A | Integration | Intake idempotency replay | 0 dups | BE | CI | x3 payload |
| TEST-002 | Integration | Intake schema validation | 422 on invalid | BE | CI | malformed XML |
| TEST-003 | Negative | Unsigned webhook | 401 | Sec | CI | — |
| TEST-004 | Negative | Oversized payload | 413 | BE | CI | >50MB |
| TEST-005 | Integration | OAuth happy path | install token issued | BE | Manual MVP, CI P4 | GitHub app |
| TEST-006 | Negative | Revoked PAT | 403 + rotate hint | BE | CI | — |
| TEST-007 | Integration | Repo verify | SHA ≤ 10s | BE | CI | real repo |
| TEST-008 | AI eval | EVAL-001 gold-set run | ≥85% MVP | AI | CI | Gold set v1 |
| TEST-009 | Negative | RCA model timeout | fallback fires | AI | CI | Mock 31s |
| TEST-010 | Integration | RCA writes prompt_run | row present with pins | BE | CI | — |
| TEST-011 | AI eval | EVAL-002 gold-set run | ≥80% MVP | AI | CI | Gold set v1 |
| TEST-012 | Schema | Plan JSON schema | 100% | BE | CI | all plans |
| TEST-013 | Negative | Plan touches protected branch | flag approver | BE | CI | — |
| TEST-013-A | Security | Multi-tenant RLS pen-test | 0 crossover | Sec | Manual quarterly | — |
| TEST-013-B | Compliance | EU residency config | data resident eu-west | SRE | CI | — |
| TEST-014 | Integration | Approval sign happy path | append-only | BE | CI | — |
| TEST-014-A | RBAC | Permission matrix sweep | row-by-row pass | Sec | CI | — |
| TEST-015 | Negative | Approval token expired | 410 | BE | CI | — |
| TEST-016 | Integration | Dual-approval prod path | both signatures | BE | CI | — |
| TEST-017 | UX | Slack DM deep-link | opens SCR-005 | FE | Manual | — |
| TEST-018 | Integration | Evidence ZIP generate | manifest valid | BE | CI | E2E fixture |
| TEST-019 | Security | Evidence HMAC verify | offline-valid | Sec | CI | — |
| TEST-020 | Compliance | 10-year retention | object-lock | SRE | CI | — |
| TEST-021 | Performance | Dashboard p95 load | ≤2s 90-day | FE | CI | synthetic |
| TEST-021-A | FinOps | Cost ceiling throttle | throttle at 100% | BE | CI | — |
| TEST-022 | Integration | CSV export schema | columns stable | BE | CI | — |
| TEST-023 | Security | Mask v1 red-team | 0 leaks N=500 | Sec | CI | red-team corpus |
| TEST-024 | Negative | Mask engine failure | block, no fallback | Sec | CI | fault injection |
| TEST-025 | Governance | Prompt promotion blocked when EVAL red | 409 | AI | CI | — |
| TEST-026 | Parity | Flaky vs BuildPulse | ±10% list overlap | AI | Manual quarterly | shared corpus |
| TEST-027 | Schema | audit_export schema | JSON Schema 2020-12 valid | BE | CI | — |
| TEST-028 | AI eval | Eval gate enforcement | gate fires on regression | AI | CI | bad-prompt fixture |
| TEST-028-A | Drift | PSI > 0.2 alert | alert generated | AI | CI | synthetic shift |
| TEST-028-B | Regression | Replay harness on prior incidents | parity ≥ 95% | AI | CI | replay set |

---

## 7. Review Comment Linkage (RC-001..RC-030 → traces)

See ReviewCommentsRegister doc. Open/Closed/Deferred summary:

| Severity | Open | Closed | Total |
|---|---|---|---|
| Critical | 2 (RC-006, RC-021) | 1 (RC-016) | 3 |
| High | 11 | 6 | 17 |
| Medium | 4 | 5 | 9 |
| Low | 0 | 1 | 1 |
| **Total** | **17** | **13** | **30** |

---

## 8. Enhancement Linkage (IMP-001..IMP-025)

See RecommendedEnhancements doc. Build sequence and effort hours per item.

| IMP | Title | Phase | Effort | RT links |
|---|---|---|---|---|
| IMP-001 | Mask v1 patterns | 1 | 24h | RT-001, RT-008 |
| IMP-002 | OAuth app submission | 1 | 8h | RT-002 |
| IMP-003 | Idempotency-Key middleware | 1 | 12h | RT-015 |
| IMP-004 | Approval signature scheme | 2 | 20h | RT-005 |
| IMP-005 | Evidence ZIP signer | 2 | 32h | RT-006 |
| IMP-006 | Prompt registry mirror | 2 | 24h | RT-009 |
| IMP-007 | EVAL gate CI integration | 2 | 16h | RT-012 |
| IMP-008 | Analytics rollup batch | 3 | 16h | RT-007 |
| IMP-009 | Drift detector PSI | 2 | 28h | RT-003, RT-017 |
| IMP-010 | RBAC matrix | 2 | 20h | RT-014 |
| IMP-011 | Slack/email integration | 2 | 16h | RT-005 |
| IMP-012 | CSV export | 3 | 8h | RT-007 |
| IMP-013 | Approver feedback loop | 3 | 16h | RT-005, RT-003 |
| IMP-014 | Replay/regression harness | 3 | 32h | RT-020 |
| IMP-015 | Chaos test pack | 4 | 40h | RT-010, RT-013 |
| IMP-016 | Secret-scanning provider extension | 2 | 24h | RT-008 |
| IMP-017 | FinOps cost ceiling | 2 | 20h | RT-016 |
| IMP-018 | Demo dry-run + det seed | 3 | 16h | (cross) |
| IMP-019 | On-call rotation pack | 4 | 24h | RT-005 |
| IMP-020 | Risk owner staffing + RLS hardening | 4 | 16h | RT-013 |
| IMP-021 | EU data residency | 4 | 80h | RT-019 |
| IMP-022 | Gold-set governance + label audit | 2-cont | 12h/mo | RT-012 |
| IMP-023 | Model fallback registry | 2 | 24h | RT-003, RT-004 |
| IMP-024 | CS playbook + QBR template | 4 | 24h | RT-018 |
| IMP-025 | Audit-export schema deprecation policy | 3 | 12h | RT-011 |

---

## 9. Data Classification Traceability

| Field | Class | Mask policy | Retention | Consumer |
|---|---|---|---|---|
| raw_intake.body (post-mask) | C3 | Mask v1 pre-write | 18mo + 10y archive | RCA pipeline, evidence pack |
| raw_intake.body (pre-mask) | C4 | n/a — destroyed | 0 | mask engine only |
| repos.repo_url | C2 | none | 24mo | linking, analytics |
| tenant_secrets.pat_encrypted | C4 (encrypted) | n/a | until revoked | OAuth/PAT auth |
| approval_records.justification_text | C5 | none | 10y (Article 18) | evidence pack |
| prompt_runs.input_hash | C3 | hash of masked input | 10y | replay, drift |
| prompt_runs.output | C3 | none | 10y | evidence pack |
| eval_runs.* | C3 | none | 10y | governance |
| kpi_rollups.* | C2 | none | 24mo | analytics |

---

## 10. Permission Traceability

| Role | Permission | API | SCR | Audit log writes |
|---|---|---|---|---|
| viewer | read incidents, KPIs | API-002, API-009 | SCR-001 RO, SCR-007 | access_log |
| intake_user | create intake | API-001 | SCR-001 | intake_meta |
| analyst | view RCA + plan | API-004, API-005 (read) | SCR-003, SCR-004 | access_log |
| approver | sign plan | API-006 | SCR-005 | approval_records |
| security_approver | dual-approve secret rotation | API-006 + scope | SCR-005 | approval_records |
| auditor | export evidence | API-008 | SCR-006 | audit_exports |
| tenant_admin | link repos, manage roles, view all | API-003, API-010, all | SCR-002, admin tabs | all |
| ai_lead | promote prompt | API-010 | admin | prompt_promotions |

Negative permission tests in TEST-014-A.

---

## 11. Prompt Traceability (PR-IDs)

| PR-ID | Version | Eval run | Promotion | Rollback target | Status |
|---|---|---|---|---|---|
| PR-RCA-001 | v1.0.0 | eval_runs#1 (88% dev) | — initial | — | superseded |
| PR-RCA-002 | v1.1.0 | eval_runs#7 (90.4% MVP) | promoted MVP | v1.0.0 | active MVP |
| PR-RCA-003 | v1.2.0 | eval_runs#19 (target 92%) | candidate | v1.1.0 | candidate |
| PR-PLAN-001 | v1.0.0 | eval_runs#2 (82%) | — | — | superseded |
| PR-PLAN-002 | v1.1.0 | eval_runs#8 (85% pilot) | promoted pilot | v1.0.0 | active pilot |

Promotion schema: `{prompt_version, eval_run_id, approver_id, justification, rollback_target, canary_pct, canary_window, decision_timestamp}` — written to `prompt_promotions`, exported as EVID-009.
