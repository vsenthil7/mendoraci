# MendoraCI_FullUserStories_US001_US034_20260517_1208

**Document Type:** Full User Story Expansion (Fix 1 from FinalProductReview 1201)
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 1 — "US-001..US-034 numbering mismatch"
**Supersedes:** BRD §8 user-story summary (1130 set)

---

## 0. How to Read This Document

Each story carries: **persona · story · BR link · SCR/API link · acceptance criteria · negative path · priority · phase**. Priority = P0 demo-critical / P1 MVP / P2 Pilot / P3 Enterprise. Phase ties to BRD §10 (P1 Foundation, P2 Core MVP, P3 Polish, P4 Pilot Hardening, P5 Promotion).

The 34 stories cluster into 7 epics aligned to the 7 screens plus 3 cross-cutting epics (governance, security, commercial).

---

## 1. Epic A — Intake & Masking (SCR-001)

### US-001 — Drag-drop intake without webhook config
- **As** Marcus (Platform Owner) **I want** to drag-drop a Jenkins log onto SCR-001 **so that** I can get RCA without configuring a webhook.
- **BR:** BR-001 · **SCR:** SCR-001 · **API:** API-001
- **Acceptance:** AC-1 drop-zone accepts `.log`, `.txt`, `.xml`, `.zip` up to 50MB; AC-2 mask animation visible within 2s of drop; AC-3 row appears in intake history with status `received`; AC-4 `Idempotency-Key` auto-generated from file SHA-256 + tenant_id.
- **Negative path:** >50MB → "Artifact exceeds 50 MB limit. Split your archive or contact support." (413); unsupported MIME → 422 with allow-list; concurrent same-file drop within 24h → 409 with link to prior row.
- **Priority:** P0 · **Phase:** P2

### US-008 — Secrets never reach the LLM
- **As** Marcus **I want** secrets in my Jenkins logs to be masked before any AI inference **so that** I have zero LLM exfiltration risk.
- **BR:** BR-001, BR-008 · **SCR:** SCR-001 (cross-cuts SCR-003/004)
- **Acceptance:** AC-1 Mask Policy v1 applied pre-persist; AC-2 mask version pinned in every `prompt_run` row; AC-3 red-team N=500 zero leaks; AC-4 pre/post-mask SHA-256 both logged.
- **Negative path:** mask engine failure → block ingest, alert Sec Lead, NO fallback (deny-on-fail).
- **Priority:** P0 · **Phase:** P1

### US-014 — Webhook intake from GitHub Actions
- **As** Marcus **I want** GitHub Actions failed-run events to auto-create intakes **so that** my team doesn't manually upload.
- **BR:** BR-001, BR-002 · **SCR:** SCR-001 (admin tab) · **API:** API-001 (webhook variant)
- **Acceptance:** AC-1 webhook signature verified (HMAC-SHA256 with rotating secret); AC-2 webhook p95 ≤ 5s; AC-3 dedupe on `(provider, run_id, attempt_id)` within 24h; AC-4 webhook secret auto-rotates every 90 days.
- **Negative path:** unsigned webhook → 401 + security event log; replay within 5min → 409; malformed payload → 422 with `validation_errors[]`.
- **Priority:** P1 · **Phase:** P2

### US-025 — Multi-job matrix-build intake
- **As** Renee (Engineer) **I want** matrix-build failures to deduplicate intelligently **so that** I don't get 12 duplicate RCAs for the same root cause.
- **BR:** BR-001 · **SCR:** SCR-001
- **Acceptance:** AC-1 intakes from same workflow_run grouped under parent; AC-2 parent gets one RCA; AC-3 children link to parent in `lineage_chain`.
- **Negative path:** if matrix jobs have genuinely different failure modes, system auto-splits.
- **Priority:** P2 · **Phase:** P4

### US-031 — Provider-extended masking
- **As** Sam (CISO) **I want** Datadog / Stripe / Cloudflare / Slack / OpenAI / Twilio / Algolia tokens masked **so that** modern SaaS secrets are covered.
- **BR:** BR-001, BR-008 · **IMP:** IMP-016
- **Acceptance:** AC-1 N=500 red-team corpus includes ≥ 20 provider-specific token formats; AC-2 zero leaks; AC-3 false-positive rate ≤ 3% on normal log corpus.
- **Negative path:** ambiguous high-entropy tokens (could be hash, could be secret) → mask conservatively; surface to admin review.
- **Priority:** P1 · **Phase:** P2

---

## 2. Epic B — Repository Linking (SCR-002)

### US-002 — VPE dashboard tile of MTTR vs industry benchmark
- **As** Priya (VP Eng) **I want** to see my team's MTTR vs an industry benchmark **so that** I can report to the CTO.
- **BR:** BR-007 · **SCR:** SCR-007
- **Acceptance:** AC-1 benchmark source documented (DORA 2025); AC-2 tile updates within 15 min of new incidents; AC-3 click-through drills to underlying incidents.
- **Negative path:** sparse tenant (<10 incidents) → tile shows "Insufficient data" with onboarding tip.
- **Priority:** P1 · **Phase:** P3

### US-015 — GitHub App OAuth installation
- **As** Marcus **I want** to install MendoraCI as a GitHub App on selected repos **so that** I avoid per-engineer PAT management.
- **BR:** BR-002 · **SCR:** SCR-002 · **API:** API-003
- **Acceptance:** AC-1 OAuth callback issues per-tenant install token within 10s; AC-2 minimal scopes only (contents:read, actions:read, checks:read, pull_requests:read); AC-3 install ledger row written to `installations` table.
- **Negative path:** org SSO required → 403 + bypass-request token CTA; revoked install → re-auth banner on SCR-002.
- **Priority:** P0 · **Phase:** P1

### US-016 — PAT fallback for non-app-installable orgs
- **As** Marcus **I want** a PAT-based fallback **so that** orgs that can't install the GitHub App can still onboard during MVP.
- **BR:** BR-002 · **SCR:** SCR-002
- **Acceptance:** AC-1 PAT stored AES-256-GCM with per-tenant DEK; AC-2 scope verified at link time; AC-3 expiring PAT alert 14 days before expiry.
- **Negative path:** invalid PAT → 403 + "rotate-token" CTA with deep-link to GitHub PAT page.
- **Priority:** P1 · **Phase:** P1

### US-026 — Repo archive / re-link lifecycle
- **As** Marcus **I want** archived or revoked repos to be clearly flagged **so that** I don't waste investigation time.
- **BR:** BR-002 · **SCR:** SCR-002
- **Acceptance:** AC-1 archived repo gets `archived` badge; AC-2 revoked installation triggers email to tenant admins within 5 min.
- **Negative path:** silent revocation by GitHub → next webhook attempt detects, surfaces banner.
- **Priority:** P2 · **Phase:** P4

---

## 3. Epic C — Root Cause Analysis (SCR-003)

### US-005 — Class + alternatives + explainability
- **As** Renee **I want** to see "class: flaky, here are 3 candidate fixes, here's why" **so that** I don't have to read raw logs.
- **BR:** BR-003 · **SCR:** SCR-003 · **API:** API-004
- **Acceptance:** AC-1 top-3 classes with probabilities; AC-2 click-to-highlight rationale in masked log; AC-3 inference p95 ≤ 8s.
- **Negative path:** confidence < 0.70 → amber banner "Needs human review"; class-override requires justification ≥ 20 chars.
- **Priority:** P0 · **Phase:** P2

### US-006 — Explainability snippet
- **As** Marcus **I want** to see *why* the model classified as flaky vs infra **so that** I trust the system.
- **BR:** BR-003 · **SCR:** SCR-003
- **Acceptance:** AC-1 every RCA includes rationale with line numbers; AC-2 rationale is generated, not retrieval-only; AC-3 rationale length 50–500 chars.
- **Negative path:** rationale empty or generic → flag low-confidence regardless of score.
- **Priority:** P1 · **Phase:** P2

### US-017 — Non-English log handling
- **As** Renee (working on a Tokyo team) **I want** logs in Japanese to classify correctly **so that** non-English teams aren't disadvantaged.
- **BR:** BR-003 · **EVAL:** EVAL-001 language slice
- **Acceptance:** AC-1 language detection runs pre-classification; AC-2 EVAL-001 language slice ≥ 80%; AC-3 rationale generated in detected language.
- **Negative path:** mixed-language log → primary language detected, secondary noted; classify on primary.
- **Priority:** P2 · **Phase:** P4

### US-018 — RCA fallback on LLM outage
- **As** Marcus **I want** to still get a class (even rule-based) when the LLM is down **so that** my pipeline doesn't fully stall.
- **BR:** BR-003 · **IMP:** IMP-023
- **Acceptance:** AC-1 fallback `rca_fallback_v1` engages within 30s of LLM timeout; AC-2 fallback responses tagged `rca_confirmed_fallback`; AC-3 fallback class is always one of the 12 taxonomy classes (or `unknown`).
- **Negative path:** if fallback also fails → manual review queue with SLA 30 min.
- **Priority:** P1 · **Phase:** P2

### US-027 — Mixed-cause multi-label RCA
- **As** Renee **I want** the system to admit when a failure is mixed-cause **so that** I don't chase only one branch.
- **BR:** BR-003
- **Acceptance:** AC-1 if top-2 confidences are within 10pp of each other, return multi-label; AC-2 plan generation considers both.
- **Negative path:** more than 2 plausible causes → escalate to manual review.
- **Priority:** P2 · **Phase:** P4

---

## 4. Epic D — Repair Plan (SCR-004)

### US-019 — Structured plan with blast-radius and rollback
- **As** Renee **I want** a structured repair plan with blast-radius and rollback **so that** I can decide quickly.
- **BR:** BR-004 · **SCR:** SCR-004 · **API:** API-005
- **Acceptance:** AC-1 JSON-Schema-valid against `repair_plan.schema.v1.json`; AC-2 every step has step_type + body + blast_radius + rollback_note; AC-3 ≥ 2 alternatives if confidence < 0.85.
- **Negative path:** schema-invalid → fallback to manual-plan form.
- **Priority:** P0 · **Phase:** P2

### US-020 — Plan must never auto-apply
- **As** Sam (CISO) **I want** plans to never auto-apply patches **so that** human control is preserved.
- **BR:** BR-004
- **Acceptance:** AC-1 no API path executes a plan without API-006 signed approval; AC-2 audit log proves zero auto-execution.
- **Negative path:** any attempted auto-apply → P1 incident, immediate code freeze.
- **Priority:** P0 · **Phase:** P1

### US-028 — Plan touching protected branch flagged for dual-approval
- **As** Sam **I want** plans that touch `main` / `prod` to force dual-approval **so that** high-blast changes get extra scrutiny.
- **BR:** BR-004, BR-005 · **SCR:** SCR-004, SCR-005
- **Acceptance:** AC-1 plan sets `required_approver_role: dual_prod_approver`; AC-2 SCR-004 shows red banner; AC-3 API-006 enforces 2 distinct signatures.
- **Negative path:** approver attempts to sign both roles → 403 separation-of-duties.
- **Priority:** P1 · **Phase:** P2

### US-029 — Plan with secret rotation routes to security_approver
- **As** Sam **I want** secret-rotation plans to require security_approver role **so that** secret hygiene is owned by security.
- **BR:** BR-004, BR-005 · **RC:** RC-030
- **Acceptance:** AC-1 plan sets `required_approver_role: security_approver`; AC-2 regular approver attempts 403; AC-3 security_approver receives separate Slack channel notification.
- **Negative path:** no security_approver online → escalation chain to CISO.
- **Priority:** P1 · **Phase:** P4

---

## 5. Epic E — Approval Workflow (SCR-005)

### US-003 — Slack DM with deep-link
- **As** Lin (Approver / SRE) **I want** a Slack DM with plan summary + 1-click deep-link **so that** I approve from my phone in under a minute.
- **BR:** BR-005 · **SCR:** SCR-005 · **API:** API-007
- **Acceptance:** AC-1 Slack DM sent within 5s of plan generation; AC-2 deep-link opens SCR-005 with plan pre-loaded; AC-3 mobile-responsive at 480px.
- **Negative path:** Slack down → email fallback; email also down → in-app notification + page admin.
- **Priority:** P0 · **Phase:** P2

### US-007 — Reject with reason teaches the model
- **As** Lin **I want** to reject a plan with a written reason **so that** the model learns from my judgment.
- **BR:** BR-005 · **IMP:** IMP-013
- **Acceptance:** AC-1 rejection requires reason ≥ 20 chars; AC-2 reason stored on `approval_records` and feeds eval-set candidate queue; AC-3 ≥ 80% of rejections have non-trivial reason.
- **Negative path:** trivial reason ("no") → form rejects with helper text.
- **Priority:** P1 · **Phase:** P3

### US-021 — OOO delegation chain
- **As** Lin **I want** my approval rights to delegate to my backup when I'm on PTO **so that** deploys don't stall.
- **BR:** BR-005 · **RC:** RC-010
- **Acceptance:** AC-1 delegation captured in `approval_delegations` table with start/end timestamps; AC-2 delegation is auditable (who, when, by whom); AC-3 delegation auto-expires.
- **Negative path:** circular delegation (A→B→A) → rejected at creation.
- **Priority:** P2 · **Phase:** P4

### US-022 — Plan-hash drift invalidates approval link
- **As** Sam **I want** plan edits after notification to invalidate the approval token **so that** approvers always sign exactly what they reviewed.
- **BR:** BR-005
- **Acceptance:** AC-1 plan_hash captured at notify time; AC-2 sign attempt with drifted hash → 409 + reload banner; AC-3 new approval token issued automatically.
- **Negative path:** approver insists on signing anyway → impossible by design.
- **Priority:** P0 · **Phase:** P2

### US-030 — Justification minimum length
- **As** Sam **I want** approval justifications to require ≥ 20 chars **so that** "ok" rubber-stamps are prevented.
- **BR:** BR-005 · **RC:** RC-005
- **Acceptance:** AC-1 client + server validation; AC-2 SCR-005 button disabled with live counter; AC-3 server returns 400 on bypass.
- **Negative path:** automated approval scripts that send fixed strings → detected via approver-fatigue analytics (RC-007).
- **Priority:** P0 · **Phase:** P2

---

## 6. Epic F — Evidence Export (SCR-006)

### US-004 — Bulk export of Q1 approvals
- **As** Audit-Sam (GRC) **I want** to export all Q1 approvals with one click **so that** my auditor has everything in 5 minutes.
- **BR:** BR-006 · **SCR:** SCR-006 · **API:** API-008
- **Acceptance:** AC-1 filter by date range supported; AC-2 export completes ≤ 60s for ≤ 1000 incidents; AC-3 ZIP HMAC-signed.
- **Negative path:** >100MB → split-archive with shared manifest.
- **Priority:** P0 · **Phase:** P3

### US-010 — 10-year retention for high-risk incidents
- **As** Audit-Sam **I want** 10-year retention on evidence packs **so that** EU AI Act Article 18 is satisfied.
- **BR:** BR-006, BR-011
- **Acceptance:** AC-1 S3 Object Lock at "compliance" mode; AC-2 retention policy queryable via API-008; AC-3 deletion attempts always fail.
- **Negative path:** GDPR erasure on PII fields → PII anonymized in-place, tech-doc trail preserved.
- **Priority:** P0 · **Phase:** P2

### US-023 — Offline HMAC verification of evidence pack
- **As** Audit-Sam **I want** to verify evidence pack signatures offline **so that** I'm never trapped by vendor lock-in.
- **BR:** BR-006
- **Acceptance:** AC-1 customer-readable verifier tool published at `/docs/verifier/`; AC-2 HMAC key derivation documented; AC-3 sample bundle provided.
- **Negative path:** customer-side key compromise → re-sign with new key on demand.
- **Priority:** P1 · **Phase:** P3

---

## 7. Epic G — Analytics Dashboard (SCR-007)

### US-024 — 5 KPI tiles with 30/60/90 windows
- **As** Priya **I want** MTTR / debug effort / flaky recurrence / evidence completeness / approval cycle KPIs **so that** my QBR is one click.
- **BR:** BR-007 · **SCR:** SCR-007 · **API:** API-009
- **Acceptance:** AC-1 dashboard p95 ≤ 2s; AC-2 windows 30/60/90 days; AC-3 CSV export schema-stable.
- **Negative path:** sparse data <10 incidents → tile shows "Insufficient data".
- **Priority:** P0 · **Phase:** P3

### US-032 — Per-team filter and drill-through
- **As** Priya **I want** to filter by team **so that** I can see which team's reliability is regressing.
- **BR:** BR-007 · **SCR:** SCR-007
- **Acceptance:** AC-1 team taxonomy configurable per tenant; AC-2 drill-through to incident list.
- **Negative path:** unmapped team → "Unassigned" bucket.
- **Priority:** P2 · **Phase:** P4

---

## 8. Epic H — Governance Cross-Cutting

### US-009 — Promote prompt v2.3 only after EVAL-001 ≥ 92%
- **As** AI Lead **I want** to promote a new prompt only after EVAL passes **so that** quality never regresses.
- **BR:** BR-009, BR-012 · **API:** API-010
- **Acceptance:** AC-1 promotion blocked on red EVAL with 409; AC-2 promotion writes immutable row in `prompt_promotions`; AC-3 canary 5%/24h before full promotion.
- **Negative path:** AI Lead attempts override → not possible; CTO override path exists with dual-signature audit.
- **Priority:** P0 · **Phase:** P2

### US-033 — Drift detection alert
- **As** AI Lead **I want** a PSI > 0.2 alert **so that** slow quality regressions don't go undetected.
- **BR:** BR-012 · **IMP:** IMP-009 · **RC:** RC-020
- **Acceptance:** AC-1 PSI computed daily over 7d-vs-reference; AC-2 alert P2 on threshold breach; AC-3 alert routes to AI pod ticket queue.
- **Negative path:** false-positive alert (genuine traffic shift) → AI Lead acknowledges, baseline updated.
- **Priority:** P1 · **Phase:** P2

### US-034 — Replay regression harness
- **As** AI Lead **I want** to replay prior incidents against new prompts **so that** silent regressions are caught.
- **BR:** BR-012 · **IMP:** IMP-014 · **RC:** RC-027
- **Acceptance:** AC-1 replay set N ≥ 100 historical incidents; AC-2 parity ≥ 95% on incumbent prompt; AC-3 run on every prompt PR in CI.
- **Negative path:** parity < 95% → block merge.
- **Priority:** P1 · **Phase:** P3

---

## 9. Epic I — Commercial Cross-Cutting

### US-011 — Cost-ceiling alerts
- **As** Carlos (CFO) **I want** alerts at 80% and 100% of tenant cost ceiling **so that** runaway LLM spend is impossible.
- **BR:** (NFR) · **IMP:** IMP-017 · **RC:** RC-024
- **Acceptance:** AC-1 soft alert at 80% emails tenant admin + CSM; AC-2 hard at 100% throttles LLM calls (intakes queue, no inference); AC-3 admin override requires VP Eng signature.
- **Negative path:** ceiling exceeded due to malicious traffic → DDoS protections engage before LLM call.
- **Priority:** P1 · **Phase:** P2

### US-012 — Multi-tenant isolation guarantee
- **As** Sam **I want** to prove cross-tenant data isolation **so that** my SOC 2 audit passes.
- **BR:** (NFR) · **RC:** RC-006, RC-021
- **Acceptance:** AC-1 quarterly external pen-test report; AC-2 RLS enforced at query layer (defense in depth); AC-3 RBAC sweep TEST-014-A row-by-row pass.
- **Negative path:** any cross-tenant attempt → 403 + P1 incident.
- **Priority:** P0 · **Phase:** P1

### US-013 — QBR pack auto-generated
- **As** CSM **I want** auto-generated QBR packs **so that** renewal motion runs at scale.
- **BR:** (commercial) · **IMP:** IMP-024
- **Acceptance:** AC-1 QBR template populated with last 90-day KPIs; AC-2 PDF export; AC-3 customer-brandable.
- **Negative path:** sparse data → QBR notes "insufficient activity for full QBR".
- **Priority:** P3 · **Phase:** P4

---

## 10. Summary Coverage Matrix

| Epic | Stories | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| A Intake & Masking | 5 (US-001, 008, 014, 025, 031) | 2 | 2 | 1 | 0 |
| B Repo Linking | 4 (US-002, 015, 016, 026) | 1 | 2 | 1 | 0 |
| C RCA | 5 (US-005, 006, 017, 018, 027) | 1 | 2 | 2 | 0 |
| D Repair Plan | 4 (US-019, 020, 028, 029) | 2 | 2 | 0 | 0 |
| E Approval | 5 (US-003, 007, 021, 022, 030) | 3 | 1 | 1 | 0 |
| F Evidence Export | 3 (US-004, 010, 023) | 2 | 1 | 0 | 0 |
| G Analytics | 2 (US-024, 032) | 1 | 0 | 1 | 0 |
| H Governance | 3 (US-009, 033, 034) | 1 | 2 | 0 | 0 |
| I Commercial | 3 (US-011, 012, 013) | 1 | 1 | 0 | 1 |
| **Total** | **34** | **14** | **13** | **6** | **1** |

P0 = 14 demo-critical stories; ALL achievable in the 36-hour hackathon cut.
P1 = 13 MVP stories; achievable by Pilot exit (week 6).
P2/P3 = 7 stories; Phase 4 / Phase 5.

---

## 11. Traceability Update

This document supersedes BRD §8 (1130 set). Update `MendoraCI_Traceability_20260517_1130.md` §3 to point to this expansion for full US-001..US-034 detail. New RT rows are NOT required — all 34 stories are already covered by existing RT-001..RT-020 via their BR/SCR/API columns; this document is the missing prose expansion ChatGPT identified.
