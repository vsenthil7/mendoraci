# MendoraCI_BuildBlockersBeforeMVP_20260517_1208

**Document Type:** Build Blockers Before MVP
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 4 — "Open critical review comments need pre-build closure plan"
**Status:** AUTHORITATIVE — every item below MUST be green before hour 0 of the build, or have a Sec Lead-signed exception

---

## 0. Purpose

ChatGPT's review identified three **Critical/High open RC items** that need pre-build closure plans, not just deferral notes. This document moves them into hard build blockers with owner, evidence-of-closure, and a parallel work plan so they close in the first 8 hours of the build rather than at the end.

The intent: **no MVP coding starts on these surfaces until these blockers are green**. The build team works around them (other surfaces) while blockers close in parallel.

---

## 1. Block A — RC-021 — RLS at Query Layer (Critical)

### What
Row-level security must be enforced at the Postgres query layer, not just at the application layer. Application-only checks fail open under misrouted code paths, ORM bugs, or future engineering mistakes.

### Why critical
Multi-tenant data crossover is product-existential. ChatGPT correctly flagged this is the single largest residual risk before build start.

### Closure plan (must complete by Hour 4)
1. **Hour 0–1:** Sec Lead reviews `MendoraCI_PostgresDDL_RLS_20260517_1208.md` §3 (RLS policy pattern); confirms every tenant-scoped table has `ENABLE ROW LEVEL SECURITY` + a `tenant_isolation_<table>` policy.
2. **Hour 1–2:** BE Lead implements gateway middleware that issues `SET LOCAL app.tenant_id = '<uuid>'` after JWT validation; any code path that opens a DB connection without this setting fails CI lint.
3. **Hour 2–3:** Sec Lead writes pen-test fixture: forge JWT with different tenant_id, attempt to read foreign tenant data, MUST return zero rows.
4. **Hour 3–4:** TEST-013-A (RLS chaos test) added to CI gate; runs on every PR; failing build blocks merge.
5. **Sign-off:** Sec Lead countersigns in `build_blocker_signoffs.md` before Hour 4.

### Evidence of closure
- RLS policies present on all 18 tenant-scoped tables (verified via `SELECT tablename FROM pg_tables WHERE rowsecurity = TRUE`)
- Middleware code committed; lint rule blocks unprotected connections
- TEST-013-A green in CI
- Sec Lead signature in `build_blocker_signoffs.md`

### Owner
Sec Lead (primary), BE Lead (implementation)

### Fallback if not green by Hour 4
**Hard escalation to VPE.** No tenant-scoped feature ships until green. Build team works on tenant-agnostic surfaces (mask engine, prompt registry, schema migrations) in parallel.

---

## 2. Block B — RC-028 — Model Fallback Registry with Auto-Failover (High)

### What
Single LLM provider dependency = vendor-existential risk. Model fallback registry must be operational before MVP ships, with at least a rules-baseline `rca_fallback_v1` available for both RCA and plan generation when the primary IBM Bob inference is unavailable.

### Why critical
A 4-hour Bob outage during demo or pilot = product appears completely broken. R-03 score 12 (high). Without this, no enterprise prospect will sign.

### Closure plan (must complete by Hour 8)
1. **Hour 0–2:** AI Lead designs fallback registry schema (primary → secondary → rules-baseline); implements as `model_fallback_registry.yaml` in repo, loaded at service startup.
2. **Hour 2–4:** BE Lead implements failover middleware: on Bob timeout (30s) or 5xx, route to secondary; on secondary failure, route to `rca_fallback_v1` rules classifier.
3. **Hour 4–6:** AI Lead implements `rca_fallback_v1` rules: regex-based pattern matching on 12 classes from log patterns; expected baseline accuracy ~58% (governed, not high-accuracy).
4. **Hour 6–7:** TEST-028 (vendor outage failover test) added to CI; staging env simulates Bob 503 for 30s; system MUST return result tagged `rca_confirmed_fallback` within 30s.
5. **Hour 7–8:** Failover decision UI on SCR-003 (amber banner: "Using rules fallback — confidence reduced").

### Evidence of closure
- `model_fallback_registry.yaml` committed
- TEST-028 green in CI
- Manual chaos test in staging: kill Bob endpoint, system returns valid fallback within 30s
- SCR-003 amber banner verified in UI

### Owner
AI Lead (primary), BE Lead (failover middleware), FE Lead (banner)

### Fallback if not green by Hour 8
Demo MUST switch to recorded fallback video; live demo cannot proceed safely without resilience.

---

## 3. Block C — RC-030 — Security-Approver Role for Secret Rotation (High)

### What
Plans that rotate secrets MUST require `security_approver` role; a regular `approver` cannot sign them. This is separation-of-duties for the most security-sensitive plan type.

### Why critical
Without this, any approver could sign off on PAT rotation, KMS key updates, or webhook secret changes — exactly the highest-blast operations. This is also a key SOC 2 CC6.1 / ISO 42001 §7.4 control.

### Closure plan (must complete by Hour 12)
1. **Hour 0–2:** AI Lead defines `required_approver_role` resolution rules in `MendoraCI_RBACPermissionMatrix_20260517_1130.md` §3 (already done in 1130 set); confirms rules cover secret rotation, prod-touching, destructive infra.
2. **Hour 2–6:** BE Lead implements role resolution at plan generation time: writes `required_approver_role` to `repair_plans` row; API-006 enforces role match at sign time.
3. **Hour 6–10:** FE Lead implements SCR-005 role-check UI: if approver lacks required role, button is disabled with helper text "Required role: security_approver"; backend returns 403 ROLE_INSUFFICIENT.
4. **Hour 10–12:** TEST-014-A (RBAC matrix sweep) extended with secret-rotation specific row: regular approver attempts to sign secret-rotation plan → must get 403.

### Evidence of closure
- `repair_plans.required_approver_role` populated in all plan rows
- API-006 returns 403 ROLE_INSUFFICIENT for role mismatch (manual test)
- TEST-014-A green
- Backup demo scenario C (`seeds/acmesecret/`) demonstrates the flow live

### Owner
Sec Lead (policy), BE Lead (enforcement), FE Lead (UI), AI Lead (plan resolution rules)

### Fallback if not green by Hour 12
Backup scenario C cannot be demoed; primary OOM scenario only. Note in demo prep: "Dual-approval demo deferred to Phase 4."

---

## 4. Summary — Blocker Status Tracker

This table is updated live during the build. Each blocker is green/amber/red.

| Block | RC | Closure Hour | Owner | Status |
|---|---|---|---|---|
| A | RC-021 RLS at query layer | Hour 4 | Sec Lead | 🟡 In progress |
| B | RC-028 Model fallback registry | Hour 8 | AI Lead | 🟡 In progress |
| C | RC-030 Security-approver for secret rotation | Hour 12 | Sec Lead + BE Lead | 🟡 In progress |

**Status definitions:**
- 🟢 Green: closure evidence committed, signed off by owner
- 🟡 Amber: in progress, on schedule
- 🔴 Red: behind schedule, escalation required

---

## 5. Build Blocker Sign-off Log

All sign-offs recorded in `/governance/build_blocker_signoffs.md` with timestamps. Sample row:

```
2026-05-17 14:23 UTC | RC-021 | RLS at query layer | Sec Lead: [signature]
  Evidence: pg_tables shows 18 tables with rowsecurity=TRUE; TEST-013-A passing on 3 consecutive PRs
```

---

## 6. Why These Three And Not Others?

The 1130 RC register has 17 open items. Why are only 3 hard blockers?

| Open RC | Why NOT a blocker |
|---|---|
| RC-006 Multi-tenant pen-test | External pen-test is a Phase 4 deliverable — internal RLS audit (RC-021) covers pre-MVP risk |
| RC-008 Mask false-positive rate | Affects RCA quality, not security; can ship with shadow telemetry and tune in pilot |
| RC-009 RCA confidence calibration ECE | EVAL-001 captures binary pass/fail; ECE is a refinement |
| RC-010 Approval delegation OOO | Phase 4 feature; not in MVP scope |
| RC-013 Flaky parity vs BuildPulse | Pilot exit gate, not MVP |
| RC-014 Provider-specific secrets | Covered in pilot, baseline secrets caught by v1 patterns |
| RC-017 Demo deterministic seed | Closed by `MendoraCI_DemoSeedPackSpec_20260517_1208.md` |
| RC-020 Drift detector PSI alert | Phase 2 end deliverable; baseline EVAL gate covers MVP |
| RC-022 RBAC matrix tested | TEST-014-A is in MVP — closes during build |
| RC-024 Cost ceiling alerts | Phase 4 (IMP-017) |
| RC-025 QBR template | Phase 4 (IMP-024) |
| RC-026 Data residency flag | Phase 4 (IMP-021) |
| RC-027 Replay/regression harness | Phase 3 (IMP-014) |
| RC-029 Chaos test pack | Phase 4 (IMP-015) |

The three blockers (RC-021, RC-028, RC-030) are the ones that, if **shipped broken**, would block the MVP cut from being demo-able or pilot-able. The others are either Phase 4 deliverables or refinements that won't kill the MVP.

---

## 7. Exception Process

If a build blocker cannot close by its target hour:

1. Owner posts in `#mvp-blockers` channel with status
2. VPE + Sec Lead joint review within 2 hours
3. Three outcomes possible:
   - **Push closure deadline back** — re-baseline other workstreams
   - **Accept residual risk** — Sec Lead signs an acknowledgment with mitigation plan
   - **Switch to fallback** — for demo, switch to recorded video; for pilot, descope the surface

No exception is permitted without VPE + Sec Lead joint sign-off. Exceptions are logged in `build_blocker_exceptions.md` with full audit trail.
