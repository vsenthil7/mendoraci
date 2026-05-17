# MendoraCI_ObservabilityPack_20260517_1130

**Document Type:** Observability Pack (Logs, Metrics, Traces, Dashboards, Alerts, SLOs)
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Logs

**Format:** structured JSON, OTel-compatible. Required fields on every log line: `timestamp`, `level`, `service`, `tenant_id`, `request_id`, `event_name`, plus event-specific payload.

**Storage:** per-tenant log buckets in S3 (24-month retention for ops logs; 10-year retention for `prompt_runs`, `approval_records`, `audit_exports` which are DB-backed, not log-backed).

**Scrubber:** mandatory `log_scrub_v1` middleware runs Mask Policy v1 patterns on every log line before write. Red-team verified zero-leak.

**Key event names:**
- `intake.received`, `intake.masked`, `intake.rejected`
- `rca.classified`, `rca.fallback_engaged`, `rca.manual_review_queued`
- `plan.generated`, `plan.schema_invalid`, `plan.manual_authored`
- `approval.signed`, `approval.rejected`, `approval.token_expired`, `approval.plan_hash_drift`
- `evidence.exported`, `evidence.signer_unavailable`
- `prompt.promoted`, `prompt.rolled_back`, `prompt.canary_started`
- `eval.gate_passed`, `eval.gate_failed`, `eval.drift_alert`
- `security.cross_tenant_attempt`, `security.mask_failure`, `security.token_revoked`

---

## 2. Metrics (Prometheus)

| Metric | Type | Labels | SLO target |
|---|---|---|---|
| `mendoraci_intake_received_total` | counter | tenant, provider | — |
| `mendoraci_intake_p95_latency_seconds` | histogram | tenant | ≤ 5s |
| `mendoraci_mask_failure_total` | counter | tenant, reason | 0 / quarter (hard) |
| `mendoraci_rca_inference_p95_seconds` | histogram | tenant, model, prompt_version | ≤ 8s |
| `mendoraci_rca_confidence` | histogram | tenant, class | tracked, not SLO'd |
| `mendoraci_rca_fallback_engaged_total` | counter | tenant, reason | ≤ 1% of intakes |
| `mendoraci_plan_schema_invalid_total` | counter | tenant | ≤ 0.5% of plans |
| `mendoraci_approval_cycle_seconds` | histogram | tenant | median ≤ 22 min (pilot) |
| `mendoraci_evidence_export_p95_seconds` | histogram | tenant | ≤ 60s |
| `mendoraci_evidence_signer_failure_total` | counter | tenant | 0 (page on event) |
| `mendoraci_eval_gate_failures_total` | counter | gate_name (eval-001 / eval-002), prompt_version | 0 in main branch |
| `mendoraci_drift_psi` | gauge | tenant, feature | alert > 0.2 |
| `mendoraci_llm_tokens_total` | counter | tenant, model | feeds cost ceiling |
| `mendoraci_secret_leak_total` | counter | tenant | **0 hard SLO** |
| `mendoraci_cross_tenant_attempt_total` | counter | actor_tenant, target_tenant | **0 hard SLO** |
| `mendoraci_uptime_synthetic` | gauge | endpoint | 99.5 / 99.9 SLO |

Cardinality cap: max 10K active series per tenant per metric (enforced at scrape).

---

## 3. Traces (OpenTelemetry)

Every external request creates a root span. Required child spans:

```
http.request                                  (root)
├── auth.jwt_validate
├── intake.accept                             API-001
│   ├── mask.apply                            Mask Policy v1
│   └── db.write raw_intake
├── rca.inference                             API-004 (8s p95)
│   ├── llm.call                              (model, prompt_version, tokens)
│   └── db.write prompt_runs
├── plan.generate                             API-005
│   └── llm.call
├── approval.notify                           API-007
│   ├── slack.send
│   └── email.send
├── approval.sign                             API-006
│   ├── hmac.compute
│   └── db.append approval_records
├── evidence.collect                          API-008
│   ├── object_store.read
│   └── manifest.build
└── evidence.sign
    ├── kms.sign
    └── object_store.write
```

Every span carries: `tenant_id`, `request_id`, `prompt_version` (where applicable), `model_id`, `gold_set_version`, `mask_policy_version`.

Sampling: 100% for errors; 10% baseline for success; 100% for first 100 requests of each new prompt_version (post-promotion).

---

## 4. Dashboards (Grafana)

| Dashboard | Audience | Key panels |
|---|---|---|
| **MendoraCI SLO** | SRE on-call | uptime, intake p95, RCA p95, mask failures, secret leaks, evidence signer failures |
| **MendoraCI EVAL** | AI Lead | EVAL-001/002 latest scores, slice breakdown, drift PSI, gate-failure timeline |
| **MendoraCI Cost** | Platform Lead | tokens by tenant/model, $ spend trend, cost-ceiling utilization |
| **MendoraCI Customer KPI** | CSM (per tenant) | MTTR, debug effort, flaky recurrence, evidence completeness, approval cycle (mirrors SCR-007) |
| **MendoraCI Security** | Sec Lead | mask failures, cross-tenant attempts, token revocations, RBAC denials |

---

## 5. Alerts & Runbook Links

| Alert | Severity | Trigger | Runbook |
|---|---|---|---|
| `mask_failure_any` | P1 | `mask_failure_total > 0` over 1 min | RB-01 mask-engine-rollback |
| `secret_leak_detected` | P1 | `secret_leak_total > 0` ever | RB-02 secret-leak-incident |
| `cross_tenant_attempt` | P1 | `cross_tenant_attempt_total > 0` ever | RB-03 cross-tenant-incident |
| `evidence_signer_down` | P1 | `evidence_signer_failure_total > 0` | RB-04 signer-failover |
| `eval_gate_red_in_main` | P1 | `eval_gate_failures_total{branch=main} > 0` | RB-05 emergency-rollback |
| `drift_psi_high` | P2 | `drift_psi > 0.2` sustained 1h | RB-06 drift-investigation |
| `intake_p95_high` | P2 | `intake_p95 > 5s` sustained 10 min | RB-07 latency-investigation |
| `cost_ceiling_80pct` | P3 | per-tenant 80% of monthly cap | RB-08 cost-notify |
| `cost_ceiling_100pct` | P2 | per-tenant 100% of monthly cap → throttle | RB-09 cost-throttle |
| `dlq_depth_high` | P2 | any DLQ > 50/hr | RB-10 dlq-drain |
| `rca_fallback_rate_high` | P3 | fallback > 5% over 1h | RB-11 fallback-investigation |
| `synthetic_uptime_below_slo` | P2 | `uptime_synthetic < 99.5%` over 1h window | RB-12 availability |

P1 → page on-call; P2 → ticket + Slack channel; P3 → Slack only.

---

## 6. SLO Definitions

| SLO | Target (MVP) | Target (Pilot) | Target (Prod) | Error budget |
|---|---|---|---|---|
| Availability (synthetic) | 99.5% | 99.7% | 99.9% | 43.2 min / 30d (prod) |
| Intake p95 ≤ 5s | 95% | 97% | 99% | per-request budget |
| RCA inference p95 ≤ 8s | 90% | 95% | 97% | per-request budget |
| Evidence export p95 ≤ 60s | 95% | 97% | 99% | per-request budget |
| Mask failures | 0 | 0 | 0 | **0 — hard gate** |
| Secret leaks | 0 | 0 | 0 | **0 — hard gate** |
| Cross-tenant leaks | 0 | 0 | 0 | **0 — hard gate** |
| EVAL gate red in main | 0 | 0 | 0 | **0 — hard gate** |

Error budget tracked monthly. Exhaustion triggers feature-freeze + reliability sprint.

---

## 7. Synthetic Probes

- HTTPS probe on `/health` every 30s from 3 regions
- End-to-end synthetic intake every 5 min (uses `synthetic-tenant` with seeded log) — measures full pipeline
- Evidence-export synthetic every 15 min
- Failure → P2 alert; sustained 3 cycles → P1
