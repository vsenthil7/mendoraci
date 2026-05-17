# MendoraCI_ClaudeAnnex_20260517_1130

**Document Type:** Claude Annex — Competitive, Readiness, AI Eval, Operating Models, Glossary
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Competitive Annex (Deep Feature-Proximity Breakdown)

### 1.1 BuildPulse (OPT-003)

| Feature surface | Proximity | Notes |
|---|---|---|
| Flaky test detection | 90% | Git-tree-SHA + statistical thresholding; mature |
| Quarantine workflow | 80% | Automated quarantining; Jira integration |
| RCA across non-flaky classes | 5% | Out of scope |
| Repair-plan generation | 0% | Not a BuildPulse feature |
| HITL approval ledger | 0% | None |
| Evidence pack export | 5% | Some logs but no signed manifest |
| PromptOps governance | 0% | No AI in current scope |
| Secret masking | 30% | Doesn't access source code |
| **Overall proximity** | **~32%** | BuildPulse owns flake narrowly; MendoraCI subsumes via BR-010 |

### 1.2 Trunk Flaky Tests (OPT-004)

| Surface | Proximity | Notes |
|---|---|---|
| Flake detection | 85% | Strong analytics, PR-comment integration |
| Quarantine | 90% | Intuitive UI; auto-quarantine |
| RCA breadth | 10% | Some hints but narrow |
| Repair plan | 0% | None |
| HITL approval | 5% | PR comment is not a signed ledger |
| Evidence pack | 0% | None |
| **Overall** | **~38%** | Same shape as BuildPulse; richer integrations |

### 1.3 Datadog CI Visibility + Test Optimization (OPT-006)

| Surface | Proximity | Notes |
|---|---|---|
| Pipeline observability | 95% | Best-in-class flame graphs, correlation |
| Flake detection | 90% | Mature, with Test Impact Analysis |
| RCA breadth (AI-driven) | 30% | "Domain" grouping but no QA-actionable classification |
| Repair plan | 0% | Not in Datadog scope |
| HITL approval workflow | 0% | Lacks features designed for QA team collaboration like approval workflows |
| Evidence pack | 35% | Logs + audit trails exist but not incident-bound signed pack |
| PromptOps governance | 0% | No prompts; Datadog is observability not AI |
| Secret masking | 60% | Standard log scrubbing |
| RBAC / SSO / compliance | 95% | Enterprise-grade |
| **Overall** | **~55%** | Closest commercial neighbor; lacks AI repair + HITL + signed evidence |

### 1.4 CircleCI Insights (OPT-007)

Pipeline dashboards but single-provider (CircleCI only) and no AI-driven RCA or repair-plan generation. Proximity ~24%.

### 1.5 Generic AI Copilot (Copilot / Amazon Q / Cursor) (OPT-005)

Operate at IDE / code-suggestion layer, not CI-failure-resolution. Lack: tenant scope, HITL, evidence, secret-masking determinism, prompt governance. DORA 2025 report: AI coding adoption **improves throughput but increases delivery instability** — the failure mode MendoraCI is designed to neutralize. Proximity ~28%.

### 1.6 Roll-Your-Own (OPT-002)

Scripts + Slack approvals + Jira tickets. EU AI Act Article 12 guidance: "A Slack thread saying 'ok approved' is not Article 12 evidence. Approvals must be structured records with operator identity and timestamp, queryable." Proximity ~18%; eliminated on compliance grounds.

### 1.7 Sentry (OPT-008)

Production-layer error correlation; not a CI-failure-resolution product. Proximity ~22%.

### 1.8 Competitive moat synthesis

MendoraCI's defensible moat = **{ governed AI repair × HITL ledger × signed evidence × PromptOps × secret masking }** — a product surface no single competitor delivers. Datadog (closest) lacks repair planning, HITL, signed evidence; BuildPulse/Trunk lack repair planning and HITL; Copilot/Q lack governance entirely.

---

## 2. Readiness Scorecard with Sub-Scoring

### 2.1 Sub-scoring per dimension

| Dimension | Sub-factors | Current sub-scores (each /7) | Aggregate |
|---|---|---|---|
| 1. Problem clarity | persona, baseline method, KPI definition | 7 / 7 / 7 | **7** |
| 2. AI necessity | classification need, generation need, fallback rule baseline | 7 / 7 / 7 | **7** |
| 3. Data readiness | gold-set size, label provenance, slice coverage, audit cadence | 7 / 7 / 6 / 4 | **6** (lift via IMP-022) |
| 4. Technical feasibility | stack maturity, infra reuse, team skill | 7 / 7 / 7 | **7** |
| 5. Auditability | manifest schema, signing, retention, traceability | 7 / 7 / 7 / 7 | **7** |
| 6. Compliance | SOC 2 mapping, ISO 42001 mapping, Article 12 mapping, EU residency | 6 / 7 / 7 / 4 | **6** (lift via IMP-021) |
| 7. Demo | golden path, deterministic seed, fallback video | 7 / 5 / 6 | **6** (lift via IMP-018) |
| 8. Commercialization | tiers, ACV bands, sales motion, channel | 7 / 7 / 6 / 4 | **6** (lift via IMP-024) |
| 9. Operational readiness | observability, on-call, chaos | 7 / 4 / 4 | **5** (lift via IMP-019, IMP-015) |
| 10. Risk management | register quality, owner staffing, review cadence | 7 / 3 / 3 | **4** (lift via IMP-020) |
| **Total** | | | **61 → 67 trajectory** |

### 2.2 Trajectory

```mermaid
flowchart LR
    A[61/70 today] -->|IMP-018, 022| B[63/70 Phase 3 end]
    B -->|IMP-019, 020| C[65/70 Phase 4 mid]
    C -->|IMP-021, 024| D[67/70 Phase 4 end]
    D -->|Production-scale evidence| E[69-70/70 Phase 5]
```

---

## 3. AI Evaluation Cards — Deep Expanded

### EVAL-001 — Root-Cause Classification

| Attribute | Value |
|---|---|
| Task type | Multi-class classification with multi-label option |
| Classes | 12: flaky, dep-drift, infra, secret, env, race, oom, code-defect, config, network, timeout, external-service |
| Primary metric | Slice-weighted macro-F1 |
| MVP threshold | 85% |
| Pilot threshold | 90% |
| Promotion target | 92% |
| Gold-set composition | N=250: 12 classes × ≥15 each + 30% adversarial slice (truncated, mixed-cause, non-English) |
| Gold-set governance | Versioned `gold_sets.v1.x`, immutable, object-lock storage |
| Label provenance | 2-of-2 IAA + 3rd-annotator tiebreak; recorded with annotator IDs |
| Slice definitions | (a) class, (b) provider, (c) language, (d) log-length quartile, (e) repo-age quartile |
| Fairness checks | No provider slice < 80%; no language slice < 80%; flaky/non-flaky parity within 5pp |
| Drift detection | PSI on input feature distribution; chi-square on output class distribution; alert PSI > 0.2 |
| Retraining trigger | Slice degradation > 3pp 7-day OR PSI > 0.2 sustained 48hr |
| Prompt version registry rule | Each prompt_version immutable; new requires EVAL gate green + AI Lead approval |
| Eval-set refresh cadence | Quarterly, with novel-failure feedback from manual_review queue |
| Label-quality audit | Monthly 5% blind re-label, target Cohen κ ≥ 0.75 |
| Owner | AI Lead |
| Escalation | AI Lead → VPE → CTO |

### EVAL-002 — Repair-Plan Usefulness

| Attribute | Value |
|---|---|
| Task type | Structured generation with usefulness binary judgment |
| Primary metric | Usefulness rate (approver accepts plan with ≤ 1 minor edit) |
| Hard-gate metrics | Schema validity = 100%; Hallucinated-file rate = 0 |
| MVP / Pilot / Promotion | 80% / 85% / 88% |
| Gold-set | N=250 historical incidents with approved-plan ground truth or expert-authored |
| Slice definitions | (a) root-cause class, (b) plan-action-type, (c) blast-radius, (d) language |
| Fairness | Usefulness parity across action-type slices within 8pp |
| Drift detection | Schema-validity trend; rejection-reason free-text clustering |
| Retraining trigger | Usefulness < threshold for any slice 7-day OR any hallucinated-file event |
| Eval-set refresh | Quarterly; rejected plans with reasons feed candidate-additions |
| Label-quality audit | Monthly; reviewer agreement κ ≥ 0.70 (subjective task tolerates lower) |
| Owner | AI Lead |

---

## 4. PromptOps Operating Model

Aligned to PromptOps maturity Level 3 (canary + auto-rollback).

### 4.1 Roles
- **Prompt Author:** drafts new prompts; PRs to `/prompts/` in Git
- **Eval Owner (AI Lead):** owns gold sets, reviews EVAL runs
- **Promotion Approver (AI Lead + VPE for major):** signs `prompt_promotions` row

### 4.2 Lifecycle
1. **Draft:** new prompt in feature branch
2. **Eval CI run:** EVAL-001/002 gates execute against current gold sets; results to `eval_runs`
3. **Review:** AI Lead reviews slice scorecard
4. **Canary:** 5% of inferences route to candidate for 24 hours; metric divergence monitored
5. **Promote or rollback:** if canary metrics within ±2pp of incumbent → promote; else rollback
6. **Rollback:** any sub-gate fail post-promotion → auto-rollback to `superseded_by`; target ≤ 30s

### 4.3 Governance artifacts
- `prompts` table: immutable rows per version
- `prompt_promotions`: append-only decision ledger
- `prompt_runs`: every inference logs prompt_version + model_id + gold_set_version + mask_policy_version
- `prompt_canaries`: per-canary metric snapshots

### 4.4 Compliance fit
Satisfies EU AI Act Article 12 ("automatic logs over lifetime") and Article 14 ("established procedures for human oversight").

---

## 5. Runtime Governance Operating Model

### 5.1 Pillars
1. **Pre-inference:** secret masking (Mask Policy v1+ext) blocks before any LLM call
2. **Inference:** every call captured to `prompt_runs` with full pins
3. **Post-inference:** confidence calibration; sub-threshold → human-review queue
4. **HITL gate:** every plan requires signed approval; secret-rotation requires security-approver; prod-touching requires dual approval
5. **Egress:** every signed evidence ZIP HMAC-signed and persisted to immutable object storage with 10-year retention

### 5.2 Failure isolation
- LLM outage → model fallback registry IMP-023
- Mask failure → block, no fallback (deny-on-fail)
- Approval signing key down → block exports, page on-call

### 5.3 Observability
OTel spans across runtime: `intake.accept → mask.apply → rca.inference → plan.generate → approval.notify → approval.sign → evidence.sign`. Each span carries tenant_id, prompt_version, model_id, gold_set_version.

---

## 6. Data Governance Operating Model

### 6.1 Classification (mirrors BRD §16a.5)
C1 public → C2 internal → C3 confidential (default for logs post-mask) → C4 restricted (secrets pre-mask, never persisted) → C5 personal (limited).

### 6.2 Retention
- Active operational data (intakes, RCA, plans): 18 months active + 10 years archive in immutable tier
- Tech docs / evidence packs: 10 years (EU AI Act Article 18)
- PII (approver email, name): subject to GDPR erasure; tech-doc trail anonymized after erasure (architectural separation of personal data from audit trail)
- Automatic logs (prompt_runs, approval_records): minimum 6 months (Article 12 floor); MendoraCI default 10 years

### 6.3 Lineage
`lineage_chain` JSONB on every artifact: `intake_id → rca_run_id → plan_id → approval_id → export_id`. End-to-end queryable.

### 6.4 Gold-set governance
- Version-immutable; promotion requires AI Lead approval + label-quality audit κ ≥ 0.75
- Object-lock storage; no deletion possible
- Quarterly refresh with novel-failure additions; old versions retained 10 years

### 6.5 Eval governance
- `eval_runs` immutable; one row per (prompt_version, model_id, gold_set_version, timestamp)
- Promotion decisions captured to `prompt_promotions` with approver, justification, rollback target

### 6.6 Cross-border / residency
Phase 4: per-tenant `region` flag (`us-east-1` default, `eu-west-1` available); enforces all writes to regional Postgres + object storage.

---

## 7. Glossary of MendoraCI-Specific Terms

| Term | Definition |
|---|---|
| **Intake** | A submitted CI failure artifact that begins the MendoraCI flow at SCR-001 |
| **Mask Policy v1** | The deterministic regex + entropy + provider-pattern mask applied pre-persist. Versioned; pinned in every prompt_run |
| **RCA Card** | SCR-003 UI element showing classified root cause, confidence, top-3 alternatives, and explainability rationale |
| **Repair Plan** | SCR-004 structured artifact with hypothesis, ordered typed steps, blast-radius, rollback, required approver role. JSON-schema-validated |
| **Approval Record** | Append-only row in `approval_records` capturing operator_id, timestamp_utc, justification_text, plan_hash, HMAC signature. Article 12-grade evidence |
| **Evidence Pack** | Signed ZIP exported via SCR-006 containing manifest, masked artifacts, RCA, plan, approval, eval pins, prompt pins |
| **EVAL-001 / EVAL-002** | Two AI evaluations: root-cause classification (target 92%) and repair-plan usefulness (target 88%) |
| **Gold Set** | Immutable versioned dataset of labeled examples used for EVAL gates |
| **PromptOps** | Governance model for prompts: versioned, eval-gated, canaried, rollback-able |
| **Prompt Run** | A single inference record pinning prompt_version + model_id + gold_set_version + mask_policy_version |
| **HITL** | Human-in-the-loop — the named, signed approval step required for any repair-plan execution |
| **Blast Radius** | Field on each repair-plan step estimating impact scope (low / medium / high) |
| **Slice-weighted macro-F1** | Primary EVAL-001 metric: macro-F1 averaged across slice definitions with equal weights to neutralize imbalance |
| **PSI** | Population Stability Index — drift statistic on input distribution; alert threshold 0.2 |
| **Fallback Registry** | IMP-023 mapping of primary → secondary LLM → rules-baseline for resilience |
| **`rca_fallback_v1`** | Deterministic rules-baseline classifier shipped as safety net under all LLM-outage paths |
| **Tenant Region Flag** | IMP-021 per-tenant configuration for data-residency (us-east-1 / eu-west-1) |
| **Cost Ceiling** | IMP-017 per-tenant LLM-spend cap (soft 80%, hard 100%) |
| **Replay Harness** | IMP-014 system re-running prior incidents against new prompts/models to catch regressions |
| **Article 12** | EU AI Act automatic logging requirement for high-risk AI systems, min 6-month retention; binding compliance anchor |
| **Article 14** | EU AI Act human oversight requirement; HITL approval workflow satisfies |
| **Article 18** | EU AI Act 10-year tech-doc retention for high-risk AI providers |
| **PromptOps Level 3** | Maturity level featuring canary + auto-rollback; MendoraCI's target operating state |
