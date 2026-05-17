# MendoraCI_API_JSONSchemas_20260517_1208

**Document Type:** Full JSON Schema Definitions for API-001..API-010
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 2 — "API contract needs full request/response schemas"
**Schema standard:** JSON Schema 2020-12

This document provides implementation-grade JSON Schemas for every API endpoint. Each API entry includes: schema, required role, success response, error responses, idempotency, event emitted, and DB writes.

---

## 0. Common Schemas

### 0.1 Common Error Response (used by all endpoints)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/error_response.json",
  "title": "ErrorResponse",
  "type": "object",
  "required": ["error"],
  "properties": {
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": {
          "type": "string",
          "pattern": "^[A-Z][A-Z0-9_]{2,49}$",
          "description": "Stable error code (e.g., MASK_ENGINE_FAILURE, IDEMPOTENCY_REPLAY)"
        },
        "message": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500,
          "description": "Human-readable message"
        },
        "validation_errors": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["field", "issue"],
            "properties": {
              "field": {"type": "string"},
              "issue": {"type": "string"}
            }
          }
        },
        "trace_id": {
          "type": "string",
          "description": "OTel trace id for support correlation"
        },
        "retry_after_ms": {
          "type": "integer",
          "minimum": 0,
          "description": "Hint when 429/503"
        }
      }
    }
  },
  "additionalProperties": false
}
```

### 0.2 Common Auth & Headers
- **Authorization:** `Bearer <JWT>` with `tenant_id`, `user_id`, `roles[]` claims
- **X-Request-Id:** optional client-provided; otherwise server-generated UUID v4
- **Idempotency-Key:** REQUIRED on POST writes (API-001, 003, 004, 005, 006, 008, 010); dedupe 24h
- **Content-Type:** `application/json` unless noted

### 0.3 Common Field Types
- `uuid` — RFC 4122 UUID v4
- `timestamp_utc` — ISO 8601 with `Z` suffix
- `sha256_hex` — 64-char lowercase hex
- `tenant_id` — uuid; appears in every response; enforced by RLS

---

## API-001 — POST /intake

**Purpose:** Submit CI failure artifact for analysis.
**Required role:** `intake_user` or higher.
**Idempotency:** required header `Idempotency-Key`; dedupe on `(tenant_id, provider, run_id, attempt_id)` within 24h.
**Event emitted:** `intake.received`.
**DB writes:** `raw_intake`, `intake_meta`, `idempotency_keys`.

### Request Schema
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/intake.request.json",
  "title": "IntakeRequest",
  "type": "object",
  "required": ["provider", "run_id", "attempt_id", "artifact"],
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["github", "jenkins", "circleci", "gitlab", "buildkite"],
      "description": "CI provider"
    },
    "run_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "description": "Provider-specific run identifier"
    },
    "attempt_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "Attempt within run (for re-runs)"
    },
    "repo_url": {
      "type": "string",
      "format": "uri",
      "description": "Full repo URL (optional if pre-linked)"
    },
    "artifact": {
      "type": "object",
      "required": ["type", "body_base64"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["log", "junit_xml", "workflow_yaml", "env_snapshot"]
        },
        "body_base64": {
          "type": "string",
          "minLength": 1,
          "maxLength": 70000000,
          "description": "Base64-encoded artifact body; effective ≤50MB after decode"
        },
        "content_encoding": {
          "type": "string",
          "enum": ["plain", "gzip"],
          "default": "plain"
        }
      },
      "additionalProperties": false
    },
    "metadata": {
      "type": "object",
      "properties": {
        "branch": {"type": "string", "maxLength": 256},
        "commit_sha": {"type": "string", "pattern": "^[a-f0-9]{7,40}$"},
        "actor": {"type": "string", "maxLength": 256},
        "workflow_name": {"type": "string", "maxLength": 256}
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

### Response 200 Schema
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/intake.response.json",
  "title": "IntakeResponse",
  "type": "object",
  "required": ["intake_id", "tenant_id", "status", "mask_policy_version", "received_at"],
  "properties": {
    "intake_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "status": {
      "type": "string",
      "enum": ["received", "masking", "masked", "classifying", "rca_done", "plan_ready", "awaiting_approval", "approved", "rejected", "exported", "error"]
    },
    "mask_policy_version": {
      "type": "string",
      "pattern": "^v\\d+\\.\\d+\\.\\d+$"
    },
    "received_at": {"type": "string", "format": "date-time"},
    "size_bytes": {"type": "integer", "minimum": 0}
  },
  "additionalProperties": false
}
```

### Errors
| HTTP | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST_SCHEMA` | Schema validation fails |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 401 | `WEBHOOK_SIGNATURE_INVALID` | Webhook variant only |
| 403 | `FORBIDDEN_ROLE` | Caller lacks `intake_user` |
| 409 | `IDEMPOTENCY_REPLAY` | Duplicate `(provider, run_id, attempt_id)` within 24h |
| 413 | `PAYLOAD_TOO_LARGE` | Decoded body > 50MB |
| 422 | `MASK_POLICY_VERSION_MISMATCH` | Client requested unsupported mask version |
| 500 | `MASK_ENGINE_FAILURE` | Mask engine errored — no fallback, deny-on-fail |
| 503 | `MASK_ENGINE_UNAVAILABLE` | Engine down — retry-after header set |

**Timeout:** 5s soft, 15s hard.

---

## API-002 — GET /intake/{id}

**Purpose:** Retrieve intake detail (masked).
**Required role:** `viewer` or higher (own intakes only); `tenant_admin` for any.
**Idempotency:** n/a (read).
**Event emitted:** none (read).
**DB writes:** `access_log` only.

### Path Params
- `id` — uuid

### Response 200 Schema
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/intake.detail.json",
  "title": "IntakeDetail",
  "type": "object",
  "required": ["intake_id", "tenant_id", "status", "body_masked_preview", "intake_meta", "lineage_chain"],
  "properties": {
    "intake_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "status": {"$ref": "#/components/schemas/IntakeStatus"},
    "body_masked_preview": {
      "type": "string",
      "maxLength": 4096,
      "description": "First 4KB of masked artifact"
    },
    "intake_meta": {
      "type": "object",
      "required": ["provider", "run_id", "attempt_id", "received_at"],
      "properties": {
        "provider": {"type": "string"},
        "run_id": {"type": "string"},
        "attempt_id": {"type": "string"},
        "received_at": {"type": "string", "format": "date-time"},
        "size_bytes": {"type": "integer"}
      }
    },
    "lineage_chain": {
      "type": "object",
      "properties": {
        "intake_id": {"type": "string", "format": "uuid"},
        "rca_run_id": {"type": ["string", "null"], "format": "uuid"},
        "plan_id": {"type": ["string", "null"], "format": "uuid"},
        "approval_id": {"type": ["string", "null"], "format": "uuid"},
        "export_id": {"type": ["string", "null"], "format": "uuid"}
      }
    }
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 403 | `CROSS_TENANT_ACCESS` |
| 404 | `INTAKE_NOT_FOUND` |

**Timeout:** 2s.

---

## API-003 — POST /repos/link

**Purpose:** Link a repository under a tenant.
**Required role:** `tenant_admin`.
**Idempotency:** unique on `(tenant_id, repo_url)`; replay returns 200 with existing record.
**Event emitted:** `repo.linked`.
**DB writes:** `repositories`, `tenant_secrets` (encrypted).

### Request Schema
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/repo.link.request.json",
  "title": "RepoLinkRequest",
  "type": "object",
  "required": ["repo_url", "auth_mode"],
  "properties": {
    "repo_url": {
      "type": "string",
      "format": "uri",
      "pattern": "^https://(github\\.com|.+\\.github\\.com)/"
    },
    "auth_mode": {
      "type": "string",
      "enum": ["oauth", "pat"]
    },
    "oauth_callback_state": {
      "type": "string",
      "description": "Required when auth_mode=oauth; nonce verified server-side",
      "maxLength": 256
    },
    "pat": {
      "type": "string",
      "description": "Required when auth_mode=pat; AES-256-GCM at rest with per-tenant DEK; never logged",
      "pattern": "^(ghp_|github_pat_)[A-Za-z0-9_]+$"
    }
  },
  "additionalProperties": false,
  "allOf": [
    {
      "if": {"properties": {"auth_mode": {"const": "oauth"}}},
      "then": {"required": ["oauth_callback_state"]}
    },
    {
      "if": {"properties": {"auth_mode": {"const": "pat"}}},
      "then": {"required": ["pat"]}
    }
  ]
}
```

### Response 200 Schema
```json
{
  "title": "RepoLinkResult",
  "type": "object",
  "required": ["repo_id", "tenant_id", "verified_sha", "linked_at"],
  "properties": {
    "repo_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "verified_sha": {"type": "string", "pattern": "^[a-f0-9]{7,40}$"},
    "linked_at": {"type": "string", "format": "date-time"},
    "scopes_granted": {
      "type": "array",
      "items": {"type": "string", "enum": ["contents:read", "actions:read", "checks:read", "pull_requests:read"]}
    }
  }
}
```

### Errors
| HTTP | Code | When |
|---|---|---|
| 403 | `PAT_INVALID_OR_SCOPE_INSUFFICIENT` | PAT lacks required scope |
| 403 | `ORG_SSO_REQUIRED` | GitHub org requires SAML bypass |
| 409 | `REPO_ALREADY_LINKED` | duplicate |
| 422 | `REPO_ARCHIVED` | repo is archived |

**Timeout:** 10s.

---

## API-004 — POST /rca/run

**Purpose:** Run root-cause analysis on an intake.
**Required role:** `analyst` or higher.
**Idempotency:** unique on `(intake_id, prompt_version, gold_set_version)`; replay returns same run_id.
**Event emitted:** `rca.completed` OR `rca.manual_review` OR `rca.fallback`.
**DB writes:** `rca_runs`, `prompt_runs`.

### Request Schema
```json
{
  "title": "RcaRequest",
  "type": "object",
  "required": ["intake_id"],
  "properties": {
    "intake_id": {"type": "string", "format": "uuid"},
    "force_re_run": {"type": "boolean", "default": false},
    "manual_override_class": {
      "type": "object",
      "description": "Optional manual class override (sub-threshold confidence path)",
      "required": ["class", "justification"],
      "properties": {
        "class": {"$ref": "#/components/schemas/RcaClass"},
        "justification": {"type": "string", "minLength": 20, "maxLength": 1000}
      }
    }
  }
}
```

### RCA Class enum (12 classes)
```json
{
  "$id": "#/components/schemas/RcaClass",
  "type": "string",
  "enum": [
    "flaky", "dep_drift", "infra", "secret", "env", "race",
    "oom", "code_defect", "config", "network", "timeout", "external_service"
  ]
}
```

### Response 200 Schema
```json
{
  "title": "RcaResult",
  "type": "object",
  "required": ["rca_run_id", "tenant_id", "status", "classifications", "prompt_version", "model_id", "gold_set_version", "mask_policy_version", "latency_ms"],
  "properties": {
    "rca_run_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "status": {
      "type": "string",
      "enum": ["rca_confirmed", "manual_review_needed", "rca_confirmed_fallback"]
    },
    "prompt_version": {"type": "string", "pattern": "^PR-RCA-\\d{3}$"},
    "model_id": {"type": "string"},
    "gold_set_version": {"type": "string", "pattern": "^gold_set_v\\d+\\.\\d+$"},
    "mask_policy_version": {"type": "string"},
    "classifications": {
      "type": "array",
      "minItems": 1,
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["class", "confidence"],
        "properties": {
          "class": {"$ref": "#/components/schemas/RcaClass"},
          "confidence": {"type": "number", "minimum": 0, "maximum": 1}
        }
      }
    },
    "explainability": {
      "type": "object",
      "properties": {
        "rationale": {"type": "string", "minLength": 50, "maxLength": 500},
        "matched_evidence": {"type": "array", "items": {"type": "string"}}
      }
    },
    "latency_ms": {"type": "integer", "minimum": 0}
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 422 | `INTAKE_NOT_READY` |
| 422 | `JUSTIFICATION_TOO_SHORT` |
| 503 | `LLM_PROVIDER_UNAVAILABLE` (triggers fallback) |

**Timeout:** 30s hard, 8s p95 soft.

---

## API-005 — POST /plan/generate

**Purpose:** Generate a structured repair plan.
**Required role:** `analyst` or higher.
**Idempotency:** unique on `rca_run_id`; replay returns same plan_id.
**Event emitted:** `plan.generated`.
**DB writes:** `repair_plans`.

### Request Schema
```json
{
  "title": "PlanRequest",
  "type": "object",
  "required": ["rca_run_id"],
  "properties": {
    "rca_run_id": {"type": "string", "format": "uuid"}
  }
}
```

### Response 200 Schema — Repair Plan v1 (canonical)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/repair_plan.schema.v1.json",
  "title": "RepairPlanV1",
  "type": "object",
  "required": ["plan_id", "tenant_id", "schema_version", "hypothesis", "steps", "required_approver_role"],
  "properties": {
    "plan_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "schema_version": {"const": "repair_plan.schema.v1"},
    "rca_run_id": {"type": "string", "format": "uuid"},
    "hypothesis": {"type": "string", "minLength": 20, "maxLength": 1000},
    "steps": {
      "type": "array",
      "minItems": 1,
      "maxItems": 20,
      "items": {
        "type": "object",
        "required": ["step_number", "step_type", "body", "blast_radius"],
        "properties": {
          "step_number": {"type": "integer", "minimum": 1},
          "step_type": {
            "type": "string",
            "enum": ["config_change", "code_change", "infra_action", "retry", "quarantine", "escalate"]
          },
          "body": {"type": "string", "minLength": 10, "maxLength": 2000},
          "target_file": {
            "type": "string",
            "description": "Required when step_type=code_change",
            "maxLength": 500
          },
          "blast_radius": {"type": "string", "enum": ["low", "medium", "high"]},
          "rollback_note": {"type": "string", "minLength": 10, "maxLength": 500}
        },
        "allOf": [
          {
            "if": {"properties": {"step_type": {"const": "code_change"}}},
            "then": {"required": ["target_file"]}
          }
        ]
      }
    },
    "alternatives": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["summary"],
        "properties": {
          "summary": {"type": "string", "maxLength": 500}
        }
      }
    },
    "required_approver_role": {
      "type": "string",
      "enum": ["approver", "security_approver", "dual_prod_approver"]
    },
    "generated_at": {"type": "string", "format": "date-time"},
    "prompt_version": {"type": "string", "pattern": "^PR-PLAN-\\d{3}$"}
  },
  "additionalProperties": false
}
```

### Errors
| HTTP | Code |
|---|---|
| 422 | `RCA_RUN_NOT_FOUND` |
| 422 | `RCA_CONFIDENCE_BELOW_THRESHOLD` |
| 422 | `PLAN_SCHEMA_INVALID` (falls through to manual-form) |

**Timeout:** 30s.

---

## API-006 — POST /approval/sign

**Purpose:** Sign HITL approval for a plan.
**Required role:** matches `repair_plans.required_approver_role`.
**Idempotency:** unique on `(plan_id, operator_id)`; second signer for dual-approval creates separate row.
**Event emitted:** `approval.signed`.
**DB writes:** `approval_records` (append-only).

### Request Schema
```json
{
  "title": "ApprovalSignRequest",
  "type": "object",
  "required": ["plan_id", "decision", "justification_text", "plan_hash_observed", "approval_token"],
  "properties": {
    "plan_id": {"type": "string", "format": "uuid"},
    "decision": {"type": "string", "enum": ["approved", "rejected"]},
    "justification_text": {
      "type": "string",
      "minLength": 20,
      "maxLength": 5000
    },
    "plan_hash_observed": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
    "approval_token": {
      "type": "string",
      "description": "Issued at notify time, valid 4 hours"
    }
  }
}
```

### Response 200 Schema
```json
{
  "title": "ApprovalSignedResponse",
  "type": "object",
  "required": ["approval_id", "signed_at", "operator_id", "hmac_signature"],
  "properties": {
    "approval_id": {"type": "string", "format": "uuid"},
    "signed_at": {"type": "string", "format": "date-time"},
    "operator_id": {"type": "string", "format": "uuid"},
    "operator_role": {"type": "string"},
    "hmac_signature": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$",
      "description": "HMAC-SHA256 over (plan_id || decision || justification || timestamp), tenant-rooted key"
    },
    "plan_status_after": {
      "type": "string",
      "enum": ["awaiting_second_approval", "fully_approved", "rejected"]
    }
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 400 | `JUSTIFICATION_TOO_SHORT` |
| 403 | `ROLE_INSUFFICIENT` |
| 403 | `SELF_APPROVAL_FORBIDDEN` (separation of duties) |
| 409 | `PLAN_HASH_DRIFT` |
| 410 | `APPROVAL_TOKEN_EXPIRED` |

**Timeout:** 5s.

---

## API-007 — POST /approval/notify

**Purpose:** Send approval notifications via channels.
**Required role:** internal (called by plan-generated worker).
**Idempotency:** unique on `(plan_id, channel)`.
**Event emitted:** `notify.email`, `notify.slack`.
**DB writes:** `notification_log`.

### Request Schema
```json
{
  "title": "NotifyRequest",
  "type": "object",
  "required": ["plan_id", "channels"],
  "properties": {
    "plan_id": {"type": "string", "format": "uuid"},
    "channels": {
      "type": "array",
      "minItems": 1,
      "items": {"type": "string", "enum": ["email", "slack", "in_app"]}
    },
    "approver_ids": {
      "type": "array",
      "items": {"type": "string", "format": "uuid"}
    }
  }
}
```

### Response 200 Schema
```json
{
  "title": "NotifyResponse",
  "type": "object",
  "required": ["notifications"],
  "properties": {
    "notifications": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["notification_id", "channel", "approver_id", "status"],
        "properties": {
          "notification_id": {"type": "string", "format": "uuid"},
          "channel": {"type": "string"},
          "approver_id": {"type": "string", "format": "uuid"},
          "status": {"type": "string", "enum": ["sent", "queued", "failed"]},
          "approval_token": {"type": "string"}
        }
      }
    }
  }
}
```

**Timeout:** 5s.

---

## API-008 — POST /evidence/export

**Purpose:** Generate signed evidence pack.
**Required role:** `auditor` or `tenant_admin`.
**Idempotency:** unique on `(tenant_id, filter_hash)`; replay returns existing export.
**Event emitted:** `evidence.signed`.
**DB writes:** `audit_exports`, `export_manifests`.

### Request Schema
```json
{
  "title": "EvidenceExportRequest",
  "type": "object",
  "required": ["filter"],
  "properties": {
    "filter": {
      "type": "object",
      "required": ["date_from", "date_to"],
      "properties": {
        "date_from": {"type": "string", "format": "date-time"},
        "date_to": {"type": "string", "format": "date-time"},
        "repo_ids": {"type": "array", "items": {"type": "string", "format": "uuid"}},
        "incident_status": {
          "type": "array",
          "items": {"type": "string", "enum": ["approved", "rejected", "exported"]}
        }
      }
    },
    "split_threshold_mb": {"type": "integer", "minimum": 50, "maximum": 5000, "default": 100}
  }
}
```

### Response 200 Schema — Audit Export v1 (canonical)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mendoraci.com/schemas/v1/audit_export.schema.v1.json",
  "title": "AuditExportV1",
  "type": "object",
  "required": ["export_id", "tenant_id", "schema_version", "status", "manifest_url", "hmac_signature", "expires_at"],
  "properties": {
    "export_id": {"type": "string", "format": "uuid"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "schema_version": {"const": "audit_export.schema.v1"},
    "status": {"type": "string", "enum": ["queued", "collecting", "signing", "ready", "expired", "failed"]},
    "download_urls": {
      "type": "array",
      "items": {"type": "string", "format": "uri"},
      "description": "Pre-signed S3 URLs valid 30 days; rolls automatically"
    },
    "manifest_url": {"type": "string", "format": "uri"},
    "hmac_signature": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
    "expires_at": {"type": "string", "format": "date-time"},
    "incident_count": {"type": "integer", "minimum": 0},
    "size_bytes_total": {"type": "integer", "minimum": 0},
    "compliance_mapping": {
      "type": "object",
      "properties": {
        "eu_ai_act_articles": {"type": "array", "items": {"type": "string"}},
        "soc2_controls": {"type": "array", "items": {"type": "string"}},
        "iso_42001_sections": {"type": "array", "items": {"type": "string"}}
      }
    }
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 403 | `CROSS_TENANT_EXPORT_ATTEMPT` |
| 422 | `EMPTY_FILTER` |
| 503 | `SIGNING_KEY_UNAVAILABLE` (blocks, pages on-call) |

**Timeout:** 60s.

---

## API-009 — GET /analytics/{metric}

**Purpose:** Read analytics KPIs.
**Required role:** `viewer` or higher.
**Idempotency:** n/a (read).
**Event emitted:** none.
**DB writes:** `access_log` only.

### Path Param
- `metric` — one of `mttr | debugging_effort | flaky_recurrence | evidence_completeness | approval_cycle`

### Query Params
- `window` — `30d | 60d | 90d`
- `repo_id` — optional uuid filter
- `team_id` — optional string
- `format` — `json | csv`, default `json`

### Response 200 Schema
```json
{
  "title": "AnalyticsKPI",
  "type": "object",
  "required": ["metric", "window", "value", "unit", "data_freshness_min"],
  "properties": {
    "metric": {"type": "string"},
    "tenant_id": {"type": "string", "format": "uuid"},
    "window": {"type": "string", "enum": ["30d", "60d", "90d"]},
    "value": {"type": "number"},
    "unit": {"type": "string"},
    "baseline": {"type": "number"},
    "improvement_pct": {"type": "number"},
    "trend": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["date", "value"],
        "properties": {
          "date": {"type": "string", "format": "date"},
          "value": {"type": "number"}
        }
      }
    },
    "data_freshness_min": {"type": "integer", "minimum": 0},
    "sufficient_data": {"type": "boolean", "description": "False if <10 incidents"}
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 422 | `INSUFFICIENT_DATA` |
| 422 | `INVALID_WINDOW` |

**Timeout:** 2s.

---

## API-010 — POST /admin/prompt/promote

**Purpose:** Promote a candidate prompt to active (or canary).
**Required role:** `ai_lead` only (Mendora staff).
**Idempotency:** unique on `prompt_version`.
**Event emitted:** `prompt.promoted` or `prompt.canary_started`.
**DB writes:** `prompts`, `prompt_promotions`.

### Request Schema
```json
{
  "title": "PromptPromoteRequest",
  "type": "object",
  "required": ["prompt_version", "eval_run_id", "justification", "rollback_target"],
  "properties": {
    "prompt_version": {
      "type": "string",
      "pattern": "^PR-(RCA|PLAN)-\\d{3}$"
    },
    "eval_run_id": {"type": "string", "format": "uuid"},
    "justification": {"type": "string", "minLength": 20, "maxLength": 5000},
    "rollback_target": {"type": "string", "pattern": "^PR-(RCA|PLAN)-\\d{3}$"},
    "canary_pct": {"type": "integer", "minimum": 1, "maximum": 100, "default": 5},
    "canary_window_hours": {"type": "integer", "minimum": 1, "maximum": 168, "default": 24}
  }
}
```

### Response 200 Schema
```json
{
  "title": "PromptPromotionResult",
  "type": "object",
  "required": ["promotion_id", "status", "decision_timestamp", "approver_id"],
  "properties": {
    "promotion_id": {"type": "string", "format": "uuid"},
    "status": {"type": "string", "enum": ["canary_started", "promoted", "rolled_back"]},
    "decision_timestamp": {"type": "string", "format": "date-time"},
    "approver_id": {"type": "string", "format": "uuid"},
    "canary_window_ends_at": {"type": "string", "format": "date-time"}
  }
}
```

### Errors
| HTTP | Code |
|---|---|
| 403 | `NOT_AI_LEAD_ROLE` |
| 409 | `EVAL_GATE_RED` |
| 409 | `PROMPT_VERSION_ALREADY_ACTIVE` |

**Timeout:** 10s.

---

## Cross-API Concerns

### Webhook Signing (used by API-001 webhook variant)
- Algorithm: HMAC-SHA256
- Header: `X-MendoraCI-Signature: sha256=<hex>`
- Secret: per-tenant, rotated every 90 days (RC-023)
- Verification: constant-time comparison

### Rate Limits
- 100 requests/second per tenant default
- 429 with `Retry-After` header
- Tier-based overrides at Enterprise+

### Deprecation Policy (IMP-025)
- Breaking changes: 6-month migration window
- `Deprecation` and `Sunset` headers per RFC 8594
- New endpoints introduced in `/v2`
- Field additions are non-breaking

### Versioning
- URL path `/v1`
- Explicit `schema_version` in body for all create-responses
- Backward compatibility within major version

---

## Implementation Notes for Builders

1. **JSON Schema enforcement** — use AJV or equivalent at API gateway boundary. Reject before reaching service.
2. **Idempotency middleware** — central middleware reads `Idempotency-Key`, checks `idempotency_keys` table; on hit, returns cached response.
3. **HMAC signing** — use per-tenant KMS-rooted keys; never log signature material; verify in constant time.
4. **Audit logging** — every privileged API call writes to its designated audit table; retention per `DataModelERD §4`.
5. **OpenAPI spec** — these schemas should generate the canonical `openapi.v1.yaml`; CI fails on PR that breaks compatibility without major-version bump.
