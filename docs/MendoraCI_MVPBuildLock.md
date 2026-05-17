# MendoraCI_MVPBuildLock_20260517_1208

**Document Type:** MVP Build Lock — Hard Scope Freeze for Hackathon Cut
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 9 — "Phase plan should separate hackathon MVP vs enterprise target"
**Status:** AUTHORITATIVE — any deviation requires VPE + PM joint sign-off, recorded in `mvp_lock_exceptions` log

---

## 0. Purpose

This is the **single source of truth** for what ships in the 36-hour hackathon MVP versus what is roadmap. The MasterMatrix shows what could be built; the BRD shows the full vision; **this document binds the build team**. Anything not in the "Hackathon MVP" column is explicitly out of scope for the hack cut.

The intent is to eliminate the most common hackathon failure: scope drift in hour 30 that compromises the demo.

---

## 1. Master Build Lock Table

| # | Capability | Hackathon MVP (36h) | Pilot (Phase 4, weeks 1-6) | Enterprise (Phase 4 end - Phase 5) |
|---|---|---|---|---|
| 1 | **CI intake** | GitHub Actions webhook + direct upload UI; **Jenkins via curl-style POST mocked**; matrix-run dedupe deferred | Real GitHub + Jenkins production webhooks; CircleCI mocked | All 5 providers (GitHub, Jenkins, CircleCI, GitLab, Buildkite) production |
| 2 | **Masking** | Mask Policy v1 with AWS/GCP/GitHub/generic patterns; deny-on-fail | + Datadog/Stripe/Cloudflare/Slack/OpenAI/Twilio/Algolia (IMP-016); shadow telemetry on false-positives | + customer-custom mask rules via admin UI; ML-augmented entropy detection |
| 3 | **RCA** | 12-class classifier with seeded gold set N=250; rule fallback `rca_fallback_v1`; explainability snippet | Live pilot data; continuous drift detection (IMP-009); slice-weighted reporting | Continuous eval-set augmentation; per-tenant fine-tune option at Strategic tier |
| 4 | **Repair plan** | Structured JSON schema v1; blast-radius + rollback fields; alternatives if confidence <0.85 | Repo-aware suggestions (uses repo structure); plan templating per language/framework | PR-safe automation: plan can open draft PR on user's behalf (still requires HITL approval); test-suite-aware planning |
| 5 | **HITL approval** | Signed approval with HMAC + operator_id + plan_hash + justification ≥20 chars; in-app notify only | Slack DM + email integration (IMP-011); Jira integration; OOO delegation (RC-010) | Dual-approval (US-028); security-approver role (US-029, RC-030); delegation chains; Microsoft Teams |
| 6 | **Evidence pack** | Signed ZIP with manifest + masked artifacts + RCA + plan + approval + eval pins; offline HMAC verifiable | Export ZIP UI with filters; scheduled exports; CSV companion | Retention/legal-hold pack; per-tenant signing-key separation; auditor-direct API |
| 7 | **PromptOps** | Version registry in Git; manual promotion via API-010; EVAL-001/002 gates blocking in CI | Eval-gated promotion enforced; canary 5%/24h; manual rollback ≤30s | Auto-rollback on canary divergence; multi-prompt-family canaries; per-tenant prompt overrides |
| 8 | **Drift detection** | Not in MVP | PSI > 0.2 alerts; chi-square on output distribution (IMP-009, RC-020) | Continuous drift; per-slice drift; automatic eval-set augmentation triggers |
| 9 | **Multi-tenancy** | Postgres RLS on every tenant-scoped table; per-tenant DEK for `tenant_secrets`; quarterly pen-test scheduled | RLS hardening (IMP-020); RBAC matrix sweep CI test (TEST-014-A) | External pen-test report (RC-006 closure); SOC 2 Type II audit |
| 10 | **EU data residency** | Not in MVP — US-east-1 only | Roadmap pre-sell only | Per-tenant `region` flag with eu-west-1 deploy (IMP-021); production prod-eu environment |
| 11 | **RBAC** | 6 base roles (viewer, intake_user, analyst, approver, auditor, tenant_admin); deny-by-default | + security_approver, dual_prod_approver, ai_lead, platform_eng (10 total) | SAML/SCIM SSO; per-tenant custom roles |
| 12 | **Cost controls** | Per-tenant LLM call metering; cost dashboard tile | Soft ceiling alert at 80%, hard throttle at 100% (IMP-017, RC-024) | FinOps board with cost-per-incident, cost-per-evidence-pack |
| 13 | **Observability** | OTel spans on critical path; Prometheus metrics; Grafana SLO dashboard | Full alert pack (12 alerts per ObservabilityPack §5); synthetic probes every 5 min | Customer-facing SLO portal; per-tenant dashboards |
| 14 | **On-call** | Best-effort; PM serves as L1 during demo period | Two-tier on-call (platform pod + AI pod); PagerDuty rotation (IMP-019, RC-029) | 24/7 follow-the-sun; quarterly chaos game day (IMP-015) |
| 15 | **DR / multi-region** | Single-region us-east-1; daily Postgres backups | Active-passive DR to us-west-2; RPO ≤5min; quarterly drill | Active-active multi-region; per-tenant region pinning; cross-region replication |
| 16 | **Analytics dashboard** | 5 KPI tiles (MTTR / debug effort / flaky / evidence completeness / approval cycle); 30/60/90 windows | Per-team filter; CSV export; drill-through | Per-customer QBR pack auto-gen (IMP-024); customer-self-serve analytics API |
| 17 | **i18n** | English only | English + per-locale date/number formatting | Spanish + Japanese (Phase 4 end) |
| 18 | **Accessibility** | WCAG 2.1 AA baseline (keyboard, ARIA-live, contrast) | Axe automated CI test; manual screen-reader pass | EN 301 549 audit; WCAG 2.2 AA |
| 19 | **Demo determinism** | `seeds/acmepilot.sql` for golden path; 3 dry-runs; fallback video (IMP-018, RC-017) | Public demo tenant available for prospects | Pre-prod customer-cloning for demo prep |
| 20 | **Audit-export schema** | v1 published at `/docs/schemas/audit_export.schema.v1.json`; JSON Schema 2020-12 valid | Versioned + deprecation policy (IMP-025, RC-015); 6-month migration window | Schema co-design with customer GRC tools |

---

## 2. What's Hard-OUT of Hackathon MVP

These are explicitly **not** in the 36-hour cut, even if mentioned in BRD/MasterMatrix:

| # | Capability | Why out | When in |
|---|---|---|---|
| O-1 | Auto-merging PRs | Violates BR-005 explicit prohibition | Never |
| O-2 | GitLab + Bitbucket repo linking | Time | Pilot Phase 4 |
| O-3 | On-prem deployment | Infra | Phase 5 only |
| O-4 | Fine-tuned proprietary model | Cost + complexity | Phase 5 Strategic tier |
| O-5 | Customer gold-set ingestion UI | Out of scope | Pilot |
| O-6 | SAML/SCIM | Time | Phase 4 |
| O-7 | EU data residency | Infra | Phase 4 mid (IMP-021) |
| O-8 | Auto-rollback for prompts | Risk | Pilot Phase 4 |
| O-9 | Multi-region active-active | Infra | Enterprise tier |
| O-10 | Dual-approval workflows | Risk surface in MVP | Pilot Phase 4 |
| O-11 | Replay/regression harness in CI | Complexity | Phase 3 (IMP-014) |
| O-12 | Chaos test pack | Time | Phase 4 (IMP-015) |
| O-13 | Cost ceiling hard-throttle | Risk | Phase 4 (IMP-017) |
| O-14 | OOO approval delegation | Complexity | Phase 4 (RC-010) |
| O-15 | Spanish / Japanese locales | Time | Phase 4 end |

---

## 3. Hackathon MVP Acceptance Criteria (Demo-Day Pass)

The MVP ships when the following are simultaneously true. Each row corresponds to a hard exit gate:

| ID | Gate | Owner | Verification |
|---|---|---|---|
| MVP-G1 | Demo golden path runs end-to-end in ≤5 minutes without intervention | PM | 3 successful dry runs T-24h |
| MVP-G2 | Mask Policy v1 zero leaks on red-team N=500 | Sec Lead | TEST-023 green |
| MVP-G3 | EVAL-001 ≥85% on holdout gold set | AI Lead | TEST-008 green |
| MVP-G4 | EVAL-002 ≥80% on holdout gold set | AI Lead | TEST-011 green |
| MVP-G5 | All 14 P0 user stories pass acceptance | PM | manual sweep |
| MVP-G6 | Evidence pack downloads, HMAC verifies offline | BE Lead | TEST-018, TEST-019 |
| MVP-G7 | Cross-tenant RLS chaos test fails as expected | Sec Lead | TEST-013-A pass |
| MVP-G8 | EVAL gate blocks promotion on red eval (TEST-025) | AI Lead | CI run green |
| MVP-G9 | All Critical/High RC items closed or have explicit P1-end target | PM | RC register review |
| MVP-G10 | Fallback video recorded and accessible | PM | demo dry-run |

ALL 10 gates must be green for MVP ship. Missing any one → escalate; if not green by T-2h → switch to fallback video for demo.

---

## 4. Build Sequencing Hard Lock (36 hours)

| Hour | Workstream A: Backend (2 eng) | Workstream B: Frontend (1 eng) | Workstream C: AI/Eval (1 eng) |
|---|---|---|---|
| 0–4 | DB schema, RLS, Mask Policy v1 module | Project scaffold, design tokens, layout | EVAL-001/002 harness setup |
| 4–8 | API-001 intake, idempotency middleware | SCR-001 wireframe | Gold-set seeding N=250 |
| 8–12 | API-002 repo linking; API-003 RCA pipeline | SCR-002, SCR-003 wireframes | Prompt PR-RCA-002 author + first eval run |
| 12–16 | API-004 plan; API-005 approval signature | SCR-004 plan UI | EVAL-001 first pass; iterate prompts |
| 16–20 | API-006 evidence ZIP signer | SCR-005 approval flow | EVAL-002 first pass |
| 20–24 | API-007 analytics; API-008 audit export | SCR-006 evidence export UI | EVAL gates wired into CI |
| 24–28 | API-009 admin; API-010 prompt promote | SCR-007 analytics dashboard | EVAL gates green; gold-set finalized |
| 28–32 | Integration testing; demo seed data | UI polish; mobile breakpoints | Demo dry-run #1 |
| 32–36 | Bug-fix; demo dry-runs #2 and #3 | Bug-fix; accessibility pass | Demo dry-run support; fallback video |

**Critical-path locks (any slip = demo risk):**
- Mask Policy v1 must be done by hour 4
- EVAL gates green by hour 24
- Demo dry-run #1 must complete by hour 28
- ALL changes after hour 32 require PM sign-off

---

## 5. Tier-by-Tier ACV Impact

The MVP itself doesn't sell to Enterprise — it sells the **vision**. ACV tier is gated on capability availability:

| Tier | ACV | MVP gates pilot? | Pilot gates Enterprise? |
|---|---|---|---|
| Pilot ($48K) | $48K | Yes — MVP-G1..10 | n/a |
| Team ($156K) | $156K | Yes + multi-repo + Slack | n/a |
| Enterprise ($412K) | $412K | n/a | Pilot + SCIM + EU residency + dual-approval |
| Strategic ($890K+) | $890K+ | n/a | Enterprise + on-prem option + custom gold set |

The hackathon demo proves Pilot tier shippability. Conversion to Team/Enterprise/Strategic requires Phase 4 deliverables.

---

## 6. Exception Process

Any in-flight scope change during the 36 hours must:

1. Be raised in the team chat with `#mvp-exception` tag
2. Include: capability, justification, impact on demo, fallback plan
3. Be approved by VPE AND PM jointly
4. Be logged in `mvp_lock_exceptions.md` with timestamp

No exception is allowed after hour 32. After hour 32, only bug-fixes to in-scope MVP features are permitted.

---

## 7. Post-Demo Posture

If MVP ships green: lock the artifact, snapshot the demo build, hand to Phase 4 team as `mvp-snapshot-20260517` tag.

If MVP doesn't ship green: switch to fallback video for demo; in the post-mortem, identify which gate failed, attribute to a specific scope decision, feed back to the next hackathon's planning.

The MVP Build Lock document itself is preserved indefinitely as a reference artifact for future builds.
