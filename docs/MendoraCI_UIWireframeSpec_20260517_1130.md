# MendoraCI_UIWireframeSpec_20260517_1130

**Document Type:** UI Wireframe Specification (SCR-001..SCR-007)
**Version:** 2026-05-17 11:30 DEEP

---

## Cross-cutting standards

- **Framework:** Next.js 14 (App Router) + Tailwind + shadcn/ui + Lucide icons
- **Type system:** TypeScript strict; Zod schemas mirror API contracts
- **Accessibility:** WCAG 2.1 AA. All interactive elements keyboard-operable; ARIA-live for async status; color-contrast ≥ 4.5:1; color is never the sole channel for status
- **Mobile breakpoints:** ≥ 1280 desktop (canonical), 768 tablet, 480 mobile. SCR-001/003/004 collapse to single-column at < 1024
- **i18n:** all copy externalised to `/locales/{en,es,ja}.json` (es/ja Phase 4); `Intl.DateTimeFormat` + `Intl.NumberFormat`; date/number always show tenant-default TZ with UTC tooltip
- **Empty / loading / error states:** every screen specifies all three explicitly; no spinner without timeout fallback (10s → error)
- **Telemetry:** every interactive element emits `ui.event` with `event_name`, `screen_id`, `tenant_id`, `user_id`

---

## SCR-001 — CI Log Intake

**Layout:** 3-column. Left rail (240px): tenant + repo selector, intake-source tabs (Webhook URL / Direct Upload / JUnit XML). Center: intake history table. Right drawer (480px, slide-in): selected-row detail with masked-artifact viewer.

**Components & states:**

| Component | States | Transitions |
|---|---|---|
| Drop-zone | `idle`, `dragover`, `uploading` (progress bar), `masking` (spinner), `masked-preview`, `submitted`, `error` | drag → dragover → drop → uploading → masking → submitted |
| Intake row badge | `received` → `masking` → `masked` → `classifying` → `rca-done` → `plan-ready` → `awaiting-approval` → `approved` / `rejected` → `exported` | linear, with `error` branch from any state |
| Webhook URL panel | `hidden` (non-admin), `visible` with copy-to-clipboard + auto-rotate CTA | requires `tenant_admin` role |

**Validations:**
- `> 50 MB` → "Artifact exceeds 50 MB limit. Split your archive or contact support." (413)
- unsupported MIME → "Only .log, .txt, .xml, .zip accepted."
- mask engine failure → red banner: "We could not safely mask secrets in this artifact. Submission blocked. Engineering notified." (no retry button; intentional)

**Accessibility:** drop-zone has visible focus ring and accepts `Enter` to open file picker; ARIA-live=polite on intake row status changes.

**Mobile:** intake table collapses to cards <768px; drop-zone hidden <480px (replaced with "Upload via desktop" link).

---

## SCR-002 — Repository Linking

**Layout:** single-column with linked-repos list (status pills) + primary CTA "Link via GitHub OAuth" + secondary "Link via PAT (advanced)".

**States:** `unlinked` → `linking` → `linked` → `re-auth-required` → `revoked` → `archived`

**Validations:**
- OAuth `state` mismatch → "Authorization could not be completed. Please retry." + security event log
- PAT scope insufficient → "Token missing required scopes: contents:read, actions:read, checks:read, pull_requests:read"
- Org SSO required → "Your organization requires SAML SSO. [Request bypass token]."

---

## SCR-003 — Root Cause Analysis

**Layout:** 2-column. Left (60%): masked-artifact viewer (Monaco editor, read-only, line numbers). Right (40%): RCA card.

**RCA card content:**
- Class chip (large, color-coded by class) + confidence chip
- Top-3 alternatives accordion with probabilities
- Explainability snippet: "Pattern X matched on lines 142–158" with click-to-highlight in viewer
- Pinned metadata: prompt_version, model_id, gold_set_version, mask_policy_version
- "Generate Repair Plan" primary CTA (disabled when confidence < 0.70)

**Sub-threshold banner (amber):** "Confidence below threshold (0.62 < 0.70). Please confirm class before proceeding." + class-override dropdown + justification textarea (≥ 20 chars).

---

## SCR-004 — Repair Planning

**Layout:** plan card with hypothesis header, ordered typed-step list, alternatives accordion, "Edit plan" + "Send for Approval" CTAs.

**Step display:** numbered chip + step_type icon + body text + blast-radius badge (green/amber/red) + rollback-note collapsed.

**Validations:**
- plan JSON Schema invalid → fallback to manual-plan form with same fields
- plan touches `main` or `prod` → red banner + forces dual-approval (`required_approver_role = dual`)
- plan suggests secret rotation → forces `security_approver` role

---

## SCR-005 — Approval Workflow

**Layout:** centered single-column (max-width 720px), reads top-to-bottom.

**Sections (in order):**
1. **Identity strip** — "You are signing as Lin Park, security_approver" (avatar + role badge)
2. **Plan summary** — read-only card mirroring SCR-004
3. **Plan-hash readout** — monospace, with "Plan was edited" banner if drift detected
4. **Justification textarea** — min 20 chars, live counter, helper text on focus
5. **Approve / Reject buttons** — large, full-width on mobile; Approve disabled until justification ≥ 20 chars
6. **Prior action audit trail** — below the fold; shows previous approval attempts on same plan

**Validations:** justification < 20 → button disabled; plan_hash drift → invalidate token, reload with banner; approver role mismatch → "Required role: security_approver"; token expired (4h) → 410 with "Request new approval link" CTA.

---

## SCR-006 — Evidence Export

**Layout:** 2-section. Top: filter pane + preview + "Export Evidence Pack" CTA. Bottom: prior exports table with status (queued / signing / ready / failed / expired) and download links.

**Filter pane:** date range, repo multi-select, incident status checkbox group.

**States (export job):** `queued` → `collecting` (progress with item count) → `signing` → `ready` → `expired` (30 days; signed URL rolls then).

**Validations:** empty filter → button disabled; cross-tenant attempt → 403 + audit log; > 100 MB → toast "Export will be split into archives; manifest links them"; signing key down → toast "Signing temporarily unavailable" + on-call paged.

---

## SCR-007 — Analytics Dashboard

**Layout:** top: 5 KPI tiles in horizontal row. Below each tile: trend strip (30/60/90 sparkline). Below tiles: filter bar (window, repo, team) + drill-through incident list. Admin tab (tenant_admin only): cost-ceiling + prompt-promotion + EVAL drift status.

**KPI tiles (5):** MTTR, debugging effort, flaky recurrence, evidence completeness, approval cycle.

**Tile content:** current value (large), baseline value (small), Δ% (green/red), trend sparkline, data freshness ("Updated 12 min ago").

**Validations:** sparse data (< 10 incidents) → tile shows "Insufficient data; ≥ 10 incidents required."; stale > 60 min → alert + tile shows "Data stale" warning.

**CSV export:** schema-stable header row; Phase 3 deliverable.

---

## Component library

All screens use the same: `Button` (primary/secondary/destructive), `Card`, `Badge` (status), `Chip` (class/confidence), `Toast`, `Modal`, `Drawer`, `Tabs`, `Table`, `Input`, `Textarea` (with counter), `Select`, `DatePicker`. All shadcn/ui-based, themed via `theme.ts` (no inline color values).

---

## Demo-mode seed states

For SCR-001..007, `?demo=true` flag loads `seeds/acmepilot.sql` state:
- 1 tenant "AcmePilot", 1 repo linked, 7-day intake history with mixed classes
- SCR-001 row pre-populated for `jenkins_oom_failure.log`
- SCR-007 shows MTTR 4.2h → 1.6h trajectory over 30 days
