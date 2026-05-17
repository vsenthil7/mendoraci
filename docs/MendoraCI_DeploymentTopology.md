# MendoraCI_DeploymentTopology_20260517_1130

**Document Type:** Reference Deployment Topology
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Environments

| Env | Purpose | Region | Tenancy | Data |
|---|---|---|---|---|
| `dev` | Engineer-local + shared dev cluster | us-east-1 | Single | Synthetic |
| `staging` | Pre-prod, eval CI runs | us-east-1 | Single | Anonymized prod |
| `prod-us` | Production US | us-east-1 (primary), us-west-2 (DR) | Multi-tenant | Real, encrypted |
| `prod-eu` | Production EU (Phase 4, IMP-021) | eu-west-1 (primary), eu-central-1 (DR) | Multi-tenant, residency-tagged | Real, encrypted, region-locked |

---

## 2. Reference Topology (prod-us)

```
                ┌──────────────────────────┐
   GitHub  ───▶ │  Cloudflare WAF + LB     │
   Jenkins ───▶ │  (TLS 1.3, mTLS optional)│
   Direct  ───▶ └────────────┬─────────────┘
                              │
              ┌───────────────┴───────────────┐
              │     Next.js App Servers       │  (autoscale 3-12 pods)
              │     - Web UI + API gateway    │
              └───────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐         ┌──────▼──────┐       ┌──────▼──────┐
   │ Workers │         │  Postgres   │       │   Redis     │
   │ - mask  │         │  primary +  │       │  queues +   │
   │ - rca   │         │  replicas   │       │  cache      │
   │ - plan  │         │  RLS-enabled│       │             │
   │ - notify│         └─────────────┘       └─────────────┘
   │ - signer│
   │ - rollup│         ┌──────────────┐      ┌──────────────┐
   └────┬────┘         │  S3 Object   │      │  KMS         │
        │              │  Lock (10yr) │      │  per-tenant  │
        ▼              │  evidence ZIP│      │  DEKs        │
   ┌─────────┐         └──────────────┘      └──────────────┘
   │ LLM     │
   │ IBM Bob │         ┌──────────────┐
   │ + fallbk│         │ OTel collect │
   └─────────┘         │ → Prometheus │
                       │ → Grafana    │
                       │ → Alerts     │
                       └──────────────┘
```

---

## 3. Network Zones

| Zone | Contents | Ingress | Egress |
|---|---|---|---|
| Public | WAF + LB | 443 from Internet | to App zone only |
| App | Next.js + workers | from WAF only | to Data, LLM, Observability |
| Data | Postgres, Redis, S3, KMS | from App only | none (KMS calls API-bound) |
| LLM | Outbound to IBM Bob, fallback providers | n/a | TLS 1.3, IP-allowlisted endpoints |
| Observability | OTel collector, Prometheus, Grafana | from all internal zones | to alerting (PagerDuty, Slack) |

VPC: private subnets for App / Data / Observability; Data zone has no public route; KMS via VPC endpoint.

---

## 4. Multi-Tenancy

**Logical isolation only (MVP & Pilot).** Postgres Row-Level Security (RLS) on `tenant_id` column on every tenant-scoped table. Application sets `SET LOCAL app.tenant_id` per request after JWT validation. Cross-tenant queries impossible at DB layer (RC-021 closure).

**Per-tenant KMS DEK** for field-level encryption of `tenant_secrets`. Quarterly rotation.

**Phase 5 dedicated-tenant option:** for Strategic-tier customers, dedicated Postgres schema + dedicated worker pods.

---

## 5. Tenant Region & Data Residency (IMP-021, Phase 4)

- Tenant row has `region` column (`us-east-1` default, `eu-west-1` available)
- App router consults `region` on every request; routes to regional cluster
- Per-region Postgres + S3 + KMS — no cross-region replication of tenant data
- Audit endpoints expose `data_region` field for compliance verification
- TEST-013-B verifies that tenant data is bit-for-bit absent from non-residency regions

---

## 6. Disaster Recovery

| Tier | RPO | RTO | Mechanism |
|---|---|---|---|
| Postgres | 5 min | 30 min | Streaming replication to DR region + 5-min PITR |
| Object storage | Zero (cross-region replication) | < 5 min | S3 cross-region replication with object lock preserved |
| KMS | Zero | < 5 min | Multi-region keys |
| LLM provider | n/a | 30s failover | Model fallback registry (IMP-023) |

DR drill cadence: quarterly chaos game day (IMP-015 / RC-029).

---

## 7. Secrets & Key Management

- All API keys, OAuth client secrets, signing keys held in KMS-rooted secret manager
- Per-tenant DEK for `tenant_secrets.pat_encrypted` (AES-256-GCM)
- Evidence-pack signing key held in HSM-backed KMS; signing requires per-call KMS API authorization
- No secret material ever logged; OTel log scrubber enforces (red-team validated)

---

## 8. CI/CD for MendoraCI itself

- Source: GitHub mono-repo
- CI: GitHub Actions
- Eval gate: PR builds run EVAL-001/002 against current gold sets; red EVAL blocks merge (TEST-025)
- Deploy: gradual rollout (5% → 25% → 100%) with auto-rollback on SLO breach
- Prompt promotions: separate from code deploy; require API-010 with `ai_lead` role
