# MendoraCI_BRD_20260517_1130

**Product:** MendoraCI — AI-Powered CI/CD Reliability Platform
**Document:** Business Requirements Document (Deep Enhancement Pass)
**Version:** 2026-05-17 11:30 DEEP
**Status:** Tier 1 — frozen for build; trajectory 61/70 → 67/70

---

## 1. Executive Summary

MendoraCI is an enterprise-grade, AI-augmented CI/CD reliability platform that converts noisy, multi-source CI failure logs into governed, evidence-backed repair actions. It sits beside (not inside) the CI runner — ingesting failure artifacts from GitHub Actions, Jenkins, CircleCI, GitLab CI and Buildkite — and produces (a) deterministic root-cause classification, (b) human-reviewable repair plan, (c) HITL approval ledger, and (d) immutable evidence package fit for SOC 2, ISO 27001/42001, and EU AI Act Articles 12, 14, 18.

**Quantified value (per 200-developer enterprise, year 1):**

| Dimension | Baseline | Target | Annualized value (USD) |
|---|---|---|---|
| MTTR for CI failures | 4.2 hrs | ≤ 1.7 hrs (−60%) | $1.9M |
| Debugging effort per failure | 38 min | ≤ 25 min (−35%) | $720K |
| Flaky test recurrence (90-day) | 27% | ≤ 13.5% (−50%) | $410K |
| Evidence completeness | 41% | 100% | $300K audit savings |
| Approval cycle median | 6.4 hrs | ≤ 22 min | $180K risk-adjusted |
| **Total annualized recapture** | | | **~$3.5M** |

**Commercial framing:** TAM $14.8B (2026); SAM $1.9B (CI reliability + AI governance intersection); ACV tiers $48K Pilot / $156K Team / $412K Enterprise / $890K+ Strategic. Currency USD.

**Why now:** EU AI Act Article 12 high-risk logging obligations bind August 2026. DORA 2025 confirms AI coding adoption improves throughput but *increases* delivery instability — the wedge MendoraCI exploits.

---

## 2. Identifier Map

| Prefix | Meaning | Range |
|---|---|---|
| BG | Business Goal | BG-001..BG-006 |
| BR | Business Requirement | BR-001..BR-012 |
| US | User Story | US-001..US-034 |
| SCR | Screen | SCR-001..SCR-007 |
| API | Backend API | API-001..API-010 |
| DB | DB entity | DB-001..DB-018 |
| TEST | Test case | TEST-001..TEST-028 |
| EVID | Evidence artifact | EVID-001..EVID-014 |
| RC | Review Comment | RC-001..RC-030 |
| IMP | Enhancement | IMP-001..IMP-025 |
| EVAL | AI evaluation | EVAL-001, EVAL-002 |
| RT | Trace row | RT-001..RT-020 |
| OPT | Comparative option | OPT-001..OPT-008 |
| PR | Prompt version | PR-RCA-00x, PR-PLAN-00x |
| R | Risk | R-01..R-12 |

---

## 3. Problem, Current State, Target State, Success Metrics

### 3.1 Problem Definition
Enterprise CI pipelines fail for heterogeneous reasons — flaky tests, infra blips, dependency drift, secret rotation, environment drift, race conditions, container OOMs, code defects. Today, triage is **person-bound, undocumented, unaudited**:

1. **Diagnosis is tribal** — senior engineers read raw logs in CI UIs; no canonical root-cause taxonomy.
2. **Repair is unconstrained** — engineers patch on `main` or rerun jobs; no governed plan, no approval trail.
3. **Evidence is missing** — when an EU AI Act conformity assessor asks "show me how you decided to retry this deploy and who approved it," the answer is "look in Slack" — explicitly *not* Article 12 evidence.
4. **Generic AI tools make this worse** — Copilot, Amazon Q, Cursor generate plausible patches without governance, lineage, or HITL — DORA 2025 confirms this raises change-failure-rate.

### 3.2 Current State Baseline Measurement Methodology (10-day Baseline Probe)

| Metric | Source | Sample frame | Statistical treatment |
|---|---|---|---|
| MTTR | CI provider API `completed_at − failure_first_seen_at` | All `failed` workflow runs on default branch, 90-day window | Median + p75; outlier trim 1% |
| Debugging effort | Engineer self-report (Slack bot) + git-blame heuristic | 1-in-5 failures, min N=120 | Mean + 95% CI; report N |
| Flaky recurrence | Test history; flaky = pass+fail on same git tree SHA | All test cases, 90-day rolling | Disruption frequency % |
| Evidence completeness | Manual inventory: per failure, presence of {root-cause doc, fix-rationale, approver, before/after, mask attestation} | Random N=30 | Score 0–5, avg ≥ 4 = "complete" |
| Approval cycle time | Slack/Jira ticket → "approved" reaction or transition | All change approvals, 30 days | Median + p90 |

### 3.3 Target State (day 90 post-pilot)
Single canonical surface (SCR-001) → deterministic secret masking pre-inference → two-stage AI (RCA → repair plan) → HITL approval ledger (SCR-005) → signed evidence ZIP (SCR-006) → board-level KPIs (SCR-007).

### 3.4 Success Metrics & Exit Gates

| KPI | MVP exit | Pilot exit | Promotion gate |
|---|---|---|---|
| EVAL-001 root-cause accuracy | ≥ 85% | ≥ 90% | ≥ 92% |
| EVAL-002 repair-plan usefulness | ≥ 80% | ≥ 85% | ≥ 88% |
| Evidence completeness | 100% demo path | 100% pilot pipelines | 100% all tenants |
| MTTR reduction | n/a | ≥ 40% pilot | ≥ 60% |
| Approval median latency | n/a | ≤ 60 min | ≤ 22 min |
| Secret-leak in AI inference | 0 | 0 | 0 (hard gate) |
| Audit-pack generation success | 100% demo | ≥ 99% | ≥ 99.9% |

---

## 4. Stakeholders & Personas

| Persona | Role | Pain | KPI focus |
|---|---|---|---|
| Priya — VP Engineering | Primary buyer | "I can't tell my CTO why reliability regresses under AI adoption" | MTTR, CFR, audit-readiness |
| Marcus — Platform Owner | Primary user (admin) | "I'm the human pager for every flaky escalation" | Evidence completeness, recurrence |
| Lin — Senior SRE / Approver | HITL approver | "I get pinged with no context and rubber-stamp" | Approval cycle time, plan usefulness |
| Dev — Backend Engineer | Repair plan consumer | "I waste an hour reading logs before touching code" | Debugging time |
| Audit-Sam — GRC | Evidence consumer | "We have an EU AI Act gap on automated logs" | Evidence pack completeness, retention |
| Renee — CFO | Budget holder | "ACV vs. avoided cost?" | ROI |

---

## 5. Scope (In / Out)

**In scope (build):** SCR-001..SCR-007, API-001..API-010, EVAL-001/002 with gold sets ≥ 250 each, Mask Policy v1, evidence ZIP exporter v1, GitHub OAuth app + PAT fallback, Slack/email approval notification.

**Out of scope (parked):** auto-merging PRs without HITL, GitLab/Bitbucket repo linking (Phase 4), on-prem deployment (Phase 5), fine-tuned proprietary model (uses IBM Bob AI), customer gold-set ingestion UI, SAML/SCIM (Phase 4), EU data residency (Phase 4 — IMP-021).

---

## 6. Business Goals & BG → BR Weighted Contribution

| ID | Goal | Quantification | Owner | Linked BRs |
|---|---|---|---|---|
| BG-001 | Reduce MTTR | −60% vs baseline | VPE | BR-001, BR-003, BR-005 |
| BG-002 | Reduce debugging effort | −35% min/failure | Platform | BR-002, BR-004 |
| BG-003 | Reduce flaky-test recurrence | −50% 90-day | Platform | BR-003, BR-006, BR-010 |
| BG-004 | 100% evidence completeness | All HITL signed & exportable | GRC | BR-007, BR-008, BR-011 |
| BG-005 | AI governance posture | EVAL gates + registry live | AI Lead | BR-009, BR-012 |
| BG-006 | Demonstrable ROI | ≥ 5× ACV in recaptured hours | CFO | All BRs |

### 6.1 BG → BR contribution (cols sum 100% per BG)

| BR ↓ / BG → | BG-001 | BG-002 | BG-003 | BG-004 | BG-005 | BG-006 |
|---|---|---|---|---|---|---|
| BR-001 Intake | 25% | 20% | 10% | 10% | 5% | 10% |
| BR-002 Repo Linking | 10% | 15% | 5% | 10% | 5% | 5% |
| BR-003 RCA | 25% | 20% | 20% | 10% | 15% | 15% |
| BR-004 Repair Plan | 15% | 25% | 15% | 10% | 15% | 15% |
| BR-005 HITL Approval | 10% | 5% | 5% | 25% | 20% | 15% |
| BR-006 Evidence Export | 5% | 5% | 5% | 30% | 15% | 10% |
| BR-007 Analytics | 5% | 5% | 15% | 5% | 10% | 15% |
| BR-008 Masking | — | — | — | 5% | 20% | 5% |
| BR-009 PromptOps | — | — | 5% | — | 25% | 5% |
| BR-010 Flaky Detection | 5% | 5% | 20% | — | 5% | 5% |
| BR-011 Audit Schema | — | — | — | 5% | — | — |
| BR-012 Eval Gates | — | — | — | — | 15% | — |

---

## 7. Functional Requirements — BR-001..BR-012

### BR-001 — CI Log Intake
**Statement:** Accept CI failure artifacts (logs ≤ 50 MB compressed, JUnit/XCTest/Surefire XML, workflow YAML, env snapshot) via (a) GitHub webhook, (b) Jenkins post-build script, (c) direct upload UI.
**Acceptance:** AC-1 webhook 5s p95; AC-2 idempotent on `(provider, run_id, attempt_id)`; AC-3 mask BEFORE persist; AC-4 reject >50MB → 413.
**Edge cases:** truncated logs; multi-job workflows; matrix runs; base64 binary embedded.
**Negative paths:** unsigned webhook → 401; replay within 5min → 409; malformed XML → 422 with `validation_errors[]`.
**Exit gate:** TEST-001..004 green; EVID-001 sample intake.

### BR-002 — Repository Linking
**Statement:** Tenant admin links 1..N GitHub repos via OAuth app (preferred) or PAT (fallback) with per-repo read-only scope on contents, checks, actions, pull_requests.
**Acceptance:** AC-1 OAuth callback issues per-tenant install token; AC-2 PAT stored encrypted (AES-256-GCM, KMS-rooted); AC-3 link verify ≤ 10s.
**Edge cases:** revoked tokens; archived repos; private repos in different orgs; rate-limit (5000/hr) with backoff.
**Negative paths:** invalid PAT → 403 + "rotate-token" CTA; org SSO required → 403 + "request SSO bypass" hint.
**Exit gate:** TEST-005..007.

### BR-003 — Root Cause Analysis
**Statement:** Classify intake into 12-class taxonomy (flaky, dep-drift, infra, secret, env, race, oom, code-defect, config, network, timeout, external-service) using EVAL-001 model; confidence ≥ 0.70 → auto-classify; else "needs human review."
**Acceptance:** AC-1 inference p95 ≤ 8s; AC-2 top-3 classes with probabilities; AC-3 every inference writes `prompt_run` row pinning prompt_version, model_id, gold_set_version, mask_policy_version; AC-4 sub-threshold → manual_review queue SLA 30 min.
**Edge cases:** mixed-cause (multi-label, primary + secondary); non-English logs; very short logs (<200 chars) → low-confidence.
**Negative paths:** model timeout (>30s) → fallback `rca_fallback_v1` rules classifier; LLM refusal → log + manual review.
**Exit gate:** EVAL-001 ≥ 85% (MVP) / 90% (pilot) / 92% (promotion) on slice-weighted gold set.

### BR-004 — Repair Plan Generation
**Statement:** For each classified failure with confidence ≥ 0.70, generate structured repair plan with hypothesis, ordered typed steps (config-change, code-change, infra-action, retry, quarantine, escalate), blast-radius estimate, rollback plan, required approver role.
**Acceptance:** AC-1 JSON-Schema-valid against `repair_plan.schema.v1.json`; AC-2 ≥ 2 alternatives if confidence < 0.85; AC-3 every code-change step annotated with target file + rationale; AC-4 NO patches auto-applied.
**Edge cases:** plan targets archived/protected branch → flag for approver; secret rotation → escalate to security-approver role.
**Negative paths:** generation fails → SCR-004 shows manual-plan form.
**Exit gate:** EVAL-002 ≥ 80% / 85% / 88%.

### BR-005 — Approval Workflow
**Statement:** No repair plan shall execute without explicit HITL approval (operator_id, timestamp_utc, justification_text ≥ 20 chars, plan_hash, HMAC signature).
**Acceptance:** AC-1 record append-only; AC-2 single-approval default; AC-3 dual-approval if plan touches `prod` or rotates secret; AC-4 Slack/email DM with deep-link; AC-5 approval token expires 4 hours.
**Edge cases:** OOO delegation chain captured; plan modified after sent-for-approval → invalidated, must re-send.
**Negative paths:** rejected with reason → optional re-plan loop max 3 iterations.
**Exit gate:** 100% of executed plans signed.

### BR-006 — Evidence Export
**Statement:** On demand or schedule, produce signed evidence ZIP per incident or time-window containing manifest.json, masked intake artifacts, RCA result, repair plan, approval record, before/after artifacts, prompt-version pin, model-id pin, gold-set-version pin, mask-policy pin, HMAC signature.
**Acceptance:** AC-1 manifest validates against `audit_export.schema.v1.json`; AC-2 ZIP HMAC-SHA-256 signed with tenant-rooted key; AC-3 export receipt persisted to `audit_exports`, retention 10 years (Article 18); AC-4 completeness score 5/5.
**Edge cases:** > 100 MB → split-archive with shared manifest; cross-tenant attempt → 403.
**Negative paths:** signing key unavailable → block export, page on-call, no silent fallback.
**Exit gate:** EVID-001..014 reproducibly generated; offline HMAC verification.

### BR-007 — Analytics Dashboard
**Statement:** SCR-007 presents 5 KPIs (MTTR, debugging effort, flaky recurrence, evidence completeness, approval cycle) with 30/60/90-day windows, per-repo/per-team filters, CSV export.
**Acceptance:** AC-1 dashboard p95 load ≤ 2s; AC-2 click-through to underlying incidents; AC-3 CSV schema-stable.
**Edge cases:** sparse tenants (<10 incidents); TZ correctness on rollups.
**Exit gate:** TEST-021..022.

### BR-008 — Deterministic Secret Masking
**Statement:** Before any AI inference and before any persistence beyond ephemeral memory, all artifacts pass through Mask Policy v1: regex set (AWS, GCP, JWT, GitHub PAT, generic tokens, private keys, conn strings) + Shannon entropy threshold + provider patterns (Datadog, Stripe, Cloudflare, Slack, OpenAI, Twilio, Algolia).
**Acceptance:** AC-1 zero leakage on red-team corpus N=500; AC-2 mask version pinned in every prompt_run; AC-3 false-positive rate ≤ 3%.
**Negative paths:** mask engine failure → block ingest, alert, NO fallback.
**Exit gate:** TEST-023..024; security sign-off (RC-014, RC-019).

### BR-009 — PromptOps Governance
**Statement:** All AI prompts versioned in registry with semver, owner, eval-run reference, promotion decision record, rollback target.
**Acceptance:** AC-1 every prompt_run row references prompt_version FK; AC-2 promotion blocked unless EVAL gate green; AC-3 rollback ≤ 30s; AC-4 prompt diff visible to approver before promotion.
**Exit gate:** PromptOps Level 3 maturity (canary + auto-rollback).

### BR-010 — Flaky Test Detection
**Statement:** Flag tests as flaky using (a) git-tree-SHA method (pass+fail on identical SHA) and (b) statistical (disruption frequency > configurable threshold, default 5% over 14 days).
**Acceptance:** AC-1 flaky list refreshed ≤ 15 min stale; AC-2 false-positive rate ≤ 5%; AC-3 quarantine recommendation generated as plan type.
**Exit gate:** Parity within ±10% vs BuildPulse on shared corpus.

### BR-011 — Audit Export Schema
**Statement:** Publish `audit_export.schema.v1.json` — versioned, immutable per release, consumable by downstream GRC tooling.
**Acceptance:** AC-1 JSON Schema 2020-12 valid; AC-2 versioned & immutable; AC-3 documented in `/docs/schemas/`.
**Exit gate:** GRC lead sign-off.

### BR-012 — Eval Gates
**Statement:** No prompt or model change promotes to "active" without passing EVAL-001 + EVAL-002 thresholds on current gold set, with results captured to `eval_runs` and reviewed by AI lead.
**Acceptance:** AC-1 gate enforced in CI; AC-2 gold set N ≥ 250; AC-3 slice-weighted score primary; AC-4 drift detector emits alert if production slice distribution diverges (PSI > 0.2).

---

## 8. User Stories (US-001..US-034 — selected; full set cross-ref in Traceability doc)

- **US-001** As Marcus I drag-drop a Jenkins log so I get RCA without webhook config (SCR-001, BR-001).
- **US-002** As Priya I see dashboard tile of team MTTR vs industry benchmark (SCR-007, BR-007).
- **US-003** As Lin I get Slack DM with plan summary + 1-click deep-link to SCR-005 (BR-005).
- **US-004** As Audit-Sam I export all Q1 approvals with one click (SCR-006, BR-006).
- **US-005** As Dev I see "class: flaky, here are 3 candidate fixes" without switching to logs (SCR-003/004).
- **US-006** As Marcus I see *why* the model thinks it's flaky vs infra (explainability — BR-003 AC-2).
- **US-007** As Lin I reject a plan with reason so the model learns (BR-005 negative path → feedback loop, IMP-013).
- **US-008** As Marcus secrets in my Jenkins logs never reach the LLM (BR-008).
- **US-009** As AI Lead I promote prompt v2.3 only after EVAL-001 ≥ 92% (BR-009, BR-012).
- **US-010** As GRC I get 10-year-retained evidence pack per high-risk incident (BR-011, §16a.6).
- **US-011..US-034** — role delegation, OOO, multi-tenant isolation, dual-approval, schedule-based export, cost-ceiling alerts, drift alerts, replay regression, RBAC sweeps, demo dry-runs — full set in Traceability.

---

## 9. Non-Functional Requirements

| NFR | Target | Measurement |
|---|---|---|
| Availability | 99.5% MVP → 99.9% post-pilot | Synthetic probes every 60s |
| RCA inference p95 | ≤ 8s | OTel span `rca.inference` |
| End-to-end intake → plan p95 | ≤ 25s | OTel root span |
| Tenant isolation | Logical RLS on Postgres `tenant_id` | Annual pen-test |
| Encryption at rest | AES-256, KMS-rooted, per-tenant DEK | Quarterly key rotation |
| Encryption in transit | TLS 1.3 only | Config scan |
| Audit log retention | ≥ 6 months (Article 12); tech docs 10 years (Article 18) | Retention policy + auto test |
| Secret-leak SLO | 0 leaks/quarter | Red-team corpus continuous |
| Accessibility | WCAG 2.1 AA | Axe automated + manual sample |
| i18n | English MVP; Spanish/Japanese Phase 4 | Externalization audit |

---

## 10. Phase Plan & Hackathon Cut

| Phase | Window | Hours | Roles | Dependencies | Output |
|---|---|---|---|---|---|
| 0 — Discovery | Pre-hack | 12h | PM, TL | Source docs | Frozen BRD |
| 1 — Foundation | Hack hr 0–8 | 64 person-hr | 2 BE, 1 FE, 1 AI | Phase 0 | DB schema, tenant, mask v1, OAuth |
| 2 — Core Flow MVP | Hack hr 8–28 | 160 person-hr | Full team | Phase 1 | SCR-001..006 skeleton, EVAL gates |
| 3 — Polish & Demo | Hack hr 28–36 | 64 person-hr | Full team | Phase 2 | SCR-007, evidence ZIP, demo script |
| **Hack cut** | hr 36 | — | — | — | **Tier 1 demo-able** |
| 4 — Pilot Hardening | w1–w6 | 480h | +1 SRE | EVAL pilot thresh | Multi-tenant hardening, on-call, SAML, EU |
| 5 — Promotion | w7–w12 | 480h | +1 SE | Pilot signal | 99.9% SLO, on-prem option |

### 10.1 Critical-path callouts (hackathon)
1. Mask v1 must land Hour 4 — everything downstream depends.
2. EVAL gold sets seeded Hour 8 — N=250 each, label-audited.
3. Approval signature scheme Hour 12 — evidence pack depends.
4. Evidence ZIP signer Hour 24 — demo cannot complete without.

---

## 11. Readiness Scorecard (61/70 → 67/70)

| # | Dimension | Weight | Current | Evidence | Path to 7 |
|---|---|---|---|---|---|
| 1 | Problem clarity / market fit | 7 | 7 | §3.1, persona, ACV bands | maintain |
| 2 | AI necessity | 7 | 7 | RCA + repair-plan dual AI | maintain |
| 3 | Data readiness / gold sets | 7 | 6 | EVAL cards in ClaudeAnnex | IMP-022 audit cadence → 7 |
| 4 | Technical feasibility | 7 | 7 | Stack: Bob, Postgres, queue, Next.js | maintain |
| 5 | Auditability / governance | 7 | 7 | Evidence ZIP, prompt registry, signed manifest | maintain |
| 6 | Compliance posture | 7 | 6 | SOC 2 readiness, Article 12 mapped | IMP-021 EU region → 7 Phase 4 |
| 7 | Demo readiness | 7 | 6 | Demo script Doc 4 | IMP-018 dry-run → 7 |
| 8 | Commercialization | 7 | 6 | ACV bands, segments, motion | IMP-024 partner motion → 7 |
| 9 | Operational readiness | 7 | 5 | Observability + runbook §17 | IMP-019 on-call → 6 |
| 10 | Risk management | 7 | 4 | Risk register §15 | IMP-020 owner staffing → 6 |
| **Total** | | **70** | **61** | | **+6 achievable Phase 4** |

---

## 12. Competitive Comparative Matrix (8 named competitors)

| # | Competitor | Proximity | Where they win | Where MendoraCI wins | Switching cost |
|---|---|---|---|---|---|
| OPT-001 | **MendoraCI** | 100% | Reference | Reference | n/a |
| OPT-002 | Roll-your-own scripts + Slack | 18% | Zero license | Governance, evidence, no AI maint | Low |
| OPT-003 | BuildPulse | 32% | Flake detection breadth; 5-min setup | RCA, plan, HITL, evidence, governance | Low–Med |
| OPT-004 | Trunk Flaky Tests | 38% | Quarantine UX, PR-comment integration | RCA scope beyond flake; AI plan; evidence | Low–Med |
| OPT-005 | Generic AI copilot (Copilot/Q/Cursor) | 28% | Code suggestion velocity; install base | Governance, HITL, evidence, CI focus | Med |
| OPT-006 | Datadog CI Visibility + governance overlay | 55% | Observability, flake detection, $20/committer leverage | AI repair, HITL ledger, prompt governance — Datadog has no approval workflow | High (already owned) |
| OPT-007 | CircleCI Insights + workflow rules | 24% | Native to CircleCI customers | Cross-provider; AI RCA; evidence | Low |
| OPT-008 | Sentry-centered | 22% | Production error correlation | Wrong layer (prod, not CI); AI governance | Low |

**Insight:** MendoraCI's defensible wedge is **AI repair planning + HITL governance + audit-grade evidence pack** — no named competitor delivers all three.

---

## 13. Commercialization (Deep)

### 13.1 Pricing tiers

| Tier | Segment | Per-month list | Anchor ACV | Inclusions | Exclusions |
|---|---|---|---|---|---|
| Pilot | ≤ 50 devs, 1 repo group | $4,000 | $48K | SCR-001..006, 1 SSO, evidence ZIP, EVAL gates | No EU residency, no SAML/SCIM |
| Team | 51–200 devs | $13,000 | $156K | + multi-repo, SAML, Slack, Jira | No on-prem |
| Enterprise | 201–1,000 devs | $34,000 | $412K | + SCIM, dual-approval, EU residency, dedicated CSM | No on-prem |
| Strategic | 1,000+ devs | Custom | $890K+ | + on-prem option, custom gold set, FedRAMP track | — |

Hybrid model (per-committer + governance flat fee), justified by Stripe 2025 enterprise AI-tooling pricing analysis and Optifai DevOps ACV benchmark ($50K–$150K median, governance premium 25–35%).

### 13.2 Sales motion
- **TOFU:** developer-experience content; flaky-test conference circuit; Bob AI co-marketing.
- **Pilot wedge:** 60-day paid pilot, refundable if EVAL-001 < 90% on pilot data.
- **Expansion:** Pilot → Team → Enterprise → Strategic. NDR target 130%+.
- **Channel:** Datadog/CircleCI marketplaces Phase 4; GSI partnership (Accenture, Deloitte) Phase 5.

### 13.3 Target segments
1. Regulated enterprise (fintech, healthtech, govtech) — EU AI Act Art. 12 + SOC 2 pull.
2. Platform-engineering-mature mid-market (200–1,000 devs) — MTTR + flake pull.
3. AI-forward enterprise — PromptOps governance pull.

---

## 14. AI Necessity, Feasibility, Auditability, Compliance, Demo, Ops

### 14.1 AI necessity
Multi-class root-cause classification across 12 classes from heterogeneous, multi-language, multi-format log text is a noisy-classification + summarization + structured-generation problem. Rule-only baseline `rca_fallback_v1` ships and consistently scores ~58% vs. EVAL-001 target 92%.

### 14.2 Data readiness
- **EVAL-001 gold set:** N=250, 12-class stratified, 4 customer-volunteer corpora, 3-of-3 inter-annotator agreement.
- **EVAL-002 gold set:** N=250, repair-plan ground truth = approved plan from real incidents or expert-authored.
- **Refresh cadence:** quarterly; novel failures from manual-review queue feed candidate-additions.
- **Label-quality audit:** monthly 5% blind re-label, target Cohen κ ≥ 0.75 (IMP-022).

### 14.3 Technical feasibility
Next.js + Node.js + Postgres + Redis queue + IBM Bob AI. No novel infra. Closest analogue (BuildPulse) implements in 5-min setup; MendoraCI's added AI layer is RAG-style architecture.

### 14.4 Auditability
Every AI inference writes to `prompt_runs` with model_id, prompt_version, gold_set_version, mask_policy_version, input_hash (post-mask), output, latency, confidence. Every HITL action writes to append-only `approval_records`. Evidence ZIP includes hash-chained manifest.

### 14.5 Compliance posture
- **SOC 2 Type II:** Phase 4 scoped audit; controls mapped to CC1–CC9.
- **ISO 27001 / 42001:** 42001:2023 AI management system mapping in ClaudeAnnex.
- **EU AI Act Article 12:** automatic logging design satisfies "automatic, lifetime, traceable to inputs and operators."
- **EU AI Act Article 14:** human oversight = HITL approval workflow.
- **EU AI Act Article 18:** 10-year tech-doc retention supported.
- **GDPR:** raw personal data minimized via mask; tech-doc retention separated from PII.

### 14.6 Demo readiness
See `MendoraCI_DemoScript_20260517_1130.md`. 5-min golden path: paste Jenkins log → masked intake → RCA card → repair plan → 1-click approve → evidence ZIP download.

### 14.7 Operational readiness
See §17.

---

## 15. Risk Register — 1–5 Likelihood × 1–5 Impact

| ID | Risk | L | I | Score | Mitigation | Owner | Phase |
|---|---|---|---|---|---|---|---|
| R-01 | EVAL-001 fails 90% at pilot | 3 | 5 | 15 | Slice analysis, gold-set aug IMP-022; rules fallback | AI Lead | 2–3 |
| R-02 | Secret leak through mask gap | 2 | 5 | 10 | Red-team corpus continuous; deny-on-fail; IMP-016 | Sec Lead | 1 |
| R-03 | LLM provider outage | 3 | 4 | 12 | Model fallback registry IMP-023 | AI Lead | 2 |
| R-04 | GitHub OAuth app review delay | 2 | 3 | 6 | PAT fallback in MVP | Platform | 1 |
| R-05 | Demo failure on judges | 2 | 5 | 10 | Pre-recorded fallback; deterministic seed IMP-018 | PM | 3 |
| R-06 | Gold-set label noise | 3 | 3 | 9 | IAA gate, monthly audit IMP-022 | AI Lead | 2 |
| R-07 | Approver burnout | 3 | 3 | 9 | Confidence auto-suppress; digest mode; on-call IMP-019 | Platform | 4 |
| R-08 | Multi-tenant data crossover bug | 2 | 5 | 10 | RLS, pen-test, RC-006 closure | Platform | 1 |
| R-09 | LLM cost ceiling exceeded | 4 | 3 | 12 | FinOps ceiling IMP-017 | Platform | 2 |
| R-10 | EU residency demand pre-Phase-4 | 3 | 4 | 12 | Roadmap pre-sell; deal-desk script | Sales | 3–4 |
| R-11 | Prompt drift undetected | 3 | 4 | 12 | PSI drift detector + canary IMP-009 | AI Lead | 2 |
| R-12 | Audit-pack schema breaks GRC tools | 2 | 4 | 8 | Versioned schema, deprecation policy IMP-025 | GRC | 3 |

Score: ≥15 critical (top-priority mitigation); 9–14 high; <9 monitored.

---

## 16. Data Governance Annex (16a series)

### 16a.5 Data Classification & Retention

| Class | Examples | Mask required? | Encryption | Retention |
|---|---|---|---|---|
| C1 — Public | OSS repo metadata | No | Standard | Indefinite |
| C2 — Internal | Repo names, branch names | No | Standard | 24 months |
| C3 — Confidential (default for logs) | CI log body (masked) | Yes pre-persist | KMS-rooted DEK | 18mo active + 10y archive |
| C4 — Restricted | Secrets pre-mask (NEVER persisted) | n/a — destroyed | n/a | 0 (never written) |
| C5 — Personal (limited) | Approver name, email | No (audit need) | KMS-rooted | GDPR erasure; tech-doc trail separate |

### 16a.6 Lineage
`lineage_chain` JSONB on every artifact: `intake_id → rca_run_id → plan_id → approval_id → export_id`. End-to-end queryable.

### 16a.7 Gold-Set Governance
- Versioned in `gold_sets` table, immutable per version, semver.
- Promotion requires: AI Lead approval, label-quality audit (κ ≥ 0.75), drift-rebaseline test pass.
- Object-lock storage with object lock.

### 16a.8 Evaluation Governance
- `eval_runs` immutable; one row per (prompt_version, model_id, gold_set_version, timestamp).
- Promotion decisions recorded in `prompt_promotions` with approver_id and justification.

### 16a.9 Prompt Registry Governance
- Prompts in Git (PromptOps Git-native pattern); registry mirror in Postgres for runtime lookup.
- Every prompt has owner, created_at, superseded_by, eval_run_refs[].

---

## 17. Operational Readiness

### 17.0 Operational Model
Two-tier on-call (Phase 4): L1 platform, L2 AI/eval. SLA: P1 ack 15 min, resolve 4 hr.

### 17.1 Observability Requirements
- **Logs:** structured JSON, OTel format, per-tenant log bucket.
- **Metrics:** Prometheus-format, 15s scrape; per-tenant cardinality cap.
- **Traces:** OTel; root span per intake; required spans: `intake.accept`, `mask.apply`, `rca.inference`, `plan.generate`, `approval.notify`, `evidence.sign`.
- **SLO dashboard:** availability, p95 RCA latency, secret-leak rate (must be 0), eval-gate green rate.
- **Alerts:** mask failure → page; drift PSI>0.2 → ticket; cost ceiling 80% → email, 100% → throttle.

### 17.2 Incident Response Runbook (Phase 4)
- Runbook per top-10 failure mode (see ExecutionControlBook §Failure Modes).
- 4-hour resolve target P1; chaos test quarterly (IMP-015).

---

## 23.2 Final Readiness Scorecard Summary
Current **61/70 (Tier 1)**. Closing IMP-018, IMP-019, IMP-020, IMP-022 → **65/70** by Phase 4 mid. Closing IMP-021, IMP-024 → **67/70** by Phase 4 end. Ceiling 70/70 requires production-scale evidence (not in hackathon scope).

---

**End of BRD. See companion documents:** Traceability, MasterMatrix, ExecutionControlBook, ReviewCommentsRegister, RecommendedEnhancements, FinalPackageReview, ClaudeAnnex, plus supporting specs (DataModelERD, APIContractSpec, UIWireframeSpec, RBACPermissionMatrix, DeploymentTopology, ObservabilityPack, PromptOpsGovernance, TestAutomationMatrix, DemoScript, RiskRegister, Glossary, ExecutiveSummary, ConsolidatedReadingGuide).
