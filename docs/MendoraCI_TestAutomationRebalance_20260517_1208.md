# MendoraCI_TestAutomationRebalance_20260517_1208

**Document Type:** Test Automation Ownership Rebalance (Delta to 1130 TestAutomationMatrix)
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 7 — "Test automation needs CI ownership rebalance"
**Status:** AUTHORITATIVE — supersedes 1130 TestAutomationMatrix ownership column for the 9 tests listed below
**Cadence change:** Effective at next CI pipeline rebuild (Phase 2)

---

## 0. The Problem ChatGPT Flagged

The 1130 TestAutomationMatrix has solid coverage (TEST-001..TEST-028 with sub-tests A/B), but several security and integration tests are scheduled as **manual** or **quarterly**. ChatGPT correctly observed that for build confidence — especially in an enterprise governance product — these need to be **in CI on every PR**, not depending on someone remembering to run them.

This document moves 9 tests into earlier, more automated cadences with named owners and CI integration plans. The 1130 matrix stays as historical reference; this rebalance is the new ownership truth.

---

## 1. The 9 Tests Being Rebalanced

| Test ID | 1130 cadence | 1130 ownership | New cadence | New ownership |
|---|---|---|---|---|
| TEST-013-A | Quarterly pen-test | Sec Lead manual | **Every PR + nightly** | CI (Platform pod) |
| TEST-014-A | Manual sweep | Sec Lead | **Every PR** | CI (Platform pod) |
| TEST-016 | Quarterly | Sec Lead | **Every PR** | CI (Platform pod) |
| TEST-018 | Per release | Backend Lead | **Every PR** | CI (Backend pod) |
| TEST-019 | Per release | Backend Lead | **Every PR** | CI (Backend pod) |
| TEST-021 | Quarterly | Sec Lead | **Every PR** | CI (Platform pod) |
| TEST-023 | Per release | Sec Lead | **Every PR + nightly** | CI (Sec pod) |
| TEST-025 | Per release | AI Lead | **Every PR** | CI (AI pod) |
| TEST-026 | Manual | FE Lead | **Every PR** | CI (Frontend pod) |

**Net result:** 9 tests move from manual/quarterly/per-release into **every PR**. This eliminates the most common build-confidence failure mode (regressions slipping into release because a manual test was skipped under deadline pressure).

---

## 2. Detailed Rebalance Per Test

### TEST-013-A — Cross-Tenant RLS Chaos Test

**Was:** Quarterly external pen-test by 3rd party
**Now:** Postgres-level integration test on every PR + nightly chaos run

**Implementation:**
- CI job spins up Postgres container with full schema
- Test inserts data under tenant A
- Test rebinds session to tenant B (`SET LOCAL app.tenant_id`) and attempts every CRUD operation against every tenant-scoped table
- All cross-tenant reads MUST return 0 rows; all cross-tenant writes MUST fail with policy violation
- Nightly run additionally forges JWTs with non-existent tenant_ids, missing tenant_id claims, and stale tenant_ids — all must result in 0-row reads and 403 writes

**Why this matters more than quarterly pen-test:** Quarterly is too slow to catch ORM bugs or schema migrations that drop RLS policies. The nightly synthetic JWT forging catches a class of mistakes that pen-testers wouldn't even attempt.

**Owner:** Platform pod CI owner. Sec Lead owns failure triage.

**Gate:** PR cannot merge with TEST-013-A red. No skip flag.

### TEST-014-A — RBAC Permission Matrix Sweep

**Was:** Manual sweep by Sec Lead before release
**Now:** Every PR

**Implementation:**
- Test enumerates the 10 roles × every protected endpoint (currently 47 endpoints across API-001..API-010)
- For each (role, endpoint) cell, the test issues a request as that role; the expected outcome (200/403) is in a `permission_matrix.yaml` source-of-truth file
- Drift between code and `permission_matrix.yaml` fails CI
- New endpoints MUST add a row to `permission_matrix.yaml` in the same PR or CI red

**Why this matters:** Hand-sweeping a 10×47 matrix is error-prone. Codified-yaml-driven test catches every silent role-permission drift.

**Owner:** Platform pod CI owner. Sec Lead owns `permission_matrix.yaml`.

**Gate:** PR cannot merge red.

### TEST-016 — JWT Forgery Resistance

**Was:** Quarterly Sec Lead test
**Now:** Every PR

**Implementation:**
- Test attempts to forge JWTs with: invalid signature, expired-but-otherwise-valid, missing tenant_id, swapped tenant_id, different signing key, none-algorithm attack, weak-key brute-force claim
- All attempts MUST result in 401 with a stable error code
- Test runs against the same JWT validation library used in production

**Owner:** Platform pod CI owner.

**Gate:** PR cannot merge red.

### TEST-018 — Evidence ZIP HMAC Verification (Pack Integrity)

**Was:** Per-release manual verification
**Now:** Every PR

**Implementation:**
- CI job generates a small evidence pack from seed data (1 incident)
- Verifier tool (the same `mendoraci-verify` CLI shipped to customers) runs against the pack
- Verifier MUST report: schema valid, HMAC valid, all components present, mask policy pinned correctly
- Test then mutates 1 byte in the pack and reruns verifier → MUST detect tampering

**Why this matters:** This is the customer-facing trust mechanism. If it breaks silently, every shipped evidence pack becomes a credibility risk. Per-release cadence is too rare.

**Owner:** Backend pod CI owner. Sec Lead owns the verifier tool.

**Gate:** PR cannot merge red.

### TEST-019 — Slack Deep-Link Contract

**Was:** Per-release manual UI test
**Now:** Every PR

**Implementation:**
- CI job invokes API-007 with `channels: ["slack"]` against Slack staging workspace
- Test asserts: notification sent within 5s, deep-link URL is well-formed, deep-link URL points to a valid SCR-005 route with a valid approval_token
- Token is exchanged against API-006 (with mock plan_id) and MUST succeed/fail per expected status (depending on test scenario)

**Why this matters:** A broken Slack deep-link silently kills the approval loop. Once an approver gets one broken link, they trust them less forever.

**Owner:** Backend pod CI owner.

**Gate:** PR cannot merge red.

### TEST-021 — Prompt Promotion Eval Gate (Bypass Attempt)

**Was:** Quarterly Sec Lead red-team
**Now:** Every PR

**Implementation:**
- CI job attempts to call API-010 (prompt promote) with: an `eval_run_id` referencing a red eval, a forged "passed" override in request body, a non-`ai_lead` JWT role
- All three attempts MUST return 409 / 403 / 403 respectively
- Test specifically asserts that no DB write happens on any attempt (`prompt_promotions` row count unchanged)

**Why this matters:** This is the gate that prevents silent prompt-quality regressions from shipping. If it fails-open even once, we have a quality-degradation incident.

**Owner:** Platform pod CI owner. AI Lead owns the gate semantics.

**Gate:** PR cannot merge red.

### TEST-023 — Mask Policy v1 Red-Team N=500

**Was:** Per-release run
**Now:** Every PR + nightly augmented

**Implementation:**
- Every PR: runs full N=500 corpus from `seeds/_redteam/mask_redteam_corpus_v1.jsonl`
- Assertion: 0 leaks (every expected_mask token is replaced with `****`)
- Assertion: false-positive rate ≤ 3% on the 70 near-miss adversarial examples
- Nightly augmented: same 500 + a continuously-growing nightly corpus (pulled from low-risk shadow inferences on prod traffic where novel high-entropy strings appear)

**Why this matters:** The mask policy is the single biggest LLM-data-exposure control. Per-release is too rare; once a regression slips, the next release ships with the regression and any inference in between exposes secrets.

**Owner:** Sec pod CI owner. Sec Lead owns the corpus and FP-rate budget.

**Gate:** PR cannot merge red.

### TEST-025 — Eval Gate Block On Red Eval

**Was:** Per-release run
**Now:** Every PR

**Implementation:**
- CI job artificially fails EVAL-001 on a candidate prompt (returns 79% on gold set instead of ≥92% threshold)
- Attempts to promote → MUST be blocked at API-010 with 409 EVAL_GATE_RED
- DB row count `prompt_promotions` unchanged

**Owner:** AI pod CI owner.

**Gate:** PR cannot merge red.

### TEST-026 — Accessibility (WCAG 2.1 AA)

**Was:** Manual screen-reader walk by FE Lead
**Now:** Automated Axe sweep every PR + manual pass per release

**Implementation:**
- Every PR: Playwright + axe-core sweep on all 7 screens; assertion: 0 violations of WCAG 2.1 AA severity 'serious' or 'critical'
- Per release: FE Lead does manual screen-reader pass for nuances Axe doesn't catch (focus order, ARIA-live verbosity, alt-text quality)

**Owner:** Frontend pod CI owner. FE Lead owns manual pass.

**Gate:** PR cannot merge red on Axe.

---

## 3. CI Pipeline Diagram (Post-Rebalance)

```
PR opened
    ↓
[Lint + Type-check]            (1 min)
    ↓
[Unit tests]                   (3 min)
    ↓
[Integration tests]            (8 min)
    ↓
[Security tests]               (5 min)
    │  ├── TEST-013-A RLS chaos
    │  ├── TEST-014-A RBAC sweep
    │  ├── TEST-016 JWT forgery
    │  ├── TEST-021 prompt promotion bypass
    │  ├── TEST-023 mask red-team N=500
    │  └── TEST-026 Axe accessibility
    ↓
[Contract tests]               (3 min)
    │  ├── TEST-018 evidence ZIP verify
    │  ├── TEST-019 Slack deep-link
    │  └── TEST-025 eval gate red-block
    ↓
[Eval gates]                   (12 min) ← only on prompt-touching PRs
    │  ├── EVAL-001 RCA ≥92%
    │  └── EVAL-002 plan ≥80%
    ↓
[E2E smoke]                    (4 min)
    ↓
PR mergeable iff all green
```

**Total CI wall-time:** ~24 min per PR (longer with eval gates). This is acceptable for the trust uplift.

---

## 4. Ownership Map

| Pod | Owns these CI jobs |
|---|---|
| **Platform** | TEST-013-A RLS, TEST-014-A RBAC, TEST-016 JWT, TEST-021 promotion bypass |
| **Backend** | TEST-018 evidence ZIP, TEST-019 Slack deep-link |
| **AI** | TEST-025 eval gate, EVAL-001/002 |
| **Sec** | TEST-023 mask red-team |
| **Frontend** | TEST-026 Axe accessibility |

Each pod owner: keeps the job green, triages failures within 4 hours during business hours, files tickets for systemic issues.

Cross-cutting accountability: VPE reviews CI red-rate weekly. Pods with >10% red-rate on owned tests get an automatic post-mortem.

---

## 5. What Stays Manual / Quarterly (And Why)

Not everything moves to per-PR. Some tests genuinely cannot be automated to that cadence:

| Test | Stays at | Why |
|---|---|---|
| External penetration test | Quarterly | Real pen-tester human creativity not replicable in CI |
| SOC 2 audit field tests | Annual | By definition external auditor |
| Customer-perceived demo dry-run | Per-release | Human-judged UX feel |
| Multi-tenant cost-ceiling override flow | Per-release | Requires CFO role + multi-day timing |
| Disaster recovery drill | Quarterly | Operationally disruptive to do daily |
| Manual screen-reader pass | Per-release | Axe doesn't catch ARIA-live verbosity issues |

These remain in the 1130 matrix unchanged.

---

## 6. Migration Plan (How To Roll These Out)

Doing all 9 at once would red the CI for several days while teams catch up. Recommended phasing:

**Day 1:** TEST-014-A (RBAC sweep) — simplest to codify
**Day 2:** TEST-013-A (RLS chaos) — high-value, isolated test
**Day 3:** TEST-016 (JWT forgery), TEST-021 (promotion bypass) — short tests
**Day 4:** TEST-018 (evidence ZIP), TEST-019 (Slack deep-link) — integration setup
**Day 5:** TEST-023 (mask red-team) — runtime budget
**Day 6:** TEST-025 (eval gate), TEST-026 (Axe) — final batch

Total: one week to fully rebalance. The 1130 matrix flagged "build readiness Medium-high"; this rebalance moves it to High.

---

## 7. Success Metrics

Pre-rebalance baseline (assumed from 1130 manual cadence):
- Estimated security-test cycle time: 4-6 weeks (between quarterly pen-tests)
- Estimated regression-leak risk: medium (manual sweeps under deadline pressure get skipped)
- Estimated build confidence: 6.5/10

Post-rebalance target (Phase 2 exit):
- Security-test cycle time: every PR (~24 min)
- Regression-leak risk: low (every change re-runs every gate)
- Build confidence: 8.5/10

**Tracking:** PR red-rate by test (rolling 14d window), MTTR per CI red, total PR latency p50/p95. Reviewed in monthly engineering review.

---

## 8. What This Doesn't Solve

This rebalance moves automation **cadence**, not test **scope**. It does not:

- Replace external pen-test (still quarterly)
- Replace SOC 2 audit (still annual)
- Catch issues outside the test set (zero-day classes of bug)
- Replace customer-facing UX testing (still per-release manual)

Those failure modes remain mitigated by their existing controls. This rebalance specifically targets the regression-via-skip-test failure mode, which is the most common build-confidence killer.
