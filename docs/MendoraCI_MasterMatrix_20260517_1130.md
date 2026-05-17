# MendoraCI_MasterMatrix_20260517_1130

**Document Type:** Comparative Master Matrix — Deep Enhanced
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Option Set

| OPT | Name | Type | Disposition |
|---|---|---|---|
| OPT-001 | **MendoraCI** | AI-driven CI reliability + HITL governance + evidence | **Recommended** |
| OPT-002 | Roll-your-own (scripts + Slack + Jira) | Status quo | Fails governance |
| OPT-003 | BuildPulse | Flaky-test SaaS | Adjacent, narrow |
| OPT-004 | Trunk Flaky Tests | Flaky-test SaaS + PR/Jira | Adjacent, narrow |
| OPT-005 | Generic AI Copilot (Copilot/Q/Cursor) | IDE assist | Wrong layer |
| OPT-006 | Datadog CI Visibility + governance overlay | Observability + custom governance | Heaviest competitor |
| OPT-007 | CircleCI Insights + workflow rules | CI-native dashboards | Single-provider |
| OPT-008 | Sentry (release health + alerts) | Prod-side correlation | Wrong layer |

---

## 2. Weighted Evaluation Factors

| Factor | Weight | Sub-factors |
|---|---|---|
| F1 — CI failure RCA depth | 18 | F1a taxonomy breadth, F1b inference quality, F1c explainability |
| F2 — Repair plan generation | 14 | F2a schema, F2b alternatives, F2c blast-radius reasoning |
| F3 — HITL governance | 14 | F3a signed approvals, F3b dual-approval, F3c delegation |
| F4 — Evidence / audit readiness | 14 | F4a manifest, F4b signing, F4c retention, F4d Article 12 fit |
| F5 — Secret masking determinism | 8 | F5a patterns, F5b entropy, F5c deny-on-fail |
| F6 — PromptOps governance | 7 | F6a registry, F6b rollback, F6c canary |
| F7 — Multi-provider CI coverage | 6 | F7a GH/Jenkins/CircleCI/GitLab/Buildkite |
| F8 — Multi-tenant isolation | 5 | F8a RLS, F8b key-per-tenant |
| F9 — Commercial fit / ACV | 6 | F9a tiers, F9b expansion, F9c sales motion |
| F10 — Demo readiness | 4 | F10a 5-min flow, F10b deterministic seed |
| F11 — Operational readiness | 4 | F11a on-call, F11b observability, F11c chaos |
| **Total** | **100** | |

---

## 3. Scored Matrix (0–5; weighted /500 → /100)

| Factor (wt) | MendoraCI | Roll-your-own | BuildPulse | Trunk | Copilot | Datadog+ | CircleCI Ins | Sentry |
|---|---|---|---|---|---|---|---|---|
| F1 RCA (18) | 5 | 1 | 2 | 2 | 3 | 3 | 2 | 2 |
| F2 Repair plan (14) | 5 | 1 | 1 | 2 | 3 | 1 | 1 | 1 |
| F3 HITL gov (14) | 5 | 1 | 1 | 2 | 0 | 1 | 1 | 1 |
| F4 Evidence (14) | 5 | 0 | 1 | 1 | 0 | 2 | 1 | 1 |
| F5 Masking (8) | 5 | 1 | 2 | 2 | 1 | 3 | 1 | 2 |
| F6 PromptOps (7) | 5 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| F7 CI coverage (6) | 4 | 3 | 5 | 5 | 5 | 5 | 1 | 4 |
| F8 Multi-tenant (5) | 4 | 1 | 4 | 4 | 4 | 5 | 4 | 4 |
| F9 Commercial (6) | 4 | 1 | 4 | 4 | 5 | 5 | 4 | 4 |
| F10 Demo (4) | 4 | 1 | 4 | 4 | 5 | 3 | 3 | 3 |
| F11 Ops (4) | 3 | 1 | 4 | 4 | 5 | 5 | 4 | 4 |
| **Weighted /500** | **466** | **74** | **186** | **218** | **216** | **244** | **154** | **180** |
| **Score /100** | **93.2** | **14.8** | **37.2** | **43.6** | **43.2** | **48.8** | **30.8** | **36.0** |

---

## 4. Comparative Effort & Time-to-Value

| Option | Pilot build effort | Hidden cost | Time to first value | Integration months |
|---|---|---|---|---|
| MendoraCI | $0 (SaaS pilot $48K) | LLM tokens (capped IMP-017) | ~7 days | 0.5–1 |
| Roll-your-own | 6–12 person-months | ~0.5 FTE maintenance | 60–120 days | 3–6 |
| BuildPulse | $0 SaaS | Gap on RCA/repair/evidence remains | ~5 min flake; ∞ full scope | 0.25 |
| Trunk | $0 SaaS | Same gap | ~30 min flake; ∞ full scope | 0.25 |
| Copilot/Q | Per-seat | No governance; raises CFR per DORA 2025 | Day 1 suggestions; never governance | 1 |
| Datadog+ | Significant if not on Datadog | $20/committer + 3–6mo governance build | 60–120 days | 3–6 |
| CircleCI Insights | $0 if on CircleCI | Single-provider lock-in | 1 day insights; ∞ AI repair | 0.5 |
| Sentry | $0 if on Sentry | Wrong layer | n/a CI | n/a |

---

## 5. Commercial Comparison

| Option | License model | ACV proxy | Expansion friction |
|---|---|---|---|
| MendoraCI | Hybrid per-committer + flat governance | $48K Pilot / $156K Team / $412K Ent / $890K+ Strategic | Low |
| Roll-your-own | Internal cost | ~$300K/yr (0.5 FTE platform + 0.25 FTE compliance) | High |
| BuildPulse | Per-repo plans | ~$15K–$60K | Low |
| Trunk | Per-seat | $40K–$120K | Low |
| Copilot/Q | $10–$39/dev/mo | $24K–$94K for 200 devs | Low |
| Datadog | $20/committer + Test Optim | $48K–$150K for 200 devs | Med — governance overlay maint |
| CircleCI Insights | Bundled w/ CircleCI | Marginal | Low (if on CircleCI) |
| Sentry | Per-event | $30K–$80K | Med |

---

## 6. Risk Comparison

| Option | Governance gap risk | Vendor risk | Audit risk (Art. 12) |
|---|---|---|---|
| MendoraCI | **Low** — purpose-built | Medium (new vendor; mitigated by exportable evidence) | **Low** |
| Roll-your-own | **High** — Slack approvals not Article 12 evidence | Internal | **High** |
| BuildPulse | High — no HITL, no evidence | Low | High |
| Trunk | High — same | Low | High |
| Copilot/Q | **Very high** — no governance, raises instability (DORA 2025) | Low (MS/AWS) | Very high |
| Datadog+ | Medium — governance custom-built; lacks approval workflows | Low | Medium |
| CircleCI Insights | High | Low | High |
| Sentry | High — wrong layer | Low | High |

---

## 7. Demo Readiness Comparison

| Option | 5-min golden path? | Deterministic seed? | Live HITL flow? | Evidence pack export? |
|---|---|---|---|---|
| MendoraCI | Yes | Yes (IMP-018) | Yes | Yes |
| Roll-your-own | n/a | n/a | n/a | n/a |
| BuildPulse | Yes (flake dashboard) | Yes | No | No |
| Trunk | Yes (flake + PR comment) | Yes | No | No |
| Copilot/Q | Yes (suggestion) | No | No | No |
| Datadog | Yes (CI Visibility dashboard) | Partial | No | Partial (logs only) |
| CircleCI Insights | Yes | No | No | No |
| Sentry | Yes (release health) | Partial | No | Partial |

---

## 8. Cell-by-Cell Rationale (selected)

- **F1 RCA = 5 (MendoraCI):** 12-class taxonomy + EVAL-001 92% promotion + top-3 explainability. Datadog (3) classifies by "domain" only, not QA-actionable.
- **F2 Repair plan = 5:** Structured JSON schema with alternatives + blast-radius + rollback. No competitor produces governed, structured repair plan.
- **F3 HITL = 5:** Signed records with operator_id + justification ≥ 20 chars + plan_hash. Article 12-grade. Eliminates OPT-002.
- **F4 Evidence = 5:** Signed ZIP + immutable manifest + 10-year retention. Datadog (2) has logs but no incident-bound evidence ZIP.
- **F6 PromptOps = 5:** Prompt registry + canary + auto-rollback (Level 3). No competitor has this for CI-reliability.
- **F11 Ops = 3 (MendoraCI, MVP):** Lower than Datadog (5) because Phase 4 features (on-call, chaos pack) not yet GA — uplift to 5 post-Phase-4 via IMP-015/IMP-019.

---

## 9. Final Decision

**Recommend OPT-001 MendoraCI.** Weighted total 93.2/100, ahead of nearest (OPT-006 Datadog overlay at 48.8) by 44.4 points. Dominant on F1–F6 (the governed-AI-repair wedge).

---

## 10. Sensitivity Analysis

| Scenario | Effect on ranking |
|---|---|
| Customer already on Datadog, willing to fund 3–6mo governance build | OPT-006 closes gap to ~70/100; still loses on F2/F3/F4/F6 |
| Customer needs ONLY flake (no governance) | OPT-003/004 win; MendoraCI overkill |
| Customer hostile to LLM | Fallback OPT-002 rules+Slack; loses on F4 under EU AI Act |
| Customer demands on-prem MVP | MendoraCI cannot serve (Phase 5); OPT-002 wins by default |
| EVAL-001 fails 90% pilot | Decision still favors OPT-001 because governance value is intrinsic; AI recoverable via IMP-022/IMP-023 |
| LLM outage > 4 hr | `rca_fallback_v1` preserves intake+plan path; no other option has governed fallback |

**Robustness:** MendoraCI remains top choice under all scenarios except (a) flake-only buyer, (b) hard on-prem in MVP — both addressed in roadmap (Phase 5 on-prem; Phase 4 narrow-flake tier).
