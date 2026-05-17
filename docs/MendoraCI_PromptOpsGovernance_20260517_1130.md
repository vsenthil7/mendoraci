# MendoraCI_PromptOpsGovernance_20260517_1130

**Document Type:** PromptOps Governance Model
**Version:** 2026-05-17 11:30 DEEP
**Maturity Target:** Level 3 (canary + auto-rollback)

---

## 1. Prompt Registry

**Storage:** prompts live in `/prompts/` directory of the MendoraCI mono-repo (Git source-of-truth). A Postgres mirror table `prompts` provides runtime lookup. Mirror is one-way: Git → Postgres on deploy.

**Schema (`prompts` table):**

| Field | Type | Notes |
|---|---|---|
| prompt_version | VARCHAR PK | e.g. `PR-RCA-002` |
| family | ENUM('rca','plan') | which task |
| body_template | TEXT | full prompt with placeholders |
| schema_input | JSONB | expected variable schema |
| schema_output | JSONB | expected structured output |
| owner_user_id | UUID FK | author |
| status | ENUM('candidate','canary','active','superseded','rolled_back') | lifecycle |
| superseded_by | VARCHAR FK | when status=superseded |
| created_at | TIMESTAMPTZ | |
| promoted_at | TIMESTAMPTZ | |

Immutable rows: any change creates a new `prompt_version`. The semver of `prompt_version` is `PR-{FAMILY}-{NNN}` where NNN is monotonic.

---

## 2. Lifecycle State Machine

```
draft (Git branch)
  │
  ▼ open PR
candidate (CI eval runs)
  │
  ├─ EVAL gate red → blocked (PR cannot merge)
  │
  ▼ EVAL gate green + AI Lead approval
canary (5% traffic for canary_window_hours)
  │
  ├─ canary metric divergence > ±2pp → auto-rollback (status=rolled_back)
  │
  ▼ canary success
active (100% traffic)
  │
  ▼ superseded by new active
superseded (history retained)
```

---

## 3. Roles & Permissions (per RBAC)

| Role | Permission |
|---|---|
| Prompt Author (any engineer) | Open PR with new prompt version; cannot promote |
| Eval Owner (AI Lead) | Owns gold sets; reviews EVAL runs |
| Promotion Approver (AI Lead) | Signs `prompt_promotions` row via API-010 |
| Major-Change Co-Approver (VPE) | Required for breaking schema changes |

Prompt Author cannot also self-approve promotion (separation of duties).

---

## 4. EVAL Gates

Each PR with prompt changes triggers CI job `eval-gate`:

1. Build candidate prompt artifact
2. Run EVAL-001 (if `family=rca`) or EVAL-002 (if `family=plan`) against current gold set
3. Write results to `eval_runs`
4. Compare against active prompt's last eval result
5. **Promotion criteria:**
   - Slice-weighted macro-F1 (EVAL-001) ≥ current_active − 1pp AND ≥ 90% (pilot threshold)
   - OR Usefulness rate (EVAL-002) ≥ current_active − 2pp AND ≥ 85% (pilot threshold)
   - Hard gates: schema validity 100%; hallucinated-file rate 0
   - No fairness slice below absolute floor (80% provider/language slices)
6. **Gate green** → PR mergeable, `status='candidate'`
7. **Gate red** → PR blocked; merge button greyed in GitHub

---

## 5. Canary Mechanism

On API-010 promote call with `canary_pct=5, canary_window_hours=24`:

1. Promotion row written to `prompt_promotions` with status `canary_started`
2. Runtime router begins sending 5% of inferences to candidate prompt
3. Live metrics tracked: confidence distribution, output class distribution, latency, refusal rate, downstream approver-rejection rate
4. Continuous comparison: every 1h, compare candidate metrics to incumbent on rolling 1h window
5. **Auto-rollback triggers** (any one):
   - Any candidate metric diverges > ±2pp from incumbent for 2 consecutive 1h windows
   - Refusal rate > 5% absolute
   - Latency p95 > 1.5× incumbent
   - Any hallucinated-file event
6. On rollback: status `rolled_back`; alert + ticket; AI Lead investigates
7. On success (full canary window passed): status `active`; previous active → `superseded`

---

## 6. Rollback

**Manual rollback** (any time): API-010 with rollback intent → revert active to `rollback_target`. Target ≤ 30s wall-clock.

**Automatic rollback** (triggers above): same mechanism, no human gate.

**Audit:** every promotion AND rollback creates immutable row in `prompt_promotions` with full justification, eval_run_id, approver_id, and outcome. This ledger satisfies EU AI Act Article 12 logging.

---

## 7. Gold-Set Governance

(Cross-ref: BRD §16a.7)

- Gold sets versioned: `gold_set_v1.0`, `v1.1`, etc. Immutable per version.
- Storage: S3 with Object Lock (no deletion possible).
- Promotion of new gold-set version requires:
  - AI Lead approval
  - Label-quality audit on 5% blind re-label sample (κ ≥ 0.75 for EVAL-001; κ ≥ 0.70 for EVAL-002)
  - Drift-rebaseline test: run incumbent prompt against new gold set; expect score within ±2pp of old gold-set score (else investigate)
- Refresh cadence: quarterly + ad-hoc when novel-failure feedback accumulates
- Old gold-set versions retained 10 years

---

## 8. Drift Detection (IMP-009)

**Input drift:** PSI on feature distribution (token-frequency histograms, log-length distribution, provider mix) computed daily over rolling 7-day vs reference window. Alert: PSI > 0.2 sustained 48h.

**Output drift:** chi-square on class distribution of `rca_runs.predicted_class` daily over rolling 7-day vs reference. Alert: p-value < 0.001 sustained 48h.

**Action on alert:** AI Lead investigates within 5 business days; may trigger eval-set refresh or rollback.

---

## 9. Compliance Mapping

| EU AI Act / ISO 42001 | PromptOps mechanism |
|---|---|
| Article 12 — automatic logging over lifetime | `prompt_runs` immutable row per inference with full pins; 10y retention |
| Article 14 — human oversight | `prompt_promotions` requires AI Lead signature; canary + rollback are human-gated for non-auto cases |
| Article 15 — accuracy, robustness, cybersecurity | EVAL gates + slice fairness + drift detection + canary rollback |
| Article 18 — tech-doc retention | Prompts and eval runs retained 10 years in immutable storage |
| ISO 42001 §6.1 risk management | Gold-set governance, drift detection, fallback registry |
| ISO 42001 §8.4 change management | PromptOps lifecycle state machine + canary |

---

## 10. Open-Source Adjacencies

The MendoraCI PromptOps model is informed by emerging PromptOps Level 3 patterns (registry + canary + auto-rollback). Where adapted, it adds: per-tenant pinning, EU AI Act-aligned retention, integrated label-quality audit, and per-prompt fairness floors — not all present in general-purpose PromptOps tooling.
