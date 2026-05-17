# MendoraCI_APIContractSpec_20260517_1130

**Document Type:** API Contract Specification (API-001..API-010)
**Version:** 2026-05-17 11:30 DEEP
**Base URL:** `https://api.mendoraci.com/v1`
**Auth:** Bearer JWT with `tenant_id` claim; all writes require `Idempotency-Key` header

---

## Common Conventions

| Concern | Rule |
|---|---|
| Versioning | URL path `/v1`; deprecation window ≥ 6 months |
| Auth | Bearer JWT with tenant_id, user_id, roles[] claims |
| Idempotency | `Idempotency-Key` header REQUIRED on POST writes; dedupe 24h |
| Errors | `{error: {code, message, validation_errors[]}}` |
| Rate limit | 100 rps per tenant; 429 with `Retry-After` |
| Tracing | `X-Request-Id` header propagated; OTel root span per request |

---

## API-001 — POST /intake

**Purpose:** Submit CI failure artifact for analysis.

**Headers:** `Authorization`, `Idempotency-Key`, `Content-Type: application/json` or `multipart/form-data` (for direct upload).

**Request (intake.request.v1):**
```json
{
  "provider": "github|jenkins|circleci|gitlab|buildkite",
  "run_id": "string",
  "attempt_id": "string",
  "repo_url": "string (optional, if pre-linked)",
  "artifact": {
    "type": "log|junit_xml|workflow_yaml|env_snapshot",
    "body_base64": "string (≤ 50MB compressed)"
  },
  "metadata": {
    "branch": "string",
    "commit_sha": "string",
    "actor": "string"
  }
}
```

**Response 200 (intake.response.v1):**
```json
{
  "intake_id": "uuid",
  "status": "received|masking|masked|classifying",
  "mask_policy_version": "v1.2.0",
  "received_at": "ISO-8601"
}
```

**Errors:** 401 unsigned/invalid auth; 409 idempotency replay; 413 oversized; 422 invalid schema; 500 mask engine failure (no fallback).

**Timeout:** 5s soft, 15s hard. **Idempotency:** dedupe on `(tenant_id, provider, run_id, attempt_id)` within 24h.

---

## API-002 — GET /intake/{id}

**Purpose:** Retrieve intake detail (masked).

**Response (intake.detail.v1):**
```json
{
  "intake_id": "uuid",
  "status": "...",
  "body_masked_preview": "string (first 4KB)",
  "intake_meta": {...},
  "lineage_chain": {...}
}
```

**Errors:** 403 cross-tenant; 404 not found.

---

## API-003 — POST /repos/link

**Request (repo.link.v1):**
```json
{
  "repo_url": "https://github.com/org/repo",
  "auth_mode": "oauth|pat",
  "oauth_callback_state": "string (if oauth)",
  "pat": "string (if pat; AES-256-GCM at rest)"
}
```

**Response 200 (repo.link.result.v1):**
```json
{
  "repo_id": "uuid",
  "verified_sha": "string",
  "linked_at": "ISO-8601"
}
```

**Errors:** 403 PAT invalid/scope insufficient → "rotate-token" hint; 403 org SSO required → bypass hint.

**Timeout:** 10s.

---

## API-004 — POST /rca/run

**Request (rca.request.v1):**
```json
{
  "intake_id": "uuid",
  "force_re_run": false
}
```

**Response 200 (rca.result.v1):**
```json
{
  "rca_run_id": "uuid",
  "prompt_version": "PR-RCA-002",
  "model_id": "string",
  "classifications": [
    {"class": "oom", "confidence": 0.93},
    {"class": "race", "confidence": 0.06},
    {"class": "timeout", "confidence": 0.02}
  ],
  "explainability": {
    "rationale": "Pattern X matched on lines 142-158",
    "matched_evidence": ["line_142", "line_158"]
  },
  "status": "rca_confirmed|manual_review_needed",
  "latency_ms": 4200
}
```

**Errors:** 422 invalid intake_id; 503 LLM provider outage → fallback `rca_fallback_v1` (status returns `rca_confirmed_fallback`).

**Timeout:** 30s hard, 8s p95 soft.

---

## API-005 — POST /plan/generate

**Request:** `{rca_run_id: uuid}`

**Response 200 (plan.result.v1):**
```json
{
  "plan_id": "uuid",
  "hypothesis": "string",
  "steps": [
    {
      "step_type": "config-change|code-change|infra-action|retry|quarantine|escalate",
      "body": "string",
      "target_file": "string (if code-change)",
      "blast_radius": "low|medium|high",
      "rollback_note": "string"
    }
  ],
  "alternatives": [...],
  "required_approver_role": "approver|security_approver|dual",
  "schema_version": "repair_plan.schema.v1"
}
```

**Errors:** 422 schema invalid (falls through to manual-plan form); 503 LLM outage.

**Timeout:** 30s.

---

## API-006 — POST /approval/sign

**Request (approval.sign.v1):**
```json
{
  "plan_id": "uuid",
  "decision": "approved|rejected",
  "justification_text": "string (min 20 chars)",
  "plan_hash_observed": "sha256 hex",
  "approval_token": "string (valid 4h)"
}
```

**Response 200 (approval.signed.v1):**
```json
{
  "approval_id": "uuid",
  "signed_at": "ISO-8601",
  "operator_id": "uuid",
  "hmac_signature": "string"
}
```

**Errors:** 410 token expired; 409 plan_hash drift; 403 role insufficient; 400 justification too short.

**Timeout:** 5s. **Idempotency:** unique on `(plan_id, operator_id)`.

---

## API-007 — POST /approval/notify

**Request:** `{plan_id, channels: ["email","slack"]}`

**Response:** ack with `notification_ids[]`.

**Errors:** 503 channel adapter down → falls through to remaining channels.

---

## API-008 — POST /evidence/export

**Request (evidence.export.v1):**
```json
{
  "filter": {
    "date_from": "ISO-8601",
    "date_to": "ISO-8601",
    "repo_ids": ["uuid"],
    "incident_status": ["approved","exported"]
  },
  "split_threshold_mb": 100
}
```

**Response 200 (evidence.export.result.v1):**
```json
{
  "export_id": "uuid",
  "status": "queued|collecting|signing|ready",
  "download_urls": ["pre-signed S3 URL (valid 30 days)"],
  "manifest_url": "string",
  "hmac_signature": "string",
  "expires_at": "ISO-8601"
}
```

**Errors:** 403 cross-tenant; 503 signing key unavailable (block, page on-call).

**Timeout:** 60s. **Idempotency:** unique on `export_id`; same `(tenant_id, filter_hash)` returns prior receipt.

---

## API-009 — GET /analytics/{metric}

**Query params:** `window=30d|60d|90d`, `repo_id`, `team_id`, `format=json|csv`

**Response 200 (analytics.kpi.v1):**
```json
{
  "metric": "mttr|debugging_effort|flaky_recurrence|evidence_completeness|approval_cycle",
  "window": "30d",
  "value": 1.7,
  "unit": "hours",
  "trend": [{"date":"...","value":1.9},...],
  "baseline": 4.2,
  "improvement_pct": -59.5,
  "data_freshness_min": 12
}
```

**Errors:** 422 insufficient data (<10 incidents); 422 invalid window.

**Timeout:** 2s.

---

## API-010 — POST /admin/prompt/promote

**Request (prompt.promote.v1):**
```json
{
  "prompt_version": "PR-RCA-003",
  "eval_run_id": "uuid",
  "justification": "string",
  "rollback_target": "PR-RCA-002",
  "canary_pct": 5,
  "canary_window_hours": 24
}
```

**Response 200 (prompt.promotion.result.v1):**
```json
{
  "promotion_id": "uuid",
  "status": "canary_started|promoted",
  "decision_timestamp": "ISO-8601",
  "approver_id": "uuid"
}
```

**Errors:** 409 EVAL gate red → cannot promote; 403 not ai_lead role.

**Timeout:** 10s.

---

## Deprecation Policy (per IMP-025)

- Breaking changes: announce ≥ 6 months in advance via `Deprecation` header + changelog
- New endpoints: introduce in `/v2`; `/v1` runs in parallel until deprecation
- Field additions: non-breaking; consumers must tolerate new fields
- Schema versions: explicit in response (`schema_version` field)
