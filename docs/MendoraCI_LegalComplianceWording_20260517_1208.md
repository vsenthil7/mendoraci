# MendoraCI_LegalComplianceWording_20260517_1208

**Document Type:** Legal & Compliance Wording Standard (Delta to 1130 BRD §11 + ExecutiveSummary + MasterMatrix)
**Version:** 2026-05-17 12:08 ENTERPRISE
**Closes:** ChatGPT review Fix 5 — "Legal/compliance claims need safer wording"
**Authority:** Mendora Legal + DPO (pending external counsel review pre-pilot)
**Status:** AUTHORITATIVE for all buyer-facing material

---

## 0. Why This Document Exists

The 1130 docs use phrases like "EU AI Act Article 12 compliance" and "SOC 2 controls met" in places where, strictly, MendoraCI **supports customer alignment** with these frameworks rather than **guaranteeing compliance** for the customer's overall AI use. Compliance is a property of the customer's full system, not of a single vendor tool.

ChatGPT correctly flagged that buyer-facing material (sales decks, contracts, public docs) needs reframing. This document gives the canonical replacements and the rationale, so the build team, sales team, and marketing don't drift back to risky absolutes.

This is **not** an admission that MendoraCI's controls are weaker than described. It is precision in how we describe them, which is a buyer-trust improvement.

---

## 1. Canonical Replacements

### 1.1 EU AI Act references

| ❌ Avoid | ✅ Use |
|---|---|
| "MendoraCI is EU AI Act compliant." | "MendoraCI provides controls — including automatic logging, human oversight workflows, and tech-doc retention — designed to support customer alignment with EU AI Act Articles 12, 14, and 18, subject to the customer's own legal review and use-context risk classification." |
| "Article 12 compliance built in." | "Article 12 alignment support: every AI inference run is automatically logged with prompt version, model id, gold set version, and mask policy version. Customers retain immutable logs for 10 years." |
| "Article 14 enforced." | "Article 14 alignment support: every AI output requires human approval before any action is taken. No model output auto-applies. Approver identity, role, and justification are recorded with cryptographic signature." |
| "Article 18 satisfied." | "Article 18 alignment support: tech-doc retention via signed evidence packs with 10-year cold-storage retention and offline cryptographic verification. Final compliance determination depends on the customer's classification of their AI system risk tier." |

### 1.2 SOC 2 references

| ❌ Avoid | ✅ Use |
|---|---|
| "SOC 2 compliant." | "Operating to controls aligned with SOC 2 Trust Service Criteria. SOC 2 Type II audit targeted for Phase 4 end (current pre-pilot status: internal-controls-mapped, external audit not yet conducted)." |
| "SOC 2 CC7.2 met." | "CC7.2 alignment: continuous monitoring with OpenTelemetry instrumentation, Prometheus metrics, and 12 production alerts. Final attestation requires SOC 2 Type II audit (Phase 4)." |
| "SOC 2 certified." | "Operating to SOC 2-aligned controls; Type II audit in progress / planned." |

### 1.3 ISO references

| ❌ Avoid | ✅ Use |
|---|---|
| "ISO 27001 certified." | "Operating to ISO 27001-aligned controls. Formal certification targeted for Phase 5; current pre-pilot status uses internal mapping to Annex A controls." |
| "ISO 42001 compliant." | "Aligned to ISO 42001 AI Management System Standard sections §6.1.3 (AI risk assessment), §7.4 (competence), §8.2 (operational planning), §8.4 (data governance), with documentation evidencing each. Formal certification deferred to Phase 5." |

### 1.4 GDPR references

| ❌ Avoid | ✅ Use |
|---|---|
| "GDPR compliant." | "GDPR-aligned data processing: personal-data minimization via mask policy v1, lawful-basis documentation per tenant, right-to-erasure honored via in-place PII anonymization, with DPA available for signature." |
| "GDPR Article 17 erasure satisfied." | "Article 17 alignment: customer-initiated erasure requests for personal data are honored within 30 days via PII anonymization on append-only audit records, preserving regulatory tech-doc trail per Recital 65." |

### 1.5 General compliance language

| ❌ Avoid | ✅ Use |
|---|---|
| "Compliant by design." | "Designed to support customer compliance programs through evidence, logging, and retention controls." |
| "Pre-certified." | "Pre-aligned to industry standards; final certification timing per Phase 4/5 roadmap." |
| "Audit-ready out of the box." | "Audit-evidence-ready: signed evidence packs and immutable logs reduce customer audit prep time, subject to customer's audit scope and auditor requirements." |
| "Zero compliance risk." | (Avoid entirely — no honest vendor can claim this.) |

---

## 2. Patches To Apply To 1130 Documents

These are the specific edits the build team should apply before any buyer-facing release. The 1130 docs as-shipped use earlier compliance language in 7 places.

### Patch 1 — BRD §11 (Compliance & Governance Mapping)
**1130 text:**
> Section 11 maps controls to EU AI Act Articles 12/14/18, SOC 2 CC7.x and CC8.x, and ISO 27001/42001.

**Replace with:**
> Section 11 maps MendoraCI controls to the requirements of EU AI Act Articles 12/14/18, SOC 2 Trust Service Criteria CC7.x and CC8.x, and ISO 27001/42001. These mappings document **alignment support** that MendoraCI provides to customers, helping reduce their compliance program burden. Final compliance determination depends on each customer's full AI system, use-context risk classification, and legal review.

### Patch 2 — BRD §11.1 (EU AI Act Mapping table header)
**1130 table title:** "EU AI Act compliance"
**Replace with:** "EU AI Act alignment support"
Column "Compliance status" → "Alignment evidence"
Cell "Met" → "Evidence provided" (everywhere)

### Patch 3 — ExecutiveSummary §2 (Value Proposition bullet)
**1130 text:**
> "Built for EU AI Act compliance and SOC 2 audit readiness from day one."

**Replace with:**
> "Designed with EU AI Act alignment support and SOC 2-aligned controls from day one — reducing customer audit prep through evidence, logging, and retention."

### Patch 4 — MasterMatrix Capability "Compliance"
**1130 column "Pilot tier":** "EU AI Act Art 12/14/18 compliant"
**Replace with:** "EU AI Act Art 12/14/18 alignment support; customer legal review required"

### Patch 5 — Claude Annex §6 (Governance & Compliance Position)
**1130 bullet:** "MendoraCI is positioned as a compliance-ready platform for AI-augmented engineering."
**Replace with:** "MendoraCI is positioned as a governance-rich platform that materially reduces customer compliance burden for AI-augmented engineering. Compliance is a property of the customer's full system; MendoraCI provides the artifact trail and controls customers need to align with applicable frameworks."

### Patch 6 — Demo Script closing slide
**1130 closing line:** "Audit-ready evidence in one click. EU AI Act compliant."
**Replace with:** "Audit-evidence-ready in one click. EU AI Act alignment support, designed for customer legal review."

### Patch 7 — Glossary entry "Compliance"
**Add new entry to 1130 Glossary:**
> **Compliance (in MendoraCI context):** A property of a customer's overall AI system, not of a single vendor tool. MendoraCI provides controls (logging, evidence, retention, oversight) that support customer compliance with applicable frameworks. The customer remains responsible for final compliance determination under their legal advice.

---

## 3. Standard Disclaimer Block (Footer Standard)

Insert this into every buyer-facing document, pitch deck, and contract package:

```
─────────────────────────────────────────────────────────────────────
COMPLIANCE NOTICE
MendoraCI provides controls — including logging, evidence retention,
human oversight, and cryptographic signing — designed to support
customer alignment with AI governance frameworks (EU AI Act, GDPR,
SOC 2, ISO 27001, ISO 42001).

These controls do not, on their own, constitute customer compliance.
Final compliance determination depends on the customer's full system,
use-context risk classification, and legal review. Mendora recommends
customers conduct their own legal and risk review of their MendoraCI
usage before relying on it for compliance evidence.

For SOC 2 Type II audit reports, ISO certifications, or DPAs,
contact legal@mendoraci.com.
─────────────────────────────────────────────────────────────────────
```

This block is mandatory on: pitch decks, BRD §11, ExecutiveSummary, Claude Annex, public website, all customer-facing contracts.

This block is optional on: internal engineering docs, RFCs, post-mortems, internal slide decks.

---

## 4. What MendoraCI Still Says Confidently

The reframing does NOT mean MendoraCI walks back its controls. The following statements are still made with full confidence:

✅ "Every AI inference is automatically logged with prompt version, model id, gold set version, and mask policy version."
✅ "No model output auto-applies. Every action is human-approved with cryptographic signature."
✅ "10-year retention on signed evidence packs with offline HMAC verification."
✅ "Mask Policy v1 redacts secrets before any AI inference; zero LLM exposure to plaintext credentials."
✅ "Row-level security enforced at the database query layer."
✅ "Per-tenant data encryption at rest and in transit; per-tenant signing keys."
✅ "Quarterly external penetration tests scheduled (current target: Phase 4 end)."
✅ "Eval-gated prompt promotion — no prompt promoted without ≥85% RCA accuracy and ≥80% plan usefulness on holdout gold set."

These are operational statements about what the product does, not legal-status claims. They remain unchanged.

---

## 5. Phase-Tiered Roadmap For Stronger Claims

We don't permanently water down — we earn stronger claims over time.

| Phase | Strongest claim allowed |
|---|---|
| Hackathon MVP | "Alignment support" framing only |
| Pilot (Phase 4 weeks 1-6) | Same; plus "operating to SOC 2-aligned controls" |
| Pilot exit (Phase 4 end) | + "SOC 2 Type II audit in progress / scheduled with [auditor name]" |
| Phase 5 month 3 | + "ISO 27001 certified" (after audit complete) |
| Phase 5 month 6 | + "ISO 42001 attestation" (assuming standard finalization + audit) |
| Phase 5 month 9 | + EU AI Act conformance assessment via Notified Body (where applicable) |

The roadmap is publicly stated; customers can see when each claim graduates from "alignment support" to "certified/attested". This is more credible than blanket compliance claims at MVP.

---

## 6. Sales Enablement — One-Page Cheat Sheet

This card is distributed to every Mendora seller, CSM, and SE:

```
┌────────────────────────────────────────────────────────────────┐
│ MendoraCI Compliance Language — Pocket Card                    │
├────────────────────────────────────────────────────────────────┤
│ When a prospect asks:                                          │
│   "Are you SOC 2 compliant?"                                   │
│ Say:                                                           │
│   "We're operating to SOC 2-aligned controls. Our Type II      │
│    audit is scheduled for [Phase 4 end / specific date].       │
│    I can walk you through our internal controls mapping now;   │
│    we'll send the SOC 2 report when issued."                   │
│                                                                │
│ When a prospect asks:                                          │
│   "Are you EU AI Act compliant?"                               │
│ Say:                                                           │
│   "Compliance for the AI Act is a property of your full        │
│    system, not of any single tool. MendoraCI provides the      │
│    controls you need to align — automatic logging (Art 12),    │
│    human oversight (Art 14), and tech-doc retention (Art 18).  │
│    Your legal team makes the final determination. Want to see  │
│    the evidence pack format we'd ship to your auditor?"        │
│                                                                │
│ When a prospect asks:                                          │
│   "Can you sign our DPA / GDPR addendum?"                      │
│ Say:                                                           │
│   "Yes. Send it to legal@mendoraci.com; we have a standard     │
│    DPA on file we can also send you."                          │
│                                                                │
│ When a prospect asks:                                          │
│   "Where is data stored?"                                      │
│ Say:                                                           │
│   "US-East-1 in the MVP and pilot phases. EU-West-1 data       │
│    residency available at Enterprise tier (Phase 4)."          │
│                                                                │
│ Never say:                                                     │
│   ❌ "We're fully compliant."                                  │
│   ❌ "Zero compliance risk."                                   │
│   ❌ "Pre-certified."                                          │
│   ❌ "Audit-proof."                                            │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Marketing-Copy Audit Checklist

Before any external content publishes (website, blog, sales deck, conference talk), the author runs this checklist:

- [ ] No use of "compliant" without "alignment support" qualifier
- [ ] No use of "certified" unless we hold the certificate
- [ ] No claims of zero risk, perfect protection, or absolute safety
- [ ] No legal advice given to customer (always "subject to customer legal review")
- [ ] Compliance footer block present on customer-facing assets
- [ ] Phase-tier claims match current phase (no premature Phase 5 claims)
- [ ] DPO / Legal sign-off on any new compliance claim

---

## 8. Internal Enforcement

Once this document is ratified:
1. The BRD §11 patches go into the 1130 set at next version bump
2. The footer block is added to all customer-facing slides and decks
3. Mendora Legal owns this document; updates require Legal + DPO approval
4. Sales onboarding includes a 20-minute training on the pocket card
5. Any customer-facing material is reviewed by Legal pre-publish (~24h turnaround)

---

## 9. Note On Why "Alignment Support" Is Actually Better Sales Language

Sophisticated enterprise buyers (the buyers we want) are wary of "fully compliant" vendor claims. They know compliance is a property of their full system and that any vendor over-claiming is shifting liability to them. By saying "alignment support, subject to your legal review", we:

- Match the language their legal team uses
- Show we understand the regulation rather than parroting it
- Build credibility by NOT over-promising
- Make our actual controls (automatic logging, signed evidence, retention) shine because we describe them precisely

The "alignment support" framing wins more enterprise deals than "fully compliant" claims, not fewer.
