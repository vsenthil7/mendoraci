# MendoraCI_DemoSeedPackSpec_20260517_1208

**Document Type:** Demo Seed Pack Specification with Concrete Artifacts
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 6 — "Demo data needs exact seed artifacts"
**Repository location:** `mendoraci-platform/seeds/acmepilot/`

This document specifies every artifact required to run the 5-minute golden-path demo deterministically. All payloads are reproducible from this spec. Builders should place these files under `seeds/acmepilot/` and `seeds/acmesecret/` (backup scenario).

---

## 0. Seed Pack Inventory

| # | File | Purpose |
|---|---|---|
| 1 | `seeds/acmepilot.sql` | Tenant/user/repo bootstrap |
| 2 | `seeds/acmepilot/jenkins_oom_failure.log` | Primary intake fixture (15 MB) |
| 3 | `seeds/acmepilot/masked_jenkins_oom_failure.log` | Expected post-mask output |
| 4 | `seeds/acmepilot/rca_response.json` | Expected RCA result |
| 5 | `seeds/acmepilot/repair_plan.json` | Expected plan |
| 6 | `seeds/acmepilot/approval_record.json` | Expected approval ledger row |
| 7 | `seeds/acmepilot/evidence_manifest.json` | Expected evidence manifest |
| 8 | `seeds/acmepilot/evidence_pack.zip.structure` | ZIP structure spec |
| 9 | `seeds/acmesecret/secret_rotation_failure.log` | Backup scenario C (RC-030) |
| 10 | `seeds/acmeflaky/parser_test_flaky.log` | Backup scenario B (BR-010) |
| 11 | `seeds/acmepilot/historical_intakes_30d.sql` | SCR-007 dashboard seed |
| 12 | `seeds/_eval/eval_001_gold_set_v1.0.jsonl` | EVAL-001 gold set |
| 13 | `seeds/_eval/eval_002_gold_set_v1.0.jsonl` | EVAL-002 gold set |
| 14 | `seeds/_redteam/mask_redteam_corpus_v1.jsonl` | N=500 mask red-team corpus |

---

## 1. Tenant Bootstrap (`seeds/acmepilot.sql`)

```sql
-- AcmePilot — canonical demo tenant
INSERT INTO tenants (tenant_id, name, tier, region, status, cost_ceiling_usd_monthly)
VALUES ('a11ce000-0000-0000-0000-000000000001', 'AcmePilot', 'team', 'us-east-1', 'active', 5000.00);

-- Users
INSERT INTO users (user_id, tenant_id, email, display_name) VALUES
('a11ce000-0000-0000-0000-000000000010', 'a11ce000-0000-0000-0000-000000000001', 'marcus@acmepilot.demo', 'Marcus Chen'),
('a11ce000-0000-0000-0000-000000000011', 'a11ce000-0000-0000-0000-000000000001', 'lin@acmepilot.demo', 'Lin Park'),
('a11ce000-0000-0000-0000-000000000012', 'a11ce000-0000-0000-0000-000000000001', 'priya@acmepilot.demo', 'Priya Singh'),
('a11ce000-0000-0000-0000-000000000013', 'a11ce000-0000-0000-0000-000000000001', 'audit@acmepilot.demo', 'Audit Sam');

-- Role assignments
INSERT INTO role_assignments (tenant_id, user_id, role, granted_by_user_id) VALUES
('a11ce000-0000-0000-0000-000000000001', 'a11ce000-0000-0000-0000-000000000010', 'tenant_admin', 'a11ce000-0000-0000-0000-000000000010'),
('a11ce000-0000-0000-0000-000000000001', 'a11ce000-0000-0000-0000-000000000011', 'approver', 'a11ce000-0000-0000-0000-000000000010'),
('a11ce000-0000-0000-0000-000000000001', 'a11ce000-0000-0000-0000-000000000011', 'security_approver', 'a11ce000-0000-0000-0000-000000000010'),
('a11ce000-0000-0000-0000-000000000001', 'a11ce000-0000-0000-0000-000000000012', 'viewer', 'a11ce000-0000-0000-0000-000000000010'),
('a11ce000-0000-0000-0000-000000000001', 'a11ce000-0000-0000-0000-000000000013', 'auditor', 'a11ce000-0000-0000-0000-000000000010');

-- Repository
INSERT INTO repositories (repo_id, tenant_id, provider, external_id, repo_url, default_branch, status, linked_at)
VALUES ('a11ce000-0000-0000-0000-000000000020', 'a11ce000-0000-0000-0000-000000000001', 'github', '123456789', 'https://github.com/acmepilot/parser-svc', 'main', 'linked', NOW() - INTERVAL '14 days');

-- Quota
INSERT INTO tenant_quotas (tenant_id, monthly_llm_calls_limit, monthly_cost_usd_limit, current_month_llm_calls, current_month_cost_usd)
VALUES ('a11ce000-0000-0000-0000-000000000001', 50000, 5000.00, 1247, 187.55);
```

---

## 2. Sample Jenkins Failure Log (`seeds/acmepilot/jenkins_oom_failure.log`)

This is a **representative 15 MB log** in the actual repo; the spec below shows the salient excerpts that contain (a) secrets to be masked, (b) the actual OOM signature.

```
Started by user marcus@acmepilot.demo
Building on master in workspace /var/jenkins_home/workspace/parser-svc
[Pipeline] Start of Pipeline
[Pipeline] checkout
Cloning the remote Git repository
Using credential github-pat-marcus
Cloning repository https://github.com/acmepilot/parser-svc
> git config remote.origin.url https://[email protected]/acmepilot/parser-svc
> git rev-parse --is-inside-work-tree
> git config core.sparsecheckout
> git checkout -f e3a7b1c0f8d4
[Pipeline] sh
+ export AWS_ACCESS_KEY_ID=AKIA4XEXAMPLEKEY7K3W
+ export AWS_SECRET_ACCESS_KEY=tNiQVMa0F6Y3xJp8Lr3oCsExampleSecretRotateMe
+ export DATADOG_API_KEY=da7adf6e8b9c2example4567890abcdef
+ export STRIPE_SECRET_KEY=sk_live_51Example9XYZabcDEFghij
+ npm install
npm WARN ...
+ npm test
> [email protected] test
> jest --maxWorkers=2

[... 2.3 MB of test output ...]

PASS  src/utils/__tests__/format.test.ts
PASS  src/utils/__tests__/validate.test.ts
PASS  src/parser/__tests__/tokenizer.test.ts
RUNS  src/parser/__tests__/ast-builder.test.ts

[... 1.2 MB of test output, with intermittent partial test results ...]

<--- Last few GCs --->
[1234:0x7f8b4c008000]    87234 ms: Mark-sweep 1397.5 (1424.9) -> 1396.8 (1425.4) MB, 1145.4 / 0.1 ms  (average mu = 0.171, current mu = 0.025) allocation failure scavenge might not succeed
[1234:0x7f8b4c008000]    88513 ms: Mark-sweep 1397.5 (1425.4) -> 1396.9 (1425.9) MB, 1230.3 / 0.1 ms  (average mu = 0.099, current mu = 0.024) allocation failure scavenge might not succeed

<--- JS stacktrace --->
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
 1: 0x9b03e0 node::Abort() [node]
 2: 0x8de6a1 node::FatalError(char const*, char const*) [node]
 3: 0xb86b50 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [node]
 4: 0xb86ec7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, bool) [node]
 5: 0xd9e1c5  [node]
 6: 0xd9ed68 v8::internal::Heap::RecomputeLimits(v8::internal::GarbageCollector) [node]
 [...]
21: 0x16a3b3b9af1d
 at /var/jenkins_home/workspace/parser-svc/src/parser/ast-builder.js:421:18
 at processBuffer (src/parser/ast-builder.js:418:5)
 at /var/jenkins_home/workspace/parser-svc/src/parser/__tests__/ast-builder.test.ts:73:11

[Pipeline] }
[Pipeline] // stage
[Pipeline] }
[Pipeline] // node
[Pipeline] End of Pipeline
ERROR: script returned exit code 137  // OOM kill
Finished: FAILURE
```

**Salient features:**
- 4 different secret types embedded: GitHub PAT, AWS access key, AWS secret, Datadog API key, Stripe live key
- OOM signature is unmistakable: `Reached heap limit`, `exit code 137`, V8 stack trace
- File path `src/parser/ast-builder.js:421` is the proximate cause
- Realistic noise: ~15 MB total with `[... X MB of test output ...]` ellipsis representing typical jest verbose output

---

## 3. Expected Mask Output (`seeds/acmepilot/masked_jenkins_oom_failure.log`)

The same log after Mask Policy v1 is applied — every secret is replaced with a deterministic token:

```
Started by user marcus@acmepilot.demo
Building on master in workspace /var/jenkins_home/workspace/parser-svc
[Pipeline] Start of Pipeline
[Pipeline] checkout
Cloning the remote Git repository
Using credential github-pat-marcus
Cloning repository https://github.com/acmepilot/parser-svc
> git config remote.origin.url https://****@github.com/acmepilot/parser-svc
> git rev-parse --is-inside-work-tree
> git config core.sparsecheckout
> git checkout -f e3a7b1c0f8d4
[Pipeline] sh
+ export AWS_ACCESS_KEY_ID=AKIA****
+ export AWS_SECRET_ACCESS_KEY=****
+ export DATADOG_API_KEY=****
+ export STRIPE_SECRET_KEY=sk_live_****
+ npm install

[... mask preserves structure, redacts ONLY the secret values ...]

(OOM signature unchanged — masking is structural, not content-destructive)
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
[... stack trace unchanged ...]
ERROR: script returned exit code 137
Finished: FAILURE
```

**Masking properties verified:**
- Secret values redacted; secret format prefix retained (AKIA, sk_live_, ghp_) for debugging
- Log structure preserved
- Error signatures (OOM, exit codes, file paths) preserved — these are the signal RCA needs
- File: `body_raw_sha256_pre_mask` recorded; `body_masked_sha256` recorded; both are cryptographic proof of redaction

---

## 4. Expected RCA Response (`seeds/acmepilot/rca_response.json`)

This is what API-004 returns when the masked log is classified. The values are **deterministic given seed `0xMC2026`**.

```json
{
  "rca_run_id": "c001ce00-0000-0000-0000-000000000001",
  "tenant_id": "a11ce000-0000-0000-0000-000000000001",
  "status": "rca_confirmed",
  "prompt_version": "PR-RCA-002",
  "model_id": "ibm-bob-codereason-2026-04",
  "gold_set_version": "gold_set_v1.0",
  "mask_policy_version": "v1.0.0",
  "classifications": [
    {"class": "oom", "confidence": 0.932},
    {"class": "race", "confidence": 0.041},
    {"class": "code_defect", "confidence": 0.018}
  ],
  "explainability": {
    "rationale": "Pattern 'Reached heap limit' + 'exit code 137' + V8 GC sequence is a textbook Node.js OOM signature. The stack trace pinpoints src/parser/ast-builder.js:421 in processBuffer, a function processing input streams. Mark-sweep cycles dropped recovery from 1424.9 MB to 1425.4 MB (essentially no recovery) over 1.2 seconds — heap exhausted before useful reclamation.",
    "matched_evidence": [
      "line 8945: FATAL ERROR: Reached heap limit",
      "line 8946: Allocation failed - JavaScript heap out of memory",
      "line 8987: at processBuffer (src/parser/ast-builder.js:418:5)",
      "line 8923: Mark-sweep 1397.5 (1425.4) -> 1396.9 (1425.9) MB",
      "line 9012: exit code 137"
    ]
  },
  "latency_ms": 4218
}
```

---

## 5. Expected Repair Plan (`seeds/acmepilot/repair_plan.json`)

This is what API-005 returns:

```json
{
  "plan_id": "9123ce00-0000-0000-0000-000000000001",
  "tenant_id": "a11ce000-0000-0000-0000-000000000001",
  "schema_version": "repair_plan.schema.v1",
  "rca_run_id": "c001ce00-0000-0000-0000-000000000001",
  "hypothesis": "The Jest test runner ran out of heap while processing a large input fixture in ast-builder. The default Node 1.5GB heap is insufficient for this workload, and there may also be a buffer accumulation bug in processBuffer that fails to release intermediate parse-tree nodes.",
  "steps": [
    {
      "step_number": 1,
      "step_type": "config_change",
      "body": "Raise the Jest worker heap limit from 1500MB to 4096MB. Update jest.config.js: add `maxWorkers: 2` and pass NODE_OPTIONS=\"--max-old-space-size=4096\" in the npm test script in package.json. This is a band-aid fix that buys time while step 2 investigates the leak.",
      "blast_radius": "medium",
      "rollback_note": "Revert package.json and jest.config.js; CI runner returns to default 1.5GB heap."
    },
    {
      "step_number": 2,
      "step_type": "code_change",
      "body": "Investigate the buffer accumulation in src/parser/ast-builder.js processBuffer (line 418-450). Suspected pattern: intermediate parse-tree nodes are retained in a closure scope and not freed between input chunks. Add explicit nullification of `intermediateNodes` after each chunk, or switch to a streaming parser pattern using Transform streams.",
      "target_file": "src/parser/ast-builder.js",
      "blast_radius": "low",
      "rollback_note": "Revert the commit; parser behavior is unchanged."
    },
    {
      "step_number": 3,
      "step_type": "infra_action",
      "body": "Enable Node heap-dump on OOM in CI via --heapsnapshot-near-heap-limit=2 so that the next OOM (if it recurs) produces a .heapsnapshot file we can post-mortem.",
      "blast_radius": "low",
      "rollback_note": "Remove the flag; CI loses post-mortem capability."
    }
  ],
  "alternatives": [
    {
      "summary": "Switch parser implementation to a streaming AST library (e.g., acorn-stream) — high effort, low certainty without spike."
    },
    {
      "summary": "Split the parser test suite so no single test processes a >10MB fixture — addresses symptom, not cause."
    }
  ],
  "required_approver_role": "approver",
  "generated_at": "2026-05-17T11:32:14Z",
  "prompt_version": "PR-PLAN-002"
}
```

---

## 6. Expected Approval Record (`seeds/acmepilot/approval_record.json`)

This is what API-006 returns after Lin signs:

```json
{
  "approval_id": "a991ce00-0000-0000-0000-000000000001",
  "tenant_id": "a11ce000-0000-0000-0000-000000000001",
  "plan_id": "9123ce00-0000-0000-0000-000000000001",
  "operator_id": "a11ce000-0000-0000-0000-000000000011",
  "operator_role": "approver",
  "decision": "approved",
  "justification_text": "Approved. Memory increase is minimal risk; will revisit Tuesday for root-cause investigation of the buffer accumulation pattern.",
  "plan_hash": "f8a3e9c7d2b1056e4f8c7d2a3b1c5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
  "hmac_signature": "e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
  "hmac_key_kid": "kms/tenant/acmepilot/signing-key/v1",
  "signed_at": "2026-05-17T11:34:51Z"
}
```

---

## 7. Expected Evidence Manifest (`seeds/acmepilot/evidence_manifest.json`)

This is the manifest.json that ends up inside the evidence ZIP:

```json
{
  "schema_version": "audit_export.schema.v1",
  "export_id": "e5e0ce00-0000-0000-0000-000000000001",
  "tenant_id": "a11ce000-0000-0000-0000-000000000001",
  "tenant_name": "AcmePilot",
  "generated_at": "2026-05-17T11:36:22Z",
  "generated_by": {
    "user_id": "a11ce000-0000-0000-0000-000000000013",
    "display_name": "Audit Sam",
    "role": "auditor"
  },
  "filter": {
    "date_from": "2026-05-17T00:00:00Z",
    "date_to": "2026-05-17T23:59:59Z",
    "repo_ids": ["a11ce000-0000-0000-0000-000000000020"]
  },
  "incident_count": 1,
  "incidents": [
    {
      "intake_id": "i111ce00-0000-0000-0000-000000000001",
      "received_at": "2026-05-17T11:30:08Z",
      "provider": "jenkins",
      "run_id": "build-12847",
      "attempt_id": "1",
      "mask": {
        "policy_version": "v1.0.0",
        "body_raw_sha256_pre_mask": "ab12cd34ef56...",
        "body_masked_sha256": "fe10dc23ab45..."
      },
      "rca": {
        "rca_run_id": "c001ce00-0000-0000-0000-000000000001",
        "primary_class": "oom",
        "primary_confidence": 0.932,
        "prompt_version": "PR-RCA-002",
        "model_id": "ibm-bob-codereason-2026-04",
        "gold_set_version": "gold_set_v1.0"
      },
      "plan": {
        "plan_id": "9123ce00-0000-0000-0000-000000000001",
        "schema_version": "repair_plan.schema.v1",
        "plan_hash": "f8a3e9c7d2b1...",
        "required_approver_role": "approver",
        "prompt_version": "PR-PLAN-002"
      },
      "approval": {
        "approval_id": "a991ce00-0000-0000-0000-000000000001",
        "decision": "approved",
        "operator_id": "a11ce000-0000-0000-0000-000000000011",
        "operator_role": "approver",
        "justification_first_60_chars": "Approved. Memory increase is minimal risk; will revisit",
        "hmac_signature": "e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
        "signed_at": "2026-05-17T11:34:51Z"
      }
    }
  ],
  "compliance_mapping": {
    "eu_ai_act_articles": ["Article 12 — automatic logging", "Article 14 — human oversight", "Article 18 — tech-doc retention"],
    "soc2_controls": ["CC1.5", "CC7.2", "CC8.1"],
    "iso_42001_sections": ["§6.1.3", "§7.4", "§8.2", "§8.4"]
  },
  "signing": {
    "hmac_signature": "manifest-hmac-d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    "hmac_key_kid": "kms/tenant/acmepilot/signing-key/v1",
    "signed_at": "2026-05-17T11:36:22Z"
  }
}
```

---

## 8. Evidence ZIP Structure (`seeds/acmepilot/evidence_pack.zip.structure`)

The downloaded ZIP unpacks to exactly this layout. Auditors can offline-verify the HMAC over the entire structure.

```
mendoraci_evidence_acmepilot_2026-05-17.zip/
├── manifest.json                           <- the file in section 7
├── README.txt                              <- human-readable cover sheet
├── intakes/
│   └── i111ce00-...-000001/
│       ├── meta.json                       <- intake_meta row, serialized
│       ├── masked_artifact.log             <- the post-mask log
│       └── mask_proof.json                 <- {pre_sha, post_sha, mask_policy_version}
├── rca/
│   └── c001ce00-...-000001/
│       └── rca_result.json                 <- the file in section 4
├── plans/
│   └── 9123ce00-...-000001/
│       └── plan.json                       <- the file in section 5
├── approvals/
│   └── a991ce00-...-000001.json            <- the file in section 6
├── evals/
│   ├── PR-RCA-002.eval_card.json           <- eval_runs row at time of inference
│   └── PR-PLAN-002.eval_card.json
├── prompts/
│   ├── PR-RCA-002.prompt.txt               <- pinned prompt body
│   └── PR-PLAN-002.prompt.txt
├── mask_policy/
│   └── v1.0.0.json                         <- full mask policy at time of intake
└── signature.hmac                          <- HMAC over the entire manifest
```

**Verification command (provided to auditors):**
```bash
# Tool: mendoraci-verify (open-source, published)
mendoraci-verify --pack mendoraci_evidence_acmepilot_2026-05-17.zip \
                 --public-key acmepilot_signing_key_v1.pub
# Expected output:
# ✓ manifest.json schema valid (audit_export.schema.v1)
# ✓ HMAC signature verifies
# ✓ All 1 incidents have complete chain (intake → rca → plan → approval)
# ✓ All eval cards present
# ✓ All prompt versions retrievable
# ✓ Mask policy pinned and matches manifest
# Result: Pass
```

---

## 9. Backup Scenario B — Flaky Test (`seeds/acmeflaky/parser_test_flaky.log`)

For the alternate demo path that showcases BR-010 (flaky detection). The intake shows 5 historical Jenkins runs of `parser_test.py` on identical git tree SHA, alternating pass/fail.

Key file content excerpt:
```
[run 47] PASS parser_test.py (git tree e3a7b1c0)
[run 48] FAIL parser_test.py::test_handles_unicode_edge_case (git tree e3a7b1c0)
        AssertionError: expected 'γνῶθι' got 'γνῶθι\u0301' (combining diacritical drift)
[run 49] PASS parser_test.py (git tree e3a7b1c0)
[run 50] FAIL parser_test.py::test_handles_unicode_edge_case (git tree e3a7b1c0)
[run 51] PASS parser_test.py (git tree e3a7b1c0)
```

Expected RCA: `class: flaky, confidence: 0.94`.
Expected Plan: Step 1 quarantine the test; Step 2 assign Jira ticket to test owner; alternative: rewrite assertion to normalize Unicode.

---

## 10. Backup Scenario C — Secret Rotation (`seeds/acmesecret/secret_rotation_failure.log`)

For the demo path that showcases dual-approval and RC-030 (security-approver requirement). Failure: GitHub PAT expired, deploy job fails on auth.

```
[Pipeline] withCredentials
[Pipeline] {
[Pipeline] sh
+ git push origin main
remote: Invalid username or password.
fatal: Authentication failed for 'https://github.com/acmepilot/parser-svc.git/'
ERROR: script returned exit code 128
```

Expected RCA: `class: secret, confidence: 0.91`. Plan: rotate GitHub PAT, update `tenant_secrets`, restart workers. `required_approver_role: security_approver` enforced. Lin (security_approver) signs; regular approver would get 403 SoD.

---

## 11. SCR-007 Dashboard Seed (`seeds/acmepilot/historical_intakes_30d.sql`)

Backfills 30 days of incident history for AcmePilot so the analytics dashboard has real data:

```sql
-- Insert 87 historical intakes over the past 30 days
-- Distribution: 35% flaky, 18% oom, 14% dep_drift, 10% race, 8% env, 5% network, 4% secret, 6% other
-- Each with corresponding rca_run, repair_plan, approval_record
-- This creates the MTTR 4.2h → 1.6h trajectory shown in demo step 4:30

-- Day -30: MTTR 4.2h avg (8 incidents)
INSERT INTO intake_meta (...)
INSERT INTO rca_runs (...)
INSERT INTO approval_records (...)
-- ... 87 row sets over 30 days, trending toward 1.6h MTTR by day -1

-- This produces the trend line on SCR-007 that anchors the closing "60% MTTR" claim
```

(The actual file in the repo is ~600 lines of INSERTs with deterministic timestamps and UUIDs.)

---

## 12. EVAL Gold Sets

### `seeds/_eval/eval_001_gold_set_v1.0.jsonl` — RCA classification

N=250 examples, stratified across 12 classes (≥15 each) + 30% adversarial. Format:

```jsonl
{"example_id": "ev1-001", "class": "oom", "log_text": "...", "annotator_a": "oom", "annotator_b": "oom", "tiebreak": null}
{"example_id": "ev1-002", "class": "flaky", "log_text": "...", "annotator_a": "flaky", "annotator_b": "flaky", "tiebreak": null}
{"example_id": "ev1-003", "class": "race", "log_text": "...", "annotator_a": "race", "annotator_b": "race", "tiebreak": null}
{"example_id": "ev1-004", "class": "race", "log_text": "...", "annotator_a": "race", "annotator_b": "code_defect", "tiebreak": "race"}
...
{"example_id": "ev1-250", "class": "external_service", "log_text": "...", "annotator_a": "external_service", "annotator_b": "external_service", "tiebreak": null}
```

Slice breakdown:
| Slice | Count |
|---|---|
| flaky | 21 |
| dep_drift | 18 |
| infra | 17 |
| secret | 16 |
| env | 17 |
| race | 19 |
| oom | 22 |
| code_defect | 20 |
| config | 18 |
| network | 18 |
| timeout | 17 |
| external_service | 17 |
| Adversarial (mixed/truncated/non-English) | 30 |
| **Total** | **250** |

### `seeds/_eval/eval_002_gold_set_v1.0.jsonl` — Repair plan usefulness

N=250 incidents with approved-plan ground truth. Format:

```jsonl
{"example_id": "ev2-001", "rca_input": {...}, "approved_plan": {...}, "useful_label": true}
{"example_id": "ev2-002", "rca_input": {...}, "approved_plan": {...}, "useful_label": true}
{"example_id": "ev2-003", "rca_input": {...}, "approved_plan": {...}, "useful_label": false}
...
```

---

## 13. Mask Red-Team Corpus (`seeds/_redteam/mask_redteam_corpus_v1.jsonl`)

N=500 synthetic logs containing planted secret tokens of 22 types. Used by TEST-023 (mask v1 red-team).

```jsonl
{"id": "rt-001", "log_text": "DATABASE_URL=postgres://user:p4ssw0rd@host:5432/db", "expected_masks": ["p4ssw0rd"]}
{"id": "rt-002", "log_text": "AKIA4XEXAMPLEKEY7K3W in env", "expected_masks": ["AKIA4XEXAMPLEKEY7K3W"]}
{"id": "rt-003", "log_text": "ghp_FAKETOKENforRED7eAm5tEsT12345", "expected_masks": ["ghp_FAKETOKENforRED7eAm5tEsT12345"]}
...
```

Token type distribution:
| Type | Count |
|---|---|
| AWS access keys | 25 |
| AWS secret keys | 25 |
| GitHub PATs | 30 |
| GCP service account JSONs | 20 |
| Database connection strings | 30 |
| JWT tokens | 25 |
| Generic API keys (high entropy) | 50 |
| Datadog | 20 |
| Stripe | 20 |
| Cloudflare | 20 |
| Slack | 20 |
| OpenAI | 20 |
| Twilio | 20 |
| Algolia | 15 |
| SSH private keys (PEM) | 20 |
| Adversarial near-misses (NOT secrets, must NOT be masked) | 70 |
| Mixed (multiple secrets per log) | 50 |
| **Total** | **500** |

Acceptance: 0 leaks AND false-positive rate ≤ 3% on the 70 near-miss examples.

---

## 14. Demo Determinism Guarantees

The seed pack guarantees demo determinism by:
1. **Fixed UUIDs** — every record has a hand-set UUID, never `gen_random_uuid()` at demo time
2. **Fixed timestamps** — `seeds/acmepilot.sql` uses anchor dates relative to a fixed `DEMO_NOW = 2026-05-17 11:30:00 UTC`
3. **Frozen model seed** — `MCI_DEMO_SEED=0xMC2026`, `temperature=0.2`, `top_p=0.9`
4. **Pinned prompt versions** — `PR-RCA-002` and `PR-PLAN-002` are the only active prompts during demo
5. **Pinned gold set** — `gold_set_v1.0`
6. **Pinned mask policy** — `v1.0.0`
7. **Pre-recorded fallback** — `demo/golden_path.mp4` is the literal byte-for-byte recording of one successful run

---

## 15. Re-seed Command

Builders run this once before demo:
```bash
# From repo root
make seed-demo
# Equivalent:
psql $DEMO_DB < seeds/acmepilot.sql
psql $DEMO_DB < seeds/acmepilot/historical_intakes_30d.sql
aws s3 cp seeds/acmepilot/jenkins_oom_failure.log s3://$DEMO_BUCKET/acmepilot/intake.log
aws s3 cp seeds/_eval/ s3://$DEMO_BUCKET/eval/ --recursive
aws s3 cp seeds/_redteam/ s3://$DEMO_BUCKET/redteam/ --recursive
echo "Demo state seeded. Run dry-run with: make demo-dry-run"
```

The dry-run target executes the golden path end-to-end without UI, verifying that each step produces the expected output. Three successful consecutive dry-runs = green-light for live demo.
