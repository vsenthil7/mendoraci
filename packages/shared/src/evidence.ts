import { z } from 'zod';

/**
 * MendoraCI shared schemas — Evidence Export (RT-006).
 * Anchored to docs/MendoraCI_APIContractSpec.md (API-009) and
 * docs/MendoraCI_DataModelERD.md (DB-010 evidence_exports).
 *
 * An "evidence bundle" is a ZIP containing:
 *   - masked log body                  (raw_intake.body_masked)
 *   - rca finding JSON                 (rca_findings + rca_evidence rows)
 *   - repair plan JSON                 (repair_plans + repair_steps rows)
 *   - approvals audit JSON             (all approval rows)
 *   - manifest.json                    (intake_id, sha256 of each file, mask_policy_version)
 *
 * The ZIP is uploaded to MinIO bucket `mendoraci-evidence` under
 * `<tenant_id>/<intake_id>/<evidence_export_id>.zip` and a row is written
 * to DB-010 evidence_exports for retrieval. The 200 response includes a
 * presigned URL (5-minute TTL) and the sha256 of the ZIP for audit chain.
 *
 * Gating: requires repair_plans.status='approved' (412 plan_not_approved
 * otherwise).
 */

export const EvidenceExportRequestV1 = z
  .object({
    // Optional override of bundle TTL in seconds for the presigned URL
    // (default 300, max 3600). Useful so demos can stamp short-lived links.
    presigned_ttl_seconds: z.number().int().min(60).max(3600).optional(),
  })
  .strict();
export type EvidenceExportRequest = z.infer<typeof EvidenceExportRequestV1>;

export const EvidenceExportResponseV1 = z.object({
  evidence_export_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  repair_plan_id: z.string().uuid(),
  s3_key: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  byte_size: z.number().int().nonnegative(),
  presigned_url: z.string().url(),
  presigned_expires_at: z.string(),
  created_at: z.string(),
});
export type EvidenceExportResponse = z.infer<typeof EvidenceExportResponseV1>;

export const EvidenceExportDetailV1 = EvidenceExportResponseV1.extend({
  manifest: z.object({
    intake_id: z.string().uuid(),
    repair_plan_id: z.string().uuid(),
    mask_policy_version: z.string(),
    files: z.array(
      z.object({
        path: z.string(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/i),
        byte_size: z.number().int().nonnegative(),
      }),
    ),
    generated_at: z.string(),
  }),
});
export type EvidenceExportDetail = z.infer<typeof EvidenceExportDetailV1>;
