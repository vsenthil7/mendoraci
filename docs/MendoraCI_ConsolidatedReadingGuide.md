# MendoraCI_ConsolidatedReadingGuide_20260517_1130

**Document Type:** Consolidated Reading Guide (Per-Persona Reading Order)
**Version:** 2026-05-17 11:30 DEEP

This guide tells each persona what to read, in what order, in what time, and what they should walk away knowing.

---

## 1. Hackathon Judge — 15 minutes

**Goal:** "Does this team have a real product, a real demo, and a real moat?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | ExecutiveSummary | All | 5 min |
| 2 | DemoScript | §2 Golden Path | 3 min |
| 3 | BRD | §1 + §13 commercial | 3 min |
| 4 | MasterMatrix | §3 scored matrix + §9 decision | 2 min |
| 5 | FinalPackageReview | §1 verdict + §2 path to 67 | 2 min |

**Walk away knowing:** MendoraCI is governed-AI CI reliability; 93.2/100 vs 8 competitors; demo-able in 5 min with EU AI Act Article 12 evidence; Tier 1 build-ready.

---

## 2. VP of Engineering (Buyer) — 30 minutes

**Goal:** "Is this real, will it deliver, what's the moat, what's the risk?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | ExecutiveSummary | All | 5 min |
| 2 | BRD | §1 exec, §3 problem/target, §13 commercial | 8 min |
| 3 | MasterMatrix | §3 + §9 + §10 sensitivity | 5 min |
| 4 | RiskRegister | §3 deep-dive critical risks | 5 min |
| 5 | FinalPackageReview | §2 path to 67, §3 RC closure | 5 min |
| 6 | DemoScript | §2 golden path | 2 min |

**Walk away knowing:** −60% MTTR, $3.5M annualized recapture, ACV $48K–$890K, 8×–22× ROI, decision robust under sensitivity scenarios.

---

## 3. Platform Owner (Primary User Admin) — 45 minutes

**Goal:** "Can I operate this thing, what is the failure mode, who pages me at 2am?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | ExecutionControlBook | §1 sigma flow + §4 failure modes | 15 min |
| 2 | ExecutionControlBook | §2 all 7 screen control sheets | 15 min |
| 3 | ObservabilityPack | All | 10 min |
| 4 | ReviewCommentsRegister | RC-007, RC-010, RC-024, RC-026, RC-029 | 5 min |

**Walk away knowing:** ops-tractable; on-call & chaos covered Phase 4; cost ceiling protects margins; runbooks per top-10 failure mode.

---

## 4. AI Lead — 45 minutes

**Goal:** "Are the AI claims real, is the eval governance defensible, what's the regression story?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | Traceability | §5 EVAL-001/002 cards | 10 min |
| 2 | PromptOpsGovernance | All | 15 min |
| 3 | ClaudeAnnex | §3 deep eval cards + §6 data governance | 10 min |
| 4 | RecommendedEnhancements | IMP-007, IMP-009, IMP-014, IMP-022, IMP-023 | 10 min |

**Walk away knowing:** EVAL-001 92% promotion; gold sets N=250, slice-weighted; drift detector PSI > 0.2; canary + auto-rollback; replay harness; label audit κ ≥ 0.75.

---

## 5. GRC / Audit-Sam — 30 minutes

**Goal:** "Does this satisfy EU AI Act, SOC 2, ISO 42001?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | BRD | §14.5 compliance + §16a data governance | 10 min |
| 2 | ClaudeAnnex | §6 data governance + §3 eval cards | 8 min |
| 3 | Traceability | §9 data classification | 5 min |
| 4 | RBACPermissionMatrix | §4 negative tests + §6 separation of duties | 5 min |
| 5 | DemoScript | §2 step 4 (evidence) | 2 min |

**Walk away knowing:** Article 12/14/18 mapped; SOC 2 + ISO 42001 Phase 4 audit; 10-year retention; signed evidence verifiable offline; separation of duties enforced.

---

## 6. Tech Lead (Build) — 90 minutes

**Goal:** "How do I build this in 36 hours?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | BRD | §1, §7 all BRs, §10 phase plan | 20 min |
| 2 | ExecutionControlBook | All | 20 min |
| 3 | Traceability | §1 RT index + §4 API↔DB↔Queue | 10 min |
| 4 | DataModelERD | All | 10 min |
| 5 | APIContractSpec | All | 15 min |
| 6 | TestAutomationMatrix | §3 CI pipeline | 5 min |
| 7 | RecommendedEnhancements | §2 build sequence, §3 value density | 10 min |

**Walk away knowing:** critical path through IMP-001/003/004/007/005/018; 36-hour cut feasible with 4 engineers; deterministic exit gates per BR.

---

## 7. Security Lead — 30 minutes

**Goal:** "What's the secret-leak story, multi-tenancy story, RBAC story?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | BRD | §7 BR-008 masking + §15 risks | 8 min |
| 2 | RBACPermissionMatrix | All | 10 min |
| 3 | DeploymentTopology | §4 multi-tenancy + §7 secrets | 5 min |
| 4 | ReviewCommentsRegister | RC-006, RC-008, RC-014, RC-019, RC-021, RC-022, RC-030 | 5 min |
| 5 | RiskRegister | §3 R-02 + R-08 deep dives | 2 min |

**Walk away knowing:** Mask v1 deny-on-fail + N=500 red-team; RLS + per-tenant DEK + pen-test cadence; 14-row RBAC negative-permission sweep; separation of duties.

---

## 8. CFO — 15 minutes

**Goal:** "What does it cost, what do we save, what's the ROI?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | ExecutiveSummary | §2 + §3 | 5 min |
| 2 | BRD | §1 + §13 commercialization | 8 min |
| 3 | MasterMatrix | §5 commercial + §4 effort/TTV | 2 min |

**Walk away knowing:** $3.5M annualized recapture per 200-dev org; ACV bands $48K–$890K; hybrid pricing benchmarked; expansion path Pilot → Strategic with NDR 130%+ target.

---

## 9. Frontend Lead / UX — 20 minutes

**Goal:** "What am I building, in what order, with what design system?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | UIWireframeSpec | All | 15 min |
| 2 | ExecutionControlBook | §2 screen control sheets | 5 min |

**Walk away knowing:** 7 screens, Next.js + Tailwind + shadcn/ui; state machines per component; WCAG 2.1 AA; mobile breakpoints; demo seed mode.

---

## 10. SRE / Platform Engineering — 30 minutes

**Goal:** "What's the topology, what are the SLOs, what pages me, what's the DR plan?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | DeploymentTopology | All | 15 min |
| 2 | ObservabilityPack | All | 10 min |
| 3 | RiskRegister | R-03, R-08, R-09 | 5 min |

**Walk away knowing:** 99.5%→99.9% SLO trajectory; per-zone network; per-tenant DEK; DR with multi-region replication; 12 named alerts with runbook IDs; quarterly chaos game day Phase 4.

---

## 11. Customer Success Manager — 20 minutes

**Goal:** "How do I run pilot → expansion, what KPIs do I report?"

| Order | Document | Section | Time |
|---|---|---|---|
| 1 | ExecutiveSummary | §2 quantified value | 3 min |
| 2 | BRD | §13.2 sales motion + §13.1 pricing | 5 min |
| 3 | RecommendedEnhancements | IMP-024 CS playbook | 3 min |
| 4 | ObservabilityPack | §4 Customer KPI dashboard | 3 min |
| 5 | ExecutionControlBook | §2 SCR-007 analytics | 4 min |
| 6 | ReviewCommentsRegister | RC-025 QBR template | 2 min |

**Walk away knowing:** Pilot 60-day refundable-if-EVAL-fails motion; expansion path; per-customer Grafana KPI dashboard; QBR template Phase 4.

---

## 12. Cross-Persona — 5-minute pitch

If you have **5 minutes total** for any persona:
1. ExecutiveSummary §1 + §2 (3 min)
2. DemoScript §2 abbreviated (2 min)

That's it. The rest of the package fills in detail.
