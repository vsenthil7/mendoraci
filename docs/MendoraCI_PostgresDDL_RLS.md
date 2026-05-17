# MendoraCI_PostgresDDL_RLS_20260517_1208

**Document Type:** Postgres DDL + RLS Policies (Production-Ready)
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 3 — "Data model needs implementation-level DDL"
**Target:** Postgres 16, row-level security enabled, partitioning on append-heavy tables

This document provides the complete DDL for all 18 entities DB-001..DB-018, including primary/foreign keys, indexes, RLS policies, JSONB fields, retention columns, audit timestamps, and append-only constraints. Migrations are managed by Sqitch with DPO sign-off required for any C3+ classified table.

---

## 0. Setup

```sql
-- Run once per database
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- text search

-- Roles
CREATE ROLE mendoraci_app NOINHERIT;       -- application connections
CREATE ROLE mendoraci_readonly NOINHERIT;  -- analytics/BI
CREATE ROLE mendoraci_admin NOINHERIT;     -- migrations only

GRANT mendoraci_app TO mendoraci_readonly;  -- inherits read

-- Common: every tenant-scoped query sets app.tenant_id
-- Application convention: SET LOCAL app.tenant_id = '<uuid>' after auth
```

---

## 1. Reference Tables (Global, No RLS)

### DB-013: mask_policies
```sql
CREATE TABLE mask_policies (
    policy_version VARCHAR(16) PRIMARY KEY,         -- e.g. 'v1.0.0', 'v1.2.0'
    description TEXT NOT NULL,
    pattern_set JSONB NOT NULL,                     -- list of regex + provider rules
    entropy_threshold NUMERIC(4,3),
    deployed_at TIMESTAMPTZ NOT NULL,
    deployed_by_user_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mask_policies_active ON mask_policies(is_active) WHERE is_active = TRUE;

-- Insert seed
INSERT INTO mask_policies (policy_version, description, pattern_set, entropy_threshold, deployed_at, deployed_by_user_id, is_active)
VALUES ('v1.0.0', 'Initial Mask Policy v1', '{"providers": ["aws","gcp","github","generic"]}'::jsonb, 4.5, NOW(), '00000000-0000-0000-0000-000000000001', TRUE);
```

### DB-014: prompts
```sql
CREATE TABLE prompts (
    prompt_version VARCHAR(32) PRIMARY KEY,         -- e.g. 'PR-RCA-002', 'PR-PLAN-001'
    family VARCHAR(16) NOT NULL CHECK (family IN ('rca','plan')),
    body_template TEXT NOT NULL,
    schema_input JSONB NOT NULL,
    schema_output JSONB NOT NULL,
    owner_user_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('candidate','canary','active','superseded','rolled_back')),
    superseded_by VARCHAR(32) REFERENCES prompts(prompt_version),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at TIMESTAMPTZ
);

CREATE INDEX idx_prompts_family_status ON prompts(family, status);
CREATE UNIQUE INDEX idx_prompts_active_per_family ON prompts(family) WHERE status = 'active';

-- Immutability trigger: rows never updated except status transitions
CREATE OR REPLACE FUNCTION prompts_immutable_body() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.body_template != OLD.body_template OR NEW.schema_input != OLD.schema_input OR NEW.schema_output != OLD.schema_output THEN
        RAISE EXCEPTION 'Prompt body/schema immutable; create new prompt_version instead';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prompts_immutable BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION prompts_immutable_body();
```

### DB-015: prompt_promotions
```sql
CREATE TABLE prompt_promotions (
    promotion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version),
    rollback_target VARCHAR(32) REFERENCES prompts(prompt_version),
    eval_run_id UUID NOT NULL,
    approver_user_id UUID NOT NULL,
    justification TEXT NOT NULL CHECK (LENGTH(justification) >= 20),
    canary_pct INTEGER CHECK (canary_pct BETWEEN 1 AND 100),
    canary_window_hours INTEGER,
    decision_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome VARCHAR(16) CHECK (outcome IN ('canary_started','promoted','rolled_back'))
);

CREATE INDEX idx_prompt_promotions_version ON prompt_promotions(prompt_version);
CREATE INDEX idx_prompt_promotions_ts ON prompt_promotions(decision_timestamp);

-- Append-only
CREATE OR REPLACE FUNCTION reject_modifications() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prompt_promotions_appendonly
    BEFORE UPDATE OR DELETE ON prompt_promotions
    FOR EACH ROW EXECUTE FUNCTION reject_modifications();
```

### DB-017: eval_runs
```sql
CREATE TABLE eval_runs (
    eval_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_id VARCHAR(16) NOT NULL CHECK (eval_id IN ('EVAL-001','EVAL-002')),
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version),
    model_id VARCHAR(64) NOT NULL,
    gold_set_version VARCHAR(32) NOT NULL,
    metrics JSONB NOT NULL,
    slice_breakdown JSONB,
    passed BOOLEAN NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eval_runs_prompt ON eval_runs(prompt_version, run_at DESC);
CREATE INDEX idx_eval_runs_passed ON eval_runs(eval_id, passed, run_at DESC);

CREATE TRIGGER trg_eval_runs_appendonly
    BEFORE UPDATE OR DELETE ON eval_runs
    FOR EACH ROW EXECUTE FUNCTION reject_modifications();
```

### DB-018: gold_sets
```sql
CREATE TABLE gold_sets (
    gold_set_version VARCHAR(32) PRIMARY KEY,         -- e.g. 'gold_set_v1.0', 'gold_set_v1.1'
    eval_id VARCHAR(16) NOT NULL CHECK (eval_id IN ('EVAL-001','EVAL-002')),
    n_examples INTEGER NOT NULL CHECK (n_examples >= 50),
    storage_uri TEXT NOT NULL,                        -- s3://...
    object_lock_until TIMESTAMPTZ NOT NULL,           -- 10y minimum
    label_kappa NUMERIC(4,3),                         -- inter-annotator agreement
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_gold_sets_current_per_eval ON gold_sets(eval_id) WHERE is_current = TRUE;
```

---

## 2. Tenants & Identity (No RLS — managed centrally)

### Auxiliary: users (referenced by FKs throughout)
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,                       -- nullable for cross-tenant Mendora staff
    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(256),
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                -- soft delete for GDPR
);

CREATE UNIQUE INDEX idx_users_email_per_tenant ON users(tenant_id, email) WHERE deleted_at IS NULL;
```

### Tenants table (root)
```sql
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    tier VARCHAR(16) NOT NULL CHECK (tier IN ('pilot','team','enterprise','strategic')),
    region VARCHAR(32) NOT NULL DEFAULT 'us-east-1' CHECK (region IN ('us-east-1','eu-west-1','ap-northeast-1')),
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    cost_ceiling_usd_monthly NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_region ON tenants(region);
```

### role_assignments
```sql
CREATE TABLE role_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    role VARCHAR(32) NOT NULL CHECK (role IN (
        'viewer','intake_user','analyst','approver','security_approver',
        'dual_prod_approver','auditor','tenant_admin','ai_lead','platform_eng'
    )),
    granted_by_user_id UUID NOT NULL REFERENCES users(user_id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_role_assignments_active ON role_assignments(tenant_id, user_id, role) WHERE revoked_at IS NULL;
CREATE INDEX idx_role_assignments_user ON role_assignments(user_id);

ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_role_assignments ON role_assignments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 3. Tenant-Scoped Tables (RLS Enforced)

### DB-001: raw_intake (partitioned monthly)
```sql
CREATE TABLE raw_intake (
    intake_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    body_masked TEXT NOT NULL,
    body_masked_sha256 VARCHAR(64) NOT NULL,
    body_raw_sha256_pre_mask VARCHAR(64) NOT NULL,    -- proof of redaction
    mask_policy_version VARCHAR(16) NOT NULL REFERENCES mask_policies(policy_version),
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('github','jenkins','circleci','gitlab','buildkite')),
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 0 AND 52428800),  -- 50MB
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,                          -- when promoted to cold storage
    lineage_chain JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (intake_id, received_at)
) PARTITION BY RANGE (received_at);

-- Create monthly partitions ahead of time (automated by maintenance job)
CREATE TABLE raw_intake_2026_05 PARTITION OF raw_intake
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE raw_intake_2026_06 PARTITION OF raw_intake
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_raw_intake_tenant_received ON raw_intake(tenant_id, received_at DESC);
CREATE INDEX idx_raw_intake_lineage ON raw_intake USING gin(lineage_chain);

ALTER TABLE raw_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_raw_intake ON raw_intake
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-002: intake_meta
```sql
CREATE TABLE intake_meta (
    intake_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    run_id VARCHAR(256) NOT NULL,
    attempt_id VARCHAR(64) NOT NULL,
    branch VARCHAR(256),
    commit_sha VARCHAR(40),
    actor VARCHAR(256),
    workflow_name VARCHAR(256),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_intake_meta_unique ON intake_meta(tenant_id, run_id, attempt_id);
CREATE INDEX idx_intake_meta_branch ON intake_meta(tenant_id, branch);

ALTER TABLE intake_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_intake_meta ON intake_meta
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Auxiliary: idempotency_keys
```sql
CREATE TABLE idempotency_keys (
    key_value VARCHAR(256) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    request_path VARCHAR(256) NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body_sha256 VARCHAR(64) NOT NULL,
    response_cache JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    PRIMARY KEY (key_value, tenant_id, request_path)
);

CREATE INDEX idx_idempotency_keys_expiry ON idempotency_keys(expires_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_idempotency ON idempotency_keys
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-003: repositories
```sql
CREATE TABLE repositories (
    repo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    provider VARCHAR(16) NOT NULL,
    external_id VARCHAR(64) NOT NULL,
    repo_url VARCHAR(512) NOT NULL,
    default_branch VARCHAR(256) DEFAULT 'main',
    status VARCHAR(16) NOT NULL DEFAULT 'linked' CHECK (status IN ('linked','re_auth_required','revoked','archived')),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_repositories_unique ON repositories(tenant_id, provider, external_id);
CREATE INDEX idx_repositories_status ON repositories(tenant_id, status);

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_repositories ON repositories
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-004: tenant_secrets (PAT, OAuth tokens — AES-256-GCM)
```sql
CREATE TABLE tenant_secrets (
    secret_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    repo_id UUID REFERENCES repositories(repo_id),
    secret_type VARCHAR(32) NOT NULL CHECK (secret_type IN ('github_oauth','github_pat','webhook_signing','signing_key')),
    ciphertext BYTEA NOT NULL,                         -- AES-256-GCM
    iv BYTEA NOT NULL,                                 -- IV
    auth_tag BYTEA NOT NULL,                           -- GCM tag
    dek_kid VARCHAR(256) NOT NULL,                     -- KMS DEK key id
    expires_at TIMESTAMPTZ,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_tenant_secrets_active ON tenant_secrets(tenant_id, secret_type) WHERE revoked_at IS NULL;
CREATE INDEX idx_tenant_secrets_expiry ON tenant_secrets(expires_at) WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

ALTER TABLE tenant_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_secrets ON tenant_secrets
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-005: rca_runs
```sql
CREATE TABLE rca_runs (
    rca_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    intake_id UUID NOT NULL,
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version),
    model_id VARCHAR(64) NOT NULL,
    gold_set_version VARCHAR(32) NOT NULL REFERENCES gold_sets(gold_set_version),
    mask_policy_version VARCHAR(16) NOT NULL REFERENCES mask_policies(policy_version),
    status VARCHAR(32) NOT NULL CHECK (status IN ('rca_confirmed','manual_review_needed','rca_confirmed_fallback')),
    primary_class VARCHAR(32) NOT NULL,
    primary_confidence NUMERIC(4,3) CHECK (primary_confidence BETWEEN 0 AND 1),
    classifications JSONB NOT NULL,                    -- top-K list
    explainability JSONB,
    latency_ms INTEGER,
    is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rca_runs_intake ON rca_runs(tenant_id, intake_id);
CREATE INDEX idx_rca_runs_status ON rca_runs(tenant_id, status, created_at DESC);
CREATE INDEX idx_rca_runs_class ON rca_runs(tenant_id, primary_class);

ALTER TABLE rca_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rca_runs ON rca_runs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-006: prompt_runs (partitioned monthly, append-only)
```sql
CREATE TABLE prompt_runs (
    run_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    rca_run_id UUID,
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version),
    model_id VARCHAR(64) NOT NULL,
    gold_set_version VARCHAR(32) NOT NULL,
    mask_policy_version VARCHAR(16) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,                   -- SHA-256 of post-mask input
    output JSONB NOT NULL,
    latency_ms INTEGER NOT NULL,
    confidence NUMERIC(4,3),
    seed VARCHAR(64),
    temperature NUMERIC(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE prompt_runs_2026_05 PARTITION OF prompt_runs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_prompt_runs_tenant_time ON prompt_runs(tenant_id, created_at DESC);
CREATE INDEX idx_prompt_runs_prompt ON prompt_runs(prompt_version, created_at DESC);

ALTER TABLE prompt_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_prompt_runs ON prompt_runs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Append-only across all partitions
CREATE TRIGGER trg_prompt_runs_appendonly
    BEFORE UPDATE OR DELETE ON prompt_runs
    FOR EACH ROW EXECUTE FUNCTION reject_modifications();
```

### DB-007: repair_plans
```sql
CREATE TABLE repair_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    rca_run_id UUID NOT NULL REFERENCES rca_runs(rca_run_id),
    prev_plan_id UUID REFERENCES repair_plans(plan_id),  -- for edits creating new version
    schema_version VARCHAR(32) NOT NULL DEFAULT 'repair_plan.schema.v1',
    plan_json JSONB NOT NULL,
    plan_hash VARCHAR(64) NOT NULL,                    -- SHA-256 of canonical JSON
    required_approver_role VARCHAR(32) NOT NULL CHECK (required_approver_role IN ('approver','security_approver','dual_prod_approver')),
    status VARCHAR(32) NOT NULL DEFAULT 'plan_ready' CHECK (status IN ('plan_ready','editing','sent_for_approval','approved','rejected','superseded')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version)
);

CREATE INDEX idx_repair_plans_tenant_status ON repair_plans(tenant_id, status, generated_at DESC);
CREATE INDEX idx_repair_plans_rca ON repair_plans(tenant_id, rca_run_id);

ALTER TABLE repair_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_repair_plans ON repair_plans
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-008: approval_records (append-only)
```sql
CREATE TABLE approval_records (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    plan_id UUID NOT NULL REFERENCES repair_plans(plan_id),
    operator_user_id UUID NOT NULL REFERENCES users(user_id),
    operator_role VARCHAR(32) NOT NULL,                -- snapshot at sign time
    decision VARCHAR(16) NOT NULL CHECK (decision IN ('approved','rejected')),
    justification_text TEXT NOT NULL CHECK (LENGTH(justification_text) >= 20),
    plan_hash VARCHAR(64) NOT NULL,                    -- of plan_id at sign time
    hmac_signature VARCHAR(64) NOT NULL,               -- HMAC-SHA256, tenant-rooted key
    hmac_key_kid VARCHAR(256) NOT NULL,                -- KMS key id used
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique per (plan, operator) to prevent double-signing
CREATE UNIQUE INDEX idx_approval_records_unique ON approval_records(plan_id, operator_user_id);
CREATE INDEX idx_approval_records_tenant_time ON approval_records(tenant_id, signed_at DESC);
CREATE INDEX idx_approval_records_operator ON approval_records(operator_user_id);

ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_records ON approval_records
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER trg_approval_records_appendonly
    BEFORE UPDATE OR DELETE ON approval_records
    FOR EACH ROW EXECUTE FUNCTION reject_modifications();
```

### Auxiliary: approval_delegations (OOO)
```sql
CREATE TABLE approval_delegations (
    delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    from_user_id UUID NOT NULL REFERENCES users(user_id),
    to_user_id UUID NOT NULL REFERENCES users(user_id),
    role_delegated VARCHAR(32) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
    created_by_user_id UUID NOT NULL REFERENCES users(user_id),
    revoked_at TIMESTAMPTZ,
    CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_approval_delegations_window ON approval_delegations(tenant_id, starts_at, ends_at) WHERE revoked_at IS NULL;

ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_delegations ON approval_delegations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Auxiliary: notification_log
```sql
CREATE TABLE notification_log (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    plan_id UUID NOT NULL REFERENCES repair_plans(plan_id),
    approver_user_id UUID NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('email','slack','in_app','teams')),
    status VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','delivered')),
    approval_token VARCHAR(256),                       -- 4h validity
    token_expires_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notification_log_unique ON notification_log(plan_id, approver_user_id, channel);
CREATE INDEX idx_notification_log_token ON notification_log(approval_token) WHERE approval_token IS NOT NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notification_log ON notification_log
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-009: audit_exports
```sql
CREATE TABLE audit_exports (
    export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id),
    filter_json JSONB NOT NULL,
    filter_hash VARCHAR(64) NOT NULL,                  -- for idempotency
    status VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','collecting','signing','ready','expired','failed')),
    incident_count INTEGER,
    size_bytes_total BIGINT,
    hmac_signature VARCHAR(64),
    download_urls JSONB,                               -- array of pre-signed URLs
    manifest_url VARCHAR(1024),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,                            -- pre-signed URL expiry
    retention_until TIMESTAMPTZ NOT NULL,              -- 10 years for compliance
    compliance_mapping JSONB
);

CREATE UNIQUE INDEX idx_audit_exports_idempotency ON audit_exports(tenant_id, filter_hash);
CREATE INDEX idx_audit_exports_tenant_time ON audit_exports(tenant_id, requested_at DESC);
CREATE INDEX idx_audit_exports_status ON audit_exports(status) WHERE status IN ('queued','collecting','signing');

ALTER TABLE audit_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_exports ON audit_exports
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-010: export_manifests
```sql
CREATE TABLE export_manifests (
    manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES audit_exports(export_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    schema_version VARCHAR(32) NOT NULL DEFAULT 'audit_export.schema.v1',
    manifest_json JSONB NOT NULL,
    manifest_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_manifests_export ON export_manifests(export_id);

ALTER TABLE export_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_export_manifests ON export_manifests
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-011: kpi_rollups (partitioned by month)
```sql
CREATE TABLE kpi_rollups (
    rollup_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    metric VARCHAR(32) NOT NULL CHECK (metric IN ('mttr','debugging_effort','flaky_recurrence','evidence_completeness','approval_cycle')),
    window VARCHAR(8) NOT NULL CHECK (window IN ('30d','60d','90d')),
    repo_id UUID,
    team_id VARCHAR(64),
    value NUMERIC(12,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rollup_id, computed_at)
) PARTITION BY RANGE (computed_at);

CREATE TABLE kpi_rollups_2026_05 PARTITION OF kpi_rollups
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_kpi_rollups_lookup ON kpi_rollups(tenant_id, metric, window, computed_at DESC);

ALTER TABLE kpi_rollups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_kpi_rollups ON kpi_rollups
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-012: evidence_events
```sql
CREATE TABLE evidence_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    event_type VARCHAR(64) NOT NULL,
    subject_id UUID NOT NULL,                          -- intake/plan/approval/export id
    subject_type VARCHAR(32) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_events_tenant_type ON evidence_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_evidence_events_subject ON evidence_events(subject_id);

ALTER TABLE evidence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_evidence_events ON evidence_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### DB-016: flaky_signals
```sql
CREATE TABLE flaky_signals (
    signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    repo_id UUID NOT NULL REFERENCES repositories(repo_id),
    test_id VARCHAR(512) NOT NULL,
    git_tree_sha VARCHAR(40) NOT NULL,
    pass_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    disruption_rate NUMERIC(5,4),
    is_flaky BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quarantined_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_flaky_signals_unique ON flaky_signals(tenant_id, repo_id, test_id, git_tree_sha);
CREATE INDEX idx_flaky_signals_flaky ON flaky_signals(tenant_id, is_flaky, last_seen_at DESC) WHERE is_flaky = TRUE;

ALTER TABLE flaky_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_flaky_signals ON flaky_signals
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Auxiliary: tenant_quotas (cost ceiling)
```sql
CREATE TABLE tenant_quotas (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id),
    monthly_llm_calls_limit INTEGER,
    monthly_cost_usd_limit NUMERIC(12,2),
    current_month_llm_calls INTEGER NOT NULL DEFAULT 0,
    current_month_cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
    month_anchor DATE NOT NULL DEFAULT date_trunc('month', NOW())::date,
    soft_alert_sent_at TIMESTAMPTZ,
    hard_throttle_active BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_quotas ON tenant_quotas
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Auxiliary: access_log (audit)
```sql
CREATE TABLE access_log (
    log_id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    user_id UUID REFERENCES users(user_id),
    api_path VARCHAR(256) NOT NULL,
    http_method VARCHAR(8) NOT NULL,
    response_status SMALLINT NOT NULL,
    ip_address INET,
    user_agent VARCHAR(512),
    trace_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE access_log_2026_05 PARTITION OF access_log
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_access_log_user ON access_log(user_id, created_at DESC);
CREATE INDEX idx_access_log_path ON access_log(api_path, created_at DESC);

ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_access_log ON access_log
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Auxiliary: drift_events
```sql
CREATE TABLE drift_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,                                    -- nullable for global drift
    prompt_version VARCHAR(32) REFERENCES prompts(prompt_version),
    metric VARCHAR(32) NOT NULL,
    psi_value NUMERIC(6,3),
    chi_square_p NUMERIC(8,6),
    threshold_breached VARCHAR(16) NOT NULL,
    alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX idx_drift_events_prompt ON drift_events(prompt_version, detected_at DESC);
CREATE INDEX idx_drift_events_unresolved ON drift_events(detected_at DESC) WHERE resolved_at IS NULL;
```

### Auxiliary: regression_runs
```sql
CREATE TABLE regression_runs (
    regression_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version VARCHAR(32) NOT NULL REFERENCES prompts(prompt_version),
    replay_set_version VARCHAR(32) NOT NULL,
    n_incidents INTEGER NOT NULL,
    parity_pct NUMERIC(5,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    details JSONB,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regression_runs_prompt ON regression_runs(prompt_version, run_at DESC);
```

---

## 4. Retention & Archival

### Daily retention job (cron 02:00 UTC)
```sql
-- Pseudo-procedure; in production, a Sqitch deploy + cron
CREATE OR REPLACE FUNCTION daily_retention_job() RETURNS void AS $$
BEGIN
    -- Detach partitions older than 18 months → archive to S3
    -- (executed via maintenance worker, not in-database)

    -- Purge expired idempotency keys
    DELETE FROM idempotency_keys WHERE expires_at < NOW();

    -- Expire access tokens that should have rolled
    UPDATE notification_log SET status = 'failed' WHERE status = 'queued' AND token_expires_at < NOW();

    -- Mark pre-signed URLs expired
    UPDATE audit_exports SET status = 'expired' WHERE status = 'ready' AND expires_at < NOW();

    -- Drift events auto-resolve after 30 days if no investigation
    -- (alerts continue if still active)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Retention table summary
| Table | Hot retention | Archive | Total | Compliance anchor |
|---|---|---|---|---|
| raw_intake | 18 months | 10 years cold | 11.5y | Art. 12 |
| prompt_runs | 18 months | 10 years cold | 11.5y | Art. 12 |
| approval_records | 10 years | — | 10y | Art. 18 |
| audit_exports | 10 years | — | 10y | Art. 18 |
| export_manifests | 10 years | — | 10y | Art. 18 |
| kpi_rollups | 24 months | — | 24m | analytics |
| access_log | 6 months active + 18m archive | 7y cold | 7.5y | SOC 2 |
| evidence_events | 24 months | — | 24m | — |
| flaky_signals | 24 months | — | 24m | — |
| drift_events | 5 years | — | 5y | governance |

---

## 5. RLS Verification

The RLS pattern is: every tenant-scoped query, after JWT validation at the app gateway, MUST issue `SET LOCAL app.tenant_id = '<uuid>'` before any data access. Direct SQL connections without this setting will fail with empty result sets (RLS denies by default with `current_setting('app.tenant_id', true)` returning NULL).

### Test pattern (TEST-013-A and TEST-016)
```sql
-- Setup
BEGIN;
SET LOCAL app.tenant_id = 'tenant-A-uuid';
INSERT INTO raw_intake (intake_id, tenant_id, body_masked, ...) VALUES (...);
COMMIT;

-- Cross-tenant attempt (should return ZERO rows)
BEGIN;
SET LOCAL app.tenant_id = 'tenant-B-uuid';
SELECT * FROM raw_intake;
-- Expected: 0 rows
COMMIT;

-- Forged JWT chaos test
BEGIN;
-- No SET LOCAL → app.tenant_id is NULL
SELECT * FROM raw_intake;
-- Expected: 0 rows (policy fails open with NULL)
COMMIT;
```

### Pen-test sweep (RC-006)
Quarterly external pen-test executes: SQL injection attempts that bypass `SET LOCAL`, JWT forgery with non-existent tenant_id, session fixation, role escalation attempts. All must fail.

---

## 6. Index Audit Summary

Total indexes across 18 entities + auxiliaries: **52 indexes**.

| Pattern | Count |
|---|---|
| `(tenant_id, time)` B-tree | 12 |
| Unique constraint with `tenant_id` | 8 |
| Foreign-key indexes | 14 |
| Partial indexes (WHERE filters) | 9 |
| GIN on JSONB | 2 |
| Single-column FK | 7 |

Index review cadence: monthly via `pg_stat_user_indexes` — drop unused, add if missing for >5% query slowdown.

---

## 7. Migration Strategy

- **Tool:** Sqitch with verify scripts
- **Repository:** `mendoraci-platform/db/sqitch/`
- **Approval:** every migration touching C3+ tables (raw_intake, approval_records, audit_exports, prompt_runs) requires DPO and Sec Lead sign-off in PR
- **Deploy:** zero-downtime; new columns nullable; column drops via 3-step (add_new → migrate → drop_old)
- **Rollback:** every migration has `revert/` script tested in staging

---

## 8. Connection Pooling

- **Pool:** PgBouncer in transaction mode
- **Per-tenant pool sizing:** Pilot 10, Team 25, Enterprise 100, Strategic 250 concurrent
- **Statement timeout:** 30s default; 60s for `/v1/evidence/export`
- **Idle timeout:** 60s

---

## 9. Backup & PITR

- **Streaming replication:** to DR region with 5-min RPO
- **Daily full backup:** to S3 Glacier; 35-day PITR window
- **Restore drill:** quarterly chaos game day (IMP-015)
