# MendoraCI_DemoScript_20260517_1130

**Document Type:** Demo Script (5-Minute Golden Path + Fallback Plans)
**Version:** 2026-05-17 11:30 DEEP

---

## 1. Pre-Demo Checklist (T−24h, T−1h, T−5min)

**T−24h:**
- [ ] Deploy demo-build to `demo.mendoraci.com` on canary infra
- [ ] Seed tenant `AcmePilot` via `seeds/acmepilot.sql` (IMP-018) — deterministic
- [ ] Verify all 7 screens load in < 2s
- [ ] Run 3 full dry-runs end-to-end; record timings; investigate any deviation
- [ ] Verify Slack mock and email mock both return successful notifications
- [ ] Verify evidence ZIP downloads and HMAC verifies offline
- [ ] Record fallback video `/demo/golden_path.mp4` (4K, 5min, narrated)
- [ ] Have laptop + tethered phone hotspot + backup laptop ready

**T−1h:**
- [ ] Re-seed `AcmePilot` to fresh deterministic state
- [ ] Run 1 final dry-run; if any deviation → switch to recorded fallback
- [ ] Close all browser tabs except demo
- [ ] Disable OS notifications
- [ ] Set screen resolution 1920×1080
- [ ] Pre-open all 7 screen tabs in correct order

**T−5min:**
- [ ] Hard refresh SCR-001 (clean state)
- [ ] Verify hotspot connected
- [ ] Have backup browser open to fallback video
- [ ] Breathing exercise — slow exhale

---

## 2. Golden Path (5 minutes exact)

### 0:00–0:20 — Setup & framing (20s)

**Say:** "MendoraCI takes a CI failure that today takes 4+ hours to resolve and turns it into a governed, evidence-backed 5-minute workflow. Watch."

**Do:** open SCR-001 with AcmePilot tenant selected. Show the empty intake table.

### 0:20–0:50 — Intake & masking (30s)

**Say:** "I'm dropping a real Jenkins log — 15 MB, mid-pipeline OOM failure. Notice what happens to secrets before anything else."

**Do:** drag-drop `jenkins_oom_failure.log` onto drop-zone. Mask animation runs; visible AKIA_AWS_KEY → `AKIA****`, ghp_GITHUB_PAT → `ghp_****`.

**Say:** "Masking is deterministic and runs before any AI sees the artifact. Red-team verified zero leaks across 500 attempts."

### 0:50–1:30 — RCA card (40s)

**Do:** click new intake row → SCR-003 opens.

**Say:** "Here's the AI root-cause analysis. Class: OOM at 93% confidence. Notice three things." [point to each]

1. **The explainability** — pattern matched on lines 142–158 of the log, clickable
2. **The alternatives** — race condition 6%, timeout 2%
3. **The pinned metadata** — prompt version PR-RCA-002, model, gold-set version. Every inference, fully reproducible.

### 1:30–2:30 — Repair plan (60s)

**Do:** click "Generate Repair Plan" → SCR-004 opens.

**Say:** "The AI doesn't change code. It generates a structured plan." [walk through]

- Hypothesis: "Container memory limit too low for parser workload"
- Step 1: raise container memory 2G → 4G (config-change, medium blast)
- Step 2: investigate suspected leak in `parser.py:421` (code-change, low blast)
- Alternative: enable JVM heap-dump
- Rollback: revert memory limit

**Say:** "Notice — no patches auto-applied. Notice — blast radius and rollback on every step. Notice — required approver role is single, because this doesn't touch prod or rotate a secret."

### 2:30–3:30 — Approval workflow (60s)

**Do:** click "Send for Approval" → switch to Approver browser tab (mocking Slack DM).

**Say:** "The approver gets a Slack DM with a deep-link. Click."

**Do:** click Slack mock → opens SCR-005 with plan summary, identity strip ("Signing as Lin Park, approver"), plan hash, justification textarea.

**Say:** "Three things matter here for auditors."

1. **Identity strip** — named operator, not "service account"
2. **Plan hash** — if anyone edits the plan after this link was sent, the hash drift invalidates the approval
3. **Justification text** — minimum 20 characters, prevents rubber-stamps

**Do:** type "Approved. Memory increase is minimal risk. Will revisit Tuesday." → click Approve & Sign.

**Say:** "Done. That record is append-only, HMAC-signed, and Article 12 evidence-grade."

### 3:30–4:30 — Evidence export (60s)

**Do:** navigate to SCR-006. Filter: "Last 7 days, AcmePilot". Click "Export Evidence Pack."

**Say:** "And this is what the auditor actually wants."

**Do:** progress bar → ZIP downloads. Open in Finder/Explorer.

**Do:** show ZIP contents — `manifest.json`, `intakes/`, `rca/`, `plans/`, `approvals/AP-1.json`, `evals/`, `prompts/`, `signature.hmac`.

**Do:** open `approvals/AP-1.json` — show operator_id, signed_at, justification, plan_hash, hmac_signature.

**Say:** "This whole pack, including the signature, verifies offline. Ten-year retention. EU AI Act Article 12, 14, and 18 — covered."

### 4:30–5:00 — Analytics + close (30s)

**Do:** navigate to SCR-007. Show MTTR tile dropping from 4.2h → 1.6h over 30 days.

**Say:** "And this is what the VP of Engineering sees. MTTR down 60%, debugging effort down 35%, evidence completeness 100%. Three point five million dollars annualized for a 200-developer organization."

**Say:** "That's MendoraCI. Questions?"

---

## 3. Backup Scenarios

If the OOM golden path encounters environmental trouble, switch to one of:

### Scenario B — Flaky test (showcases BR-010)
Seed: `seeds/acmepilot_flaky.sql`. Intake: 5 historical runs of `parser_test.py` showing pass/fail on identical git SHA. RCA classifies as flaky 0.94. Plan: quarantine + Jira ticket assigned to test owner. Approval: single approver. Evidence pack same shape.

### Scenario C — Secret-rotation plan (showcases RC-030, dual approval)
Seed: `seeds/acmepilot_secret.sql`. Intake: failure due to expired GitHub PAT. RCA classifies as secret 0.91. Plan: rotate PAT, update tenant_secrets, restart workers. **Required approver role: security_approver**. Approval flow requires Lin (security_approver) — illustrates separation of duties. Evidence pack shows `required_approver_role: security_approver` in manifest.

---

## 4. Fallback to Recorded Video

**Trigger:** any deviation in dry-run that cannot be diagnosed in 60s, OR live network unreliability, OR LLM provider unreachable.

**Action:** "Let me show you the prerecorded golden path, then I'll come back to live for questions."

**Asset:** `/demo/golden_path.mp4`. 5 minutes exact, same narration as Section 2. Recorded against same `AcmePilot` seed.

**Recovery:** after video plays, if live env is back, do the analytics dashboard portion live (it's just a read).

---

## 5. Q&A Prep (likely questions)

| Question | Bullet-point answer |
|---|---|
| "What if the LLM is wrong?" | EVAL-001 92% promotion; confidence < 0.70 triggers manual review; rules-fallback `rca_fallback_v1` always available |
| "What if there's a security incident with you?" | Per-tenant DEK; pen-tested RLS; mask Policy v1 red-team verified; signed evidence verifiable offline so customer is never trapped |
| "What's your moat?" | Combined surface — governed AI repair × HITL ledger × signed evidence × PromptOps × secret masking. No competitor delivers all five |
| "How is this not just Datadog plus prompts?" | Datadog has zero approval workflow, zero structured repair plans, zero PromptOps governance, zero incident-bound signed evidence packs |
| "How much?" | $48K pilot, $156K team, $412K enterprise, $890K+ strategic. Versus $3.5M annualized recapture for a 200-dev org. 8×–22× ROI |
| "EU AI Act?" | Article 12 logging, 14 oversight, 18 retention — all mapped; EU residency in Phase 4 (IMP-021) |
| "Why MendoraCI not Forgewright/some-other-name?" | The product name is MendoraCI. (Internal note: Claude has previously hallucinated other names in conversations; correct name is MendoraCI throughout) |
| "What if you go out of business?" | Customer-owned signing keys; evidence packs verifiable offline; export schema documented and versioned; full data export endpoint exists |

---

## 6. Demo-Day Roles

| Role | Person | Responsibility |
|---|---|---|
| Driver | PM | Operates laptop; clicks through screens |
| Narrator | (could be same as Driver, or separate) | Speaks the script |
| Spotter | TL | Watches dashboards in background tab; nods/aborts |
| Backup | AI Lead | Has identical setup; can swap in if Driver's laptop fails |
| Q&A Lead | VPE | Handles follow-up after demo |

---

## 7. Post-Demo

- Capture timing of every section; if any drifted > 10s, update script for next demo
- Note all judge/audience questions in `/demo/feedback.md`
- Within 24h, send judges a follow-up packet: the 13-document deliverable plus a 1-page exec summary
