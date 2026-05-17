import { z } from 'zod';

/**
 * MendoraCI shared schemas — Root-Cause Analysis (RT-003).
 * Anchored to docs/MendoraCI_APIContractSpec.md (API-004) and
 * docs/MendoraCI_DataModelERD.md (DB-005 rca_findings, DB-006 rca_evidence).
 *
 * The structured RCA output Bob returns is parsed against `RcaModelOutputV1`.
 * The HTTP response wraps that with persisted metadata (rca_finding_id, ids).
 */

export const RcaConfidenceEnum = z.enum(['low', 'medium', 'high']);
export type RcaConfidence = z.infer<typeof RcaConfidenceEnum>;

/** What Bob is asked to return as strict JSON. */
export const RcaModelOutputV1 = z.object({
  root_cause: z.string().min(1).max(2048),
  confidence: RcaConfidenceEnum,
  evidence_snippets: z.array(z.string().min(1).max(1024)).min(1).max(8),
  recommended_actions: z.array(z.string().min(1).max(1024)).min(1).max(8),
});
export type RcaModelOutput = z.infer<typeof RcaModelOutputV1>;

/** API-004 POST /v1/intake/:id/rca — request (no body required; intake_id in path). */
export const RcaRequestV1 = z
  .object({
    // Optional override of mode (lets us swap chat-mode for cost/latency tuning).
    chat_mode: z.enum(['plan', 'code', 'advanced', 'ask']).optional(),
  })
  .strict();
export type RcaRequest = z.infer<typeof RcaRequestV1>;

/** API-004 response shape (201). */
export const RcaResponseV1 = z.object({
  rca_finding_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  provider: z.enum(['bob', 'mock-bob']),
  model_id: z.string(),
  output: RcaModelOutputV1,
  bob_latency_ms: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type RcaResponse = z.infer<typeof RcaResponseV1>;

/** GET /v1/intake/:id/rca — detail (200). */
export const RcaDetailV1 = RcaResponseV1.extend({
  evidence: z.array(
    z.object({
      evidence_id: z.string().uuid(),
      snippet: z.string(),
      source: z.enum(['masked_log', 'commit_message', 'commit_diff']),
      rank: z.number().int().nonnegative(),
    }),
  ),
});
export type RcaDetail = z.infer<typeof RcaDetailV1>;
