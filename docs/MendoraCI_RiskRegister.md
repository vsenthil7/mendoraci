# MendoraCI_RiskRegister_20260517_1130

**Document Type:** Risk Register (R-01..R-12)
**Version:** 2026-05-17 11:30 DEEP
**Scoring:** Likelihood 1–5 × Impact 1–5 = Score; ≥ 15 critical, 9–14 high, < 9 monitored

---

## 1. Register

| ID | Risk | L | I | Score | Owner | Phase | Indicator | Mitigation | Residual L×I | Review cadence |
|---|---|---|---|---|---|---|---|---|---|---|
| **R-01** | EVAL-001 fails to reach 90% on pilot data | 3 | 5 | **15** | AI Lead | 2–3 | Slice score < 88% any week | IMP-022 gold-set audit; rules fallback `rca_fallback_v1`; slice-by-slice analysis; eval-set refresh | 2×5=10 | Weekly during pilot |
| **R-02** | Secret leaks through Mask v1 gap | 2 | 5 | **10** | Sec Lead | 1 | Any secret_leak_total > 0 | Red-team N=500 continuous; deny-on-fail; provider-extension IMP-016 | 1×5=5 | Continuous |
| **R-03** | LLM provider outage (>4h) | 3 | 4 | **12** | AI Lead | 2 | Provider 5xx > 1% | Model fallback registry IMP-023; rules fallback `rca_fallback_v1`; cache recent decisions for replay | 2×4=8 | Monthly |
| **R-04** | GitHub OAuth app review delays beyond MVP | 2 | 3 | **6** | Platform | 1 | OAuth review > 14 days | PAT fallback in MVP; submission filed Phase 1 hour 0 | 1×3=3 | Per-application |
| **R-05** | Live demo failure on judges | 2 | 5 | **10** | PM | 3 | Dry-run deviation | Pre-recorded fallback `/demo/golden_path.mp4` IMP-018; deterministic seed; 3 dry runs T−24h | 1×5=5 | Per demo |
| **R-06** | Gold-set label noise reduces EVAL quality | 3 | 3 | **9** | AI Lead | 2 | κ < 0.75 in monthly audit | IMP-022 monthly label-quality audit; 3rd-annotator tiebreak protocol | 2×3=6 | Monthly |
| **R-07** | Approver burnout / approval fatigue | 3 | 3 | **9** | Platform Lead | 4 | Median approval cycle > 30 min sustained | Confidence-based auto-suppression for low-blast plans; digest mode; rotation pack IMP-019; OOO delegation RC-010 | 2×3=6 | Monthly |
| **R-08** | Multi-tenant data crossover bug | 2 | 5 | **10** | Sec Lead | 1 | Any cross_tenant_attempt_total > 0 | Postgres RLS; per-tenant DEK; quarterly pen-test (RC-006); IMP-020 RLS hardening | 1×5=5 | Quarterly |
| **R-09** | LLM cost ceiling exceeded; margins collapse | 4 | 3 | **12** | Platform Lead | 2 | Tenant token spend > forecast | FinOps cost ceiling IMP-017 (soft 80%, hard 100% throttle); per-tenant quotas; CSM alerting at 70% | 2×3=6 | Weekly |
| **R-10** | EU residency demanded pre-Phase 4 | 3 | 4 | **12** | Sales | 3–4 | EU prospect with hard requirement | Roadmap pre-sell with target date; deal-desk script; partial deferral incentive; IMP-021 acceleration option | 2×4=8 | Per deal |
| **R-11** | Prompt drift undetected (slow quality regression) | 3 | 4 | **12** | AI Lead | 2 | PSI > 0.2 sustained or class-distribution chi-square p < 0.001 | Drift detector IMP-009; canary + auto-rollback (PromptOps Level 3); replay harness IMP-014 | 2×4=8 | Daily |
| **R-12** | Audit-pack schema breaks downstream GRC tools | 2 | 4 | **8** | GRC | 3 | Customer GRC consumer 4xx | Versioned schema; deprecation policy IMP-025 (≥ 6mo migration window); semver | 1×4=4 | Per release |

---

## 2. Risk Matrix Heatmap

```
Impact ↑
  5  │  R-02   R-05   R-08              R-01
     │  R-08
  4  │                                  R-03, R-09  R-11
     │                                  R-10
  3  │                       R-07       
     │              R-06               
  2  │  R-04        R-12
     │
  1  │
     └──────────────────────────────────────────►
        1       2       3       4       5     Likelihood
```

---

## 3. Critical Risks Deep Dive

### R-01 — EVAL-001 fails pilot threshold (score 15)

**Why critical:** if 12-class classifier scores < 90% on real pilot data, customer cannot trust the RCA, and the BR-003/BR-012 exit gates fail. Cascading: BR-004 plan generation depends on RCA confidence; below threshold flow degrades to manual review queue, eroding the −60% MTTR claim.

**Indicators:**
- Any provider slice < 80%
- Any language slice < 80%
- Slice-weighted macro-F1 < 88% any week during pilot
- Customer-reported misclassification > 1 per 100 incidents

**Mitigations (active):**
- IMP-022 monthly label-quality audit ensures gold set integrity
- `rca_fallback_v1` rules baseline always available as compliance-acceptable fallback (≈58% baseline; not great but governed)
- Slice-by-slice eval reporting so degraded slices identified within a week
- Customer-volunteered failure corpora feed gold-set augmentation

**Recovery if triggered:**
1. Pause new feature ships; AI Lead investigates within 24h
2. Identify failing slice (provider/language/class) via slice-weighted scorecard
3. Augment gold set with relevant adversarial examples
4. Retrain prompt / try fallback model from IMP-023 registry
5. Re-gate; if recovered, resume; if not, recommend customer extends pilot or accepts current threshold with documentation

**Residual after mitigation:** 2×5 = 10 (still high; ongoing weekly review)

---

### R-02 — Secret leaks (score 10, critical-tier impact)

**Why critical:** any secret leak through to LLM or persisted storage is a P1 incident, customer trust-destroying, potentially statutorily reportable depending on the secret type.

**Mitigations (active):**
- Mask Policy v1 with regex + entropy + provider patterns
- Continuous red-team corpus N=500
- Deny-on-fail (mask engine failure blocks intake; no fallback)
- IMP-016 secret-scanning provider extension
- Log scrubber `log_scrub_v1` applies same patterns to all log output
- Pre-LLM-call defensive scan as belt-and-braces (catches model-side regression)

**Indicators:** any `secret_leak_total > 0` ever, in any environment. Continuous monitoring.

**Recovery:** P1 page; immediate Mask Policy hotfix; customer notification within 24h; affected tenant data scrubbed; root-cause analysis within 5 business days.

---

### R-08 — Multi-tenant crossover (score 10, critical-tier impact)

**Why critical:** SaaS-existential.

**Mitigations:**
- Postgres RLS on every tenant-scoped table (RC-021)
- Application sets `SET LOCAL app.tenant_id` per request; cross-tenant queries impossible at DB layer
- Per-tenant DEK for `tenant_secrets`
- Quarterly external pen-test (RC-006)
- IMP-020 risk-owner staffing + RLS hardening sweep

**Indicators:** any `cross_tenant_attempt_total > 0` (alert P1 immediately).

---

## 4. Risk Ownership & Cadence

| Owner | Risks owned | Review cadence | Reporting |
|---|---|---|---|
| AI Lead | R-01, R-03, R-06, R-11 | Weekly during pilot, monthly steady-state | EVAL board |
| Sec Lead | R-02, R-08 | Continuous (metric-driven) + quarterly audit | Security board |
| Platform Lead | R-07, R-09 | Monthly | Ops review |
| PM | R-05 | Per-demo | Demo report |
| Platform Engineering | R-04 | Per-application | Build tracker |
| Sales | R-10 | Per-deal | Sales pipeline review |
| GRC | R-12 | Per-release | Schema-change log |

All 12 risks have named owners by Phase 4 mid (IMP-020 closure).

---

## 5. Risk Trend (Phase Phase 1 → Phase 5)

| Risk | P1 score | P2 score | P3 score | P4 score (post-mitigation) |
|---|---|---|---|---|
| R-01 | 15 | 12 | 10 | 8 |
| R-02 | 10 | 5 | 5 | 5 |
| R-03 | 12 | 8 | 8 | 8 |
| R-04 | 6 | 3 | 3 | 3 |
| R-05 | 10 | 10 | 5 | 5 |
| R-06 | 9 | 6 | 6 | 6 |
| R-07 | 9 | 9 | 9 | 6 |
| R-08 | 10 | 8 | 8 | 5 |
| R-09 | 12 | 6 | 6 | 6 |
| R-10 | 12 | 12 | 10 | 8 |
| R-11 | 12 | 8 | 8 | 8 |
| R-12 | 8 | 8 | 4 | 4 |
| **Aggregate** | **125** | **95** | **82** | **72** |

Net 42% risk-aggregate reduction by Phase 4 end.
