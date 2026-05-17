# MendoraCI_RBACPermissionMatrix_20260517_1130

**Document Type:** RBAC Permission Matrix
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Role Catalog

| Role | Description | Scope |
|---|---|---|
| `viewer` | Read-only; sees KPIs & masked incidents | Tenant |
| `intake_user` | Can submit intakes (UI + webhook); read own | Tenant |
| `analyst` | Read RCA + repair plans; cannot approve | Tenant |
| `approver` | Sign repair-plan approvals (non-prod, non-secret) | Tenant |
| `security_approver` | All `approver` + sign secret-rotation plans | Tenant |
| `dual_prod_approver` | Required for any plan touching `main` / `prod` | Tenant |
| `auditor` | Export evidence packs | Tenant |
| `tenant_admin` | Link repos, manage roles, manage cost ceiling, view all | Tenant |
| `ai_lead` | Promote prompts, review EVAL drift | Cross-tenant (Mendora staff) |
| `platform_eng` | Operational read-only across tenants | Cross-tenant (Mendora staff) |

Roles compose: e.g., a user can be both `approver` and `auditor`. `tenant_admin` is the only role with role-management permission within a tenant.

---

## 2. Permission × API × Screen Matrix

| Role / Permission | API allow-list | SCR allow-list | DB audit writes |
|---|---|---|---|
| viewer | API-002 GET, API-009 GET | SCR-001 RO, SCR-007 | `access_log` |
| intake_user | API-001 POST, API-002 GET (own) | SCR-001 RW | `intake_meta`, `access_log` |
| analyst | + API-004 GET, API-005 GET | + SCR-003, SCR-004 (RO) | `access_log` |
| approver | + API-006 POST, API-007 POST | + SCR-005 | `approval_records`, `notification_log` |
| security_approver | as approver + scope `secret-rotation` | SCR-005 | `approval_records` |
| dual_prod_approver | as approver + scope `prod` | SCR-005 | `approval_records` |
| auditor | + API-008 POST | + SCR-006 | `audit_exports`, `export_manifests` |
| tenant_admin | All tenant APIs incl. API-003 POST, role mgmt | All SCRs + admin tabs | `admin_audit_log` |
| ai_lead | API-010 POST | Cross-tenant admin | `prompt_promotions`, `eval_runs` |
| platform_eng | Read-only metrics endpoints | Cross-tenant ops console | `platform_access_log` |

---

## 3. Approval-Role Resolution

For each repair plan, `required_approver_role` is set at generation time by these rules (first match wins):

1. Plan suggests **secret rotation** OR touches `tenant_secrets` → `security_approver` REQUIRED
2. Plan touches **default branch** OR **prod environment** → `dual_prod_approver` (need 2 signatures)
3. Plan suggests **destructive infra action** (delete, terminate, drop) → `dual_prod_approver`
4. Plan blast_radius == `high` → `security_approver` OR `dual_prod_approver`
5. Otherwise → `approver`

The resolved role is written to `repair_plans.required_approver_role` and enforced at API-006 sign time.

---

## 4. Negative-Permission Test Sweep (TEST-014-A)

| Test row | Actor role | Action | Expected |
|---|---|---|---|
| 1 | viewer | POST /intake | 403 |
| 2 | intake_user | POST /approval/sign | 403 |
| 3 | analyst | POST /approval/sign | 403 |
| 4 | approver (regular) | sign secret-rotation plan | 403 (role insufficient) |
| 5 | approver | sign prod-touching plan (single sig) | 403 (dual required) |
| 6 | auditor | POST /repos/link | 403 |
| 7 | tenant_admin A | view tenant B data | 403 (cross-tenant) |
| 8 | ai_lead (tenant A admin scope) | view tenant B prompt promotions | 200 (cross-tenant by design) |
| 9 | ai_lead | sign approval in tenant A | 403 (not approver in tenant) |
| 10 | platform_eng | POST /approval/sign | 403 (read-only) |
| 11 | expired JWT | any write | 401 |
| 12 | revoked role | any write to that scope | 403 |
| 13 | tenant_admin | role assignment for ai_lead role | 403 (Mendora-staff only) |
| 14 | security_approver | sign own plan they authored | 403 (separation of duties) |

Sweep runs in CI on every PR; any deviation blocks merge.

---

## 5. Audit Log Coverage

Every privileged action writes to one of: `access_log`, `intake_meta`, `approval_records`, `notification_log`, `audit_exports`, `admin_audit_log`, `prompt_promotions`, `platform_access_log`. Retention follows table policy (DataModelERD §4); minimum 6 months per Article 12, default 10 years for approval/promotion/export tables.

---

## 6. Separation of Duties

- Plan author cannot approve their own plan (rule 14 above)
- `ai_lead` cannot also hold `approver` in the same tenant
- Audit-pack signing key is split between AI Lead and Sec Lead in production (Phase 4); demo uses single key

---

## 7. Role-Assignment Workflow

1. Tenant admin requests new role assignment via SCR-admin → `admin_audit_log` row
2. For sensitive roles (`security_approver`, `dual_prod_approver`, `auditor`), require co-approval from another `tenant_admin` (Phase 4 — IMP-019)
3. Mendora-staff roles (`ai_lead`, `platform_eng`) assigned via internal IdP; never granted by tenant
