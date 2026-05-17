# MendoraCI 1208 Document Set — Index & Changelog

**Generated:** 2026-05-17 12:08 UK
**Trigger:** Closes the 9 fixes from `AT-Hack0020_MendoraCI_FinalProductReview_ChatGPT_20260517_1201.md`
**Strategy:** Keep the 1130 set intact; add this 1208 delta set alongside it
**Status:** All 9 ChatGPT fixes closed

---

## What Changed

The 1130 package received an 8.4/10 verdict from ChatGPT with 9 specific correction items. This 1208 set closes all 9. The 1130 docs remain unchanged; everything here is **additive** (5 new docs ChatGPT requested) or **delta/replacement** (4 docs that supersede portions of 1130 docs).

The decision to keep both sets was deliberate: the 1130 set is the "as-reviewed" record; the 1208 set is the corrections trail. An auditor or build team can see exactly what was fixed, when, and why.

---

## File Index (9 files)

| # | File | Type | Closes | Words (approx) |
|---|---|---|---|---|
| 1 | MendoraCI_FullUserStories_US001_US034_20260517_1208.md | NEW | Fix 1 | 4,200 |
| 2 | MendoraCI_MVPBuildLock_20260517_1208.md | NEW | Fix 9 | 2,400 |
| 3 | MendoraCI_API_JSONSchemas_20260517_1208.md | NEW | Fix 2 | 5,500 |
| 4 | MendoraCI_PostgresDDL_RLS_20260517_1208.md | NEW | Fix 3 | 6,800 |
| 5 | MendoraCI_DemoSeedPackSpec_20260517_1208.md | NEW | Fix 6 | 5,100 |
| 6 | MendoraCI_BuildBlockersBeforeMVP_20260517_1208.md | DELTA → RC register + 1130 IMP | Fix 4 | 2,100 |
| 7 | MendoraCI_LegalComplianceWording_20260517_1208.md | DELTA → BRD §11, ExecutiveSummary, MasterMatrix, ClaudeAnnex, DemoScript, Glossary | Fix 5 | 3,000 |
| 8 | MendoraCI_TestAutomationRebalance_20260517_1208.md | DELTA → 1130 TestAutomationMatrix ownership | Fix 7 | 3,200 |
| 9 | MendoraCI_CompetitorEvidenceAppendix_20260517_1208.md | DELTA → MasterMatrix §4 + ClaudeAnnex §7 | Fix 8 | 3,900 |
| — | MendoraCI_1208_Index_Changelog.md | this file | — | 600 |

**Total new content:** ~36,800 words across 9 substantive documents plus this index.

---

## Closure Receipt Per Fix

### Fix 1 — Full User Stories US-001..US-034 ✅
Closed by **MendoraCI_FullUserStories_US001_US034_20260517_1208.md**. All 34 stories now have persona, story, BR link, SCR/API link, acceptance criteria, negative path, priority, phase. Organized into 9 epics. Coverage matrix at §10.

### Fix 2 — API Full JSON Schemas ✅
Closed by **MendoraCI_API_JSONSchemas_20260517_1208.md**. JSON Schema 2020-12 for all 10 APIs with required fields, optional fields, enums, auth role, success/error responses, idempotency, events emitted, DB writes. Includes canonical `repair_plan.schema.v1.json` and `audit_export.schema.v1.json`.

### Fix 3 — Postgres DDL + RLS ✅
Closed by **MendoraCI_PostgresDDL_RLS_20260517_1208.md**. DDL for all 18 entities plus 9 auxiliaries with PKs, FKs, RLS policies, indexes, JSONB fields, retention columns, append-only triggers, partitioning. Includes migration strategy and connection pooling.

### Fix 4 — Build Blockers Before MVP ✅
Closed by **MendoraCI_BuildBlockersBeforeMVP_20260517_1208.md**. RC-021 (RLS at query layer), RC-028 (model fallback registry), RC-030 (security-approver for secret rotation) each have an hour-by-hour closure plan, owner, evidence-of-closure, and fallback. Other 14 open RCs get their NOT-blocker rationale.

### Fix 5 — Legal/Compliance Wording ✅
Closed by **MendoraCI_LegalComplianceWording_20260517_1208.md**. Canonical replacements for EU AI Act / SOC 2 / ISO 27001 / ISO 42001 / GDPR claims. 7 specific patches to 1130 docs. Standard disclaimer footer block. Sales pocket card. Phase-tiered roadmap for stronger claims over time.

### Fix 6 — Demo Seed Pack ✅
Closed by **MendoraCI_DemoSeedPackSpec_20260517_1208.md**. 14 concrete artifacts spec'd: tenant SQL, sample failure logs (with embedded secrets), expected mask output, RCA JSON, plan JSON, approval JSON, evidence manifest, ZIP structure, backup scenarios B (flaky) and C (secret rotation w/ dual-approval), 30-day historical seed for SCR-007, EVAL gold sets, mask red-team N=500 corpus. Re-seed command and determinism guarantees included.

### Fix 7 — Test Automation Rebalance ✅
Closed by **MendoraCI_TestAutomationRebalance_20260517_1208.md**. 9 tests moved from manual/quarterly/per-release into per-PR CI: TEST-013-A (RLS chaos), TEST-014-A (RBAC sweep), TEST-016 (JWT forgery), TEST-018 (evidence ZIP HMAC), TEST-019 (Slack deep-link), TEST-021 (prompt promotion bypass), TEST-023 (mask red-team N=500), TEST-025 (eval gate block), TEST-026 (Axe accessibility). One-week phased rollout plan. New CI pipeline diagram. Pod-by-pod ownership map.

### Fix 8 — Competitor Evidence Appendix ✅
Closed by **MendoraCI_CompetitorEvidenceAppendix_20260517_1208.md**. Source-backed analysis of Datadog CI Visibility, BuildPulse, Trunk Flaky Tests, CircleCI Insights, Sentry, GitHub Copilot, Amazon Q Developer, Cursor. Each: capabilities present/absent, overlap analysis, honest positioning, verification notes. Buyer-grade matrix with 7 MendoraCI-only moat columns. Anti-sales honest section. Battlecard pattern. 90-day refresh cadence.

### Fix 9 — MVP Build Lock ✅
Closed by **MendoraCI_MVPBuildLock_20260517_1208.md**. Single-page-style 20-row capability × tier table (Hackathon MVP / Pilot / Enterprise). 15 hard-OUT items explicitly listed. 10 demo-day pass gates (MVP-G1..G10). 36-hour build sequence by workstream. Exception process. Tier-by-tier ACV mapping.

---

## Recommended Read Order

For someone reviewing the corrections:

1. **MVPBuildLock** (2 min) — see what ships and what doesn't
2. **BuildBlockersBeforeMVP** (3 min) — see which critical risks close in the first 12 hours
3. **FullUserStories** (10 min) — see the now-complete US-001..US-034
4. **API_JSONSchemas** (30 min) — implementation contracts
5. **PostgresDDL_RLS** (30 min) — implementation contracts
6. **DemoSeedPackSpec** (15 min) — what the demo looks like end-to-end
7. **TestAutomationRebalance** (10 min) — what's in CI now vs before
8. **LegalComplianceWording** (10 min) — how we talk about compliance
9. **CompetitorEvidenceAppendix** (15 min) — how we position against the field

Total review time: ~2 hours. The 1130 set remains the authoritative baseline for everything else.

---

## What Remains For The Build Team

After this 1208 set is reviewed and ratified:

1. **Apply the 7 wording patches in §2 of LegalComplianceWording** to the 1130 BRD §11, ExecutiveSummary, MasterMatrix, ClaudeAnnex, DemoScript, and Glossary
2. **Build the 14 artifacts spec'd in DemoSeedPackSpec** into `seeds/acmepilot/`, `seeds/acmesecret/`, `seeds/acmeflaky/`, `seeds/_eval/`, `seeds/_redteam/`
3. **Implement the 9 CI test rebalances** per TestAutomationRebalance §6 phasing
4. **Close the 3 build blockers** per BuildBlockersBeforeMVP §1-3 hour-by-hour plans
5. **Begin the 36-hour build per MVPBuildLock §4** workstream sequence

The 1208 set together with the 1130 set is what the coding agent receives at hour 0 of the build.

---

## Document Provenance

- **Author:** Claude (Anthropic)
- **Triggering review:** ChatGPT
- **Authority:** This corrections set was generated in direct response to ChatGPT's review. All 9 fixes are addressed. No fix was deferred or descoped.
- **Sign-off needed:** Mendora VPE + Sec Lead + AI Lead before build hour 0
