# MendoraCI_ExecutiveSummary_20260517_1130

**Document Type:** Executive Summary
**Version:** 2026-05-17 11:30 DEEP
**Audience:** VP Engineering, CFO, hackathon judges
**Read time:** 5 minutes

---

## 1. The One-Paragraph Story

**MendoraCI** turns CI/CD failure resolution from a 4-hour tribal exercise into a 5-minute governed workflow with audit-grade evidence. It sits beside the CI runner, ingests failure artifacts (GitHub Actions, Jenkins, CircleCI, GitLab, Buildkite), and produces (a) AI-driven root-cause classification across 12 classes, (b) structured repair plan with blast-radius and rollback, (c) HITL approval with HMAC-signed ledger, and (d) immutable evidence ZIP compliant with EU AI Act Articles 12/14/18, SOC 2, and ISO 27001/42001. It is the **only** product combining governed AI repair × HITL × signed evidence × PromptOps × deterministic secret masking — a moat no competitor delivers end-to-end.

---

## 2. Quantified Value (per 200-developer enterprise, year 1)

| Dimension | Baseline | Target | Annual value |
|---|---|---|---|
| MTTR for CI failures | 4.2 hrs | ≤ 1.7 hrs (−60%) | **$1.9M** |
| Debugging effort per failure | 38 min | ≤ 25 min (−35%) | $720K |
| Flaky-test recurrence (90-day) | 27% | ≤ 13.5% (−50%) | $410K |
| Evidence completeness | 41% | 100% | $300K audit savings |
| Approval cycle median | 6.4 hrs | ≤ 22 min | $180K risk-adjusted |
| **Total annualized recapture** | | | **~$3.5M** |

**ACV tiers:** Pilot $48K · Team $156K · Enterprise $412K · Strategic $890K+
**ROI band:** 8× to 22× depending on tier
**Pricing model:** hybrid per-committer + governance flat fee

---

## 3. Market Context

- **TAM:** $14.8B (2026) — CI reliability + AI governance intersection
- **SAM:** $1.9B
- **Why now:** EU AI Act Article 12 high-risk logging obligations bind August 2026. DORA 2025 confirms AI coding adoption improves throughput but **increases** delivery instability — exactly the failure mode MendoraCI is built to neutralize.
- **Target segments:**
  1. Regulated enterprise (fintech, healthtech, govtech) — Article 12 + SOC 2 pull
  2. Platform-engineering-mature mid-market (200–1,000 devs) — MTTR + flake pull
  3. AI-forward enterprise — PromptOps governance pull

---

## 4. Competitive Position (8 named competitors)

Weighted master matrix on 11 factors with 100-point scale:

| Rank | Option | Score | Why behind |
|---|---|---|---|
| 1 | **MendoraCI** | **93.2** | — |
| 2 | Datadog CI Visibility + governance overlay | 48.8 | Lacks AI repair, HITL workflow, signed evidence |
| 3 | Trunk Flaky Tests | 43.6 | Flake-only; no RCA breadth; no governance |
| 4 | Generic AI Copilot (Copilot / Q / Cursor) | 43.2 | Wrong layer (IDE); no governance; **raises** CFR per DORA |
| 5 | BuildPulse | 37.2 | Flake-only; no repair plan; no HITL |
| 6 | Sentry | 36.0 | Wrong layer (prod errors, not CI) |
| 7 | CircleCI Insights | 30.8 | Single-provider; no AI repair |
| 8 | Roll-your-own (scripts + Slack) | 14.8 | Compliance-disqualified (Slack ≠ Article 12 evidence) |

**Defensible moat:** combined surface no single competitor delivers. Datadog (closest neighbor) explicitly lacks approval workflows and structured AI repair plans.

---

## 5. Build Readiness

**Tier 1 — Build-ready.** Current score **61/70**. Trajectory:
- **65/70** by Phase 4 mid (IMP-018 demo + IMP-019 on-call + IMP-020 risk owners + IMP-022 label audit)
- **67/70** by Phase 4 end (IMP-021 EU residency + IMP-024 CS playbook)
- **69–70/70** Phase 5 (production-scale evidence)

**Hackathon critical path (36 hours):**
`IMP-001 Mask v1 → IMP-003 Idempotency → IMP-004 Approval signature → IMP-007 EVAL gate CI → IMP-005 Evidence signer → IMP-018 Demo dry-run`

~120 person-hours parallelized across 4-person team. Demo-able golden path through SCR-001..006 + SCR-007 KPI reveal.

---

## 6. Technical Architecture (One-Glance)

- **Frontend:** Next.js 14 + Tailwind + shadcn/ui
- **Backend:** Node.js APIs + Postgres + Redis queue + S3 Object Lock + KMS
- **AI:** IBM Bob AI (primary), model fallback registry (IMP-023), `rca_fallback_v1` rules baseline
- **Observability:** OTel + Prometheus + Grafana, SLO-grade dashboards
- **Security:** Mask Policy v1 (deny-on-fail) + RLS + per-tenant DEK + HMAC-signed approvals & exports
- **PromptOps:** Level 3 maturity — registry + canary + auto-rollback + drift detection (PSI)

---

## 7. Compliance Posture

| Regulation | MendoraCI mechanism | Status |
|---|---|---|
| EU AI Act Article 12 (automatic logging) | `prompt_runs` + `approval_records` immutable, 10y retention | **Mapped** |
| EU AI Act Article 14 (human oversight) | HITL approval ledger, signed | **Mapped** |
| EU AI Act Article 18 (10y tech-doc) | Object-lock storage + audit_exports | **Mapped** |
| SOC 2 Type II | CC1–CC9 controls | **Phase 4 audit scheduled** |
| ISO 27001 / 42001:2023 | Mapped in ClaudeAnnex | **Phase 4 audit scheduled** |
| GDPR | PII-separation architecture; erasure handled | **Mapped** |
| EU data residency | Per-tenant region flag (IMP-021) | **Phase 4** |

---

## 8. Top 3 Risks (and mitigations)

1. **EVAL-001 fails 90% pilot (R-01, score 15)** → Mitigations: monthly label-quality audit IMP-022; `rca_fallback_v1` rules safety net; slice-by-slice eval reporting; eval-set augmentation pipeline
2. **LLM provider outage > 4hr (R-03, score 12)** → Mitigations: model fallback registry IMP-023; rules fallback; cached recent decisions
3. **EU residency demanded pre-Phase-4 (R-10, score 12)** → Mitigations: roadmap pre-sell with target date; deal-desk script; acceleration option if multiple lighthouse customers commit

Full register: R-01..R-12, all owners assigned by Phase 4 mid (IMP-020).

---

## 9. The Demo (60-second elevator version)

1. Drop a 15MB Jenkins log onto SCR-001 → secrets masked deterministically in front of you
2. RCA card: "OOM at 93%" with explainability (line numbers click-through)
3. Repair plan: hypothesis + 2 steps + blast-radius + rollback — **no code auto-applied**
4. Slack notify → approver clicks deep-link → signs with 20-char justification + HMAC
5. Export evidence pack → ZIP downloads, manifest valid, HMAC verifies offline
6. Analytics dashboard: MTTR dropping 4.2h → 1.6h over 30 days

5 minutes flat, deterministic seed, recorded fallback (IMP-018).

---

## 10. The Decision

**Build now, ship pilot in 6 weeks, promote to Enterprise tier in 12 weeks.** The 13-document deliverable establishes scope freeze; the IMP-001..IMP-025 build sequence delivers Tier 1 in 36 hours, Phase 4 readiness by week 12. Three named lighthouse pilot prospects align with target segments (regulated enterprise, platform-engineering mid-market, AI-forward enterprise). Pricing pre-validated against Stripe 2025 enterprise AI-tooling benchmarks and Optifai DevOps ACV data.

**Product name:** MendoraCI. (Throughout. No drift.)

---

## 11. Companion Documents

| Doc | Audience | Read time |
|---|---|---|
| MendoraCI_BRD_20260517_1130 | VPE / Tech Lead | 30 min |
| MendoraCI_Traceability_20260517_1130 | Tech Lead / AI Lead | 20 min |
| MendoraCI_MasterMatrix_20260517_1130 | VPE / CFO | 10 min |
| MendoraCI_ExecutionControlBook_20260517_1130 | Tech Lead / Platform Owner | 45 min |
| MendoraCI_ReviewCommentsRegister_20260517_1130 | PM / QA | 15 min |
| MendoraCI_RecommendedEnhancements_20260517_1130 | Tech Lead / PM | 20 min |
| MendoraCI_FinalPackageReview_20260517_1130 | All personas | 15 min |
| MendoraCI_ClaudeAnnex_20260517_1130 | AI Lead / GRC | 30 min |
| MendoraCI_DataModelERD_20260517_1130 | BE Lead | 15 min |
| MendoraCI_APIContractSpec_20260517_1130 | BE Lead / Integrators | 20 min |
| MendoraCI_UIWireframeSpec_20260517_1130 | FE Lead / UX | 20 min |
| MendoraCI_RBACPermissionMatrix_20260517_1130 | Sec Lead | 10 min |
| MendoraCI_DeploymentTopology_20260517_1130 | SRE / Platform | 15 min |
| MendoraCI_ObservabilityPack_20260517_1130 | SRE / AI Lead | 15 min |
| MendoraCI_PromptOpsGovernance_20260517_1130 | AI Lead | 15 min |
| MendoraCI_TestAutomationMatrix_20260517_1130 | QA / Tech Lead | 10 min |
| MendoraCI_DemoScript_20260517_1130 | PM / Demo driver | 10 min |
| MendoraCI_RiskRegister_20260517_1130 | All personas | 10 min |
| MendoraCI_GlossaryAndAcronyms_20260517_1130 | All | 5 min |
| MendoraCI_ConsolidatedReadingGuide_20260517_1130 | All | 5 min |

Plus three Excel artifacts: MasterMatrix.xlsx, TraceabilityMaster.xlsx, TraceabilityMulti.xlsx.
