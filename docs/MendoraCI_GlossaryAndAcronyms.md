# MendoraCI_GlossaryAndAcronyms_20260517_1130

**Document Type:** Glossary & Acronyms
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Product Term Glossary

| Term | Definition |
|---|---|
| **MendoraCI** | The product. AI-powered CI/CD reliability platform with HITL governance and audit-grade evidence. *(Note: do not confuse with any earlier hallucinated name — the product is and always has been MendoraCI.)* |
| **Intake** | A submitted CI failure artifact (log, JUnit XML, workflow config, env snapshot) that begins the MendoraCI flow at SCR-001 |
| **Mask Policy** | Versioned set of regex + entropy + provider patterns applied pre-persist to redact secrets. v1 ships in MVP; IMP-016 extends with more providers |
| **RCA Card** | SCR-003 UI element showing classified root cause, confidence, top-3 alternatives, and explainability rationale |
| **Repair Plan** | SCR-004 structured artifact: hypothesis, ordered typed steps, blast-radius, rollback, required approver role. JSON-schema-validated |
| **Approval Record** | Append-only `approval_records` row with operator_id, signed_at, justification_text (≥ 20 chars), plan_hash, hmac_signature. Article 12-grade evidence |
| **Evidence Pack** | Signed ZIP exported via SCR-006 containing manifest.json, masked artifacts, RCA, plan, approval, eval-pin, prompt-pin, mask-pin |
| **EVAL-001** | AI evaluation for root-cause classification. Slice-weighted macro-F1. MVP 85% / Pilot 90% / Promotion 92% |
| **EVAL-002** | AI evaluation for repair-plan usefulness. Approver-acceptance rate with ≤ 1 minor edit. MVP 80% / Pilot 85% / Promotion 88% |
| **Gold Set** | Immutable versioned dataset of labeled examples used for EVAL gates. N=250 minimum per evaluation |
| **PromptOps** | Governance model for prompts: versioned, eval-gated, canaried, rollback-able. MendoraCI targets Level 3 maturity (canary + auto-rollback) |
| **Prompt Run** | Single inference record in `prompt_runs` pinning prompt_version, model_id, gold_set_version, mask_policy_version, input_hash, output, confidence |
| **HITL** | Human-in-the-loop — the named, signed approval step required before any repair plan executes |
| **Blast Radius** | Field on each repair-plan step estimating impact scope (low / medium / high). Drives required-approver-role resolution |
| **Slice-weighted macro-F1** | Primary EVAL-001 metric: macro-F1 averaged across slice definitions with equal weights to neutralize imbalance |
| **PSI** | Population Stability Index — drift statistic on input distribution; alert threshold > 0.2 |
| **Fallback Registry** | IMP-023 mapping of primary → secondary LLM → rules-baseline `rca_fallback_v1` for vendor resilience |
| **`rca_fallback_v1`** | Deterministic rules-baseline classifier shipped as safety net under all LLM-outage paths. ≈58% accuracy baseline |
| **Tenant Region Flag** | IMP-021 per-tenant configuration for data-residency (us-east-1 / eu-west-1) |
| **Cost Ceiling** | IMP-017 per-tenant LLM-spend cap (soft 80%, hard 100% throttle) |
| **Replay Harness** | IMP-014 system that re-runs prior incidents against new prompts/models to catch regressions |
| **Lineage Chain** | JSONB on each artifact: `intake_id → rca_run_id → plan_id → approval_id → export_id`. End-to-end queryable |
| **Idempotency-Key** | Required header on POST writes; dedupes within 24h on `(tenant_id, key)` |
| **Plan Hash** | SHA-256 of repair-plan JSON at time of notification. Drift after notify invalidates approval token |
| **`rca_fallback_v1`** | Deterministic rules-only RCA used when LLM is unavailable; produces governed output, not high accuracy |
| **Approval Token** | 4-hour-valid token issued at notify time; required on API-006 sign call |
| **`audit_export.schema.v1.json`** | Versioned JSON Schema 2020-12 for the manifest in every evidence pack; versioned; ≥ 6mo deprecation window |
| **Promotion Decision** | Row in `prompt_promotions` capturing approver, justification, rollback target, eval run, canary parameters |
| **Drift Detector** | IMP-009 — daily PSI + chi-square on input feature and output class distributions; alerts on threshold breach |
| **Tier 1** | Hackathon readiness classification: build-ready, demo-able, governance-grade evidence packs |
| **`AcmePilot`** | Canonical demo tenant; seeded by `seeds/acmepilot.sql` for deterministic demo state (IMP-018) |

---

## 2. Identifier Prefix Map

| Prefix | Meaning | Range |
|---|---|---|
| **BG** | Business Goal | BG-001..BG-006 |
| **BR** | Business Requirement | BR-001..BR-012 |
| **US** | User Story | US-001..US-034 |
| **SCR** | Screen | SCR-001..SCR-007 |
| **API** | Backend API | API-001..API-010 |
| **DB** | Database entity | DB-001..DB-018 |
| **TEST** | Test case | TEST-001..TEST-028 (+ sub-tests A/B) |
| **EVID** | Evidence artifact | EVID-001..EVID-014 |
| **RC** | Review Comment | RC-001..RC-030 |
| **IMP** | Enhancement | IMP-001..IMP-025 |
| **EVAL** | AI evaluation | EVAL-001 (RCA), EVAL-002 (plan) |
| **RT** | Trace row | RT-001..RT-020 |
| **OPT** | Comparative option | OPT-001..OPT-008 |
| **PR** | Prompt version | PR-RCA-00x (RCA), PR-PLAN-00x (plan) |
| **R** | Risk | R-01..R-12 |

---

## 3. Compliance & Regulatory Acronyms

| Acronym | Expansion | Relevance |
|---|---|---|
| **EU AI Act** | Regulation (EU) 2024/1689 — first comprehensive AI law | Articles 12 (logging), 14 (oversight), 18 (retention) bind MendoraCI |
| **Article 12** | EU AI Act Article 12 — automatic logging over lifetime, min 6mo retention for high-risk systems | MendoraCI default 10y |
| **Article 14** | EU AI Act Article 14 — human oversight requirement | HITL approval workflow satisfies |
| **Article 18** | EU AI Act Article 18 — 10-year tech-doc retention | Evidence packs + prompt registry retention |
| **ISO 27001** | Information Security Management System standard | SOC 2 + ISO 27001 dual-track Phase 4 |
| **ISO 42001:2023** | AI Management System standard | MendoraCI controls mapped in ClaudeAnnex §6 |
| **SOC 2** | AICPA Service Organization Controls Type II report | Phase 4 scoped audit |
| **GDPR** | General Data Protection Regulation (EU) | Article 17 erasure handled via PII-separation pattern |
| **DORA** | DevOps Research and Assessment State of DevOps report | 2025 finding: AI raises CFR — MendoraCI's wedge |
| **CC1–CC9** | SOC 2 Common Criteria | MendoraCI controls mapped Phase 4 |
| **FedRAMP** | US federal cloud security framework | Phase 5 track for government segment |

---

## 4. Technical Acronyms

| Acronym | Expansion |
|---|---|
| **CI** | Continuous Integration |
| **CD** | Continuous Delivery/Deployment |
| **CFR** | Change Failure Rate (DORA metric) |
| **MTTR** | Mean Time To Resolution |
| **HITL** | Human-In-The-Loop |
| **RCA** | Root Cause Analysis |
| **RBAC** | Role-Based Access Control |
| **RLS** | Row-Level Security (Postgres) |
| **DEK** | Data Encryption Key |
| **KMS** | Key Management Service |
| **HMAC** | Hash-based Message Authentication Code |
| **HSM** | Hardware Security Module |
| **JWT** | JSON Web Token |
| **PAT** | Personal Access Token (GitHub) |
| **OAuth** | Open Authorization |
| **SAML** | Security Assertion Markup Language |
| **SCIM** | System for Cross-domain Identity Management |
| **SSO** | Single Sign-On |
| **TLS** | Transport Layer Security |
| **AES** | Advanced Encryption Standard |
| **GCM** | Galois/Counter Mode |
| **SHA** | Secure Hash Algorithm |
| **OTel** | OpenTelemetry |
| **SLO** | Service Level Objective |
| **SLA** | Service Level Agreement |
| **DR** | Disaster Recovery |
| **RPO** | Recovery Point Objective |
| **RTO** | Recovery Time Objective |
| **DLQ** | Dead Letter Queue |
| **PSI** | Population Stability Index |
| **ECE** | Expected Calibration Error |
| **IAA** | Inter-Annotator Agreement (κ — Cohen's kappa) |
| **PR** | Pull Request (Git) OR Prompt Run (MendoraCI) — context disambiguates |
| **ACV** | Annual Contract Value |
| **NDR** | Net Dollar Retention |
| **TAM** | Total Addressable Market |
| **SAM** | Serviceable Addressable Market |
| **QBR** | Quarterly Business Review |
| **VPE** | VP of Engineering |
| **CSM** | Customer Success Manager |
| **SRE** | Site Reliability Engineer |
| **GRC** | Governance, Risk, and Compliance |
| **OOM** | Out Of Memory (a classic CI failure class) |

---

## 5. Disambiguation Notes

- **"PR"** appears as both Pull Request and Prompt Run; context disambiguates. Most documents use `PR-RCA-NNN` or `PR-PLAN-NNN` exclusively for Prompt Run version IDs.
- **"Plan"** refers to a structured repair plan (the AI-generated artifact in SCR-004), not a project plan.
- **"Eval"** refers to AI evaluation (EVAL-001/002), not employee evaluation.
- **"Approval"** in MendoraCI is always a HITL approval of a repair plan; not Pull-Request approval (though GitHub PR approval may be a step within a plan).
