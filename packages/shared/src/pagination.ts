import { z } from 'zod';

/**
 * Shared cursor-pagination contract for all CP-9 list endpoints.
 *
 * Cursor design: opaque base64-encoded `<ISO-8601 created_at>|<uuid>` so the
 * server can deterministically resume after the last row WITHOUT relying on
 * client-supplied offsets. Cursors are tenant-scoped via RLS.
 */

export const PaginationQueryV1 = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    cursor: z.string().optional(),
  })
  .strict();
export type PaginationQuery = z.infer<typeof PaginationQueryV1>;

export interface CursorShape {
  ts: string;
  id: string;
}

// =============================================================================
// INTAKES list (CP-9.1c)
// =============================================================================

export const IntakesListQueryV1 = PaginationQueryV1.extend({
  has_rca: z.enum(['true', 'false']).optional(),
  has_plan: z.enum(['true', 'false']).optional(),
  plan_status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  has_export: z.enum(['true', 'false']).optional(),
  provider: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type IntakesListQuery = z.infer<typeof IntakesListQueryV1>;

export const IntakeListRowV1 = z.object({
  intake_id: z.string().uuid(),
  provider: z.string(),
  run_id: z.string(),
  attempt_id: z.string(),
  branch: z.string().nullable(),
  commit_sha: z.string().nullable(),
  actor: z.string().nullable(),
  mask_policy_version: z.string(),
  created_at: z.string(),
  has_rca: z.boolean(),
  has_plan: z.boolean(),
  plan_status: z.enum(['draft', 'submitted', 'approved', 'rejected']).nullable(),
  has_export: z.boolean(),
});
export type IntakeListRow = z.infer<typeof IntakeListRowV1>;

export const IntakesListResponseV1 = z.object({
  items: z.array(IntakeListRowV1),
  next_cursor: z.string().nullable(),
  total_approx: z.number().int().nonnegative().optional(),
});
export type IntakesListResponse = z.infer<typeof IntakesListResponseV1>;

// =============================================================================
// RCA FINDINGS list (CP-9.1d)
// =============================================================================

export const RcaListQueryV1 = PaginationQueryV1.extend({
  intake_id: z.string().uuid().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  provider: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type RcaListQuery = z.infer<typeof RcaListQueryV1>;

export const RcaListRowV1 = z.object({
  rca_finding_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  intake_provider: z.string(),
  intake_run_id: z.string(),
  intake_branch: z.string().nullable(),
  provider: z.string(),
  model_id: z.string(),
  root_cause: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence_count: z.number().int().nonnegative(),
  recommended_actions_count: z.number().int().nonnegative(),
  bob_latency_ms: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type RcaListRow = z.infer<typeof RcaListRowV1>;

export const RcaListResponseV1 = z.object({
  items: z.array(RcaListRowV1),
  next_cursor: z.string().nullable(),
  total_approx: z.number().int().nonnegative().optional(),
});
export type RcaListResponse = z.infer<typeof RcaListResponseV1>;

// =============================================================================
// REPAIR PLANS list (CP-9.1e)
// =============================================================================

export const RepairPlansListQueryV1 = PaginationQueryV1.extend({
  intake_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  overall_risk: z.enum(['low', 'medium', 'high']).optional(),
  est_total_effort: z.enum(['XS', 'S', 'M', 'L', 'XL']).optional(),
  provider: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type RepairPlansListQuery = z.infer<typeof RepairPlansListQueryV1>;

export const RepairPlanListRowV1 = z.object({
  repair_plan_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  intake_provider: z.string(),
  intake_run_id: z.string(),
  intake_branch: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  summary: z.string(),
  overall_risk: z.enum(['low', 'medium', 'high']),
  est_total_effort: z.enum(['XS', 'S', 'M', 'L', 'XL']),
  step_count: z.number().int().nonnegative(),
  provider: z.string(),
  model_id: z.string(),
  bob_latency_ms: z.number().int().nonnegative(),
  last_approval_action: z.enum(['submit', 'approve', 'reject']).nullable(),
  last_approval_actor: z.string().nullable(),
  last_approval_at: z.string().nullable(),
  created_at: z.string(),
});
export type RepairPlanListRow = z.infer<typeof RepairPlanListRowV1>;

export const RepairPlansListResponseV1 = z.object({
  items: z.array(RepairPlanListRowV1),
  next_cursor: z.string().nullable(),
  total_approx: z.number().int().nonnegative().optional(),
});
export type RepairPlansListResponse = z.infer<typeof RepairPlansListResponseV1>;

// =============================================================================
// APPROVALS list (CP-9.1f)
// =============================================================================

export const ApprovalsListQueryV1 = PaginationQueryV1.extend({
  repair_plan_id: z.string().uuid().optional(),
  intake_id: z.string().uuid().optional(),
  action: z.enum(['submit', 'approve', 'reject']).optional(),
  actor: z.string().max(128).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ApprovalsListQuery = z.infer<typeof ApprovalsListQueryV1>;

export const ApprovalListRowV1 = z.object({
  approval_id: z.string().uuid(),
  repair_plan_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  // Intake + plan context for display
  intake_provider: z.string(),
  intake_run_id: z.string(),
  plan_summary: z.string(),
  // Audit content
  action: z.enum(['submit', 'approve', 'reject']),
  prior_status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  new_status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  actor: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
});
export type ApprovalListRow = z.infer<typeof ApprovalListRowV1>;

export const ApprovalsListResponseV1 = z.object({
  items: z.array(ApprovalListRowV1),
  next_cursor: z.string().nullable(),
  total_approx: z.number().int().nonnegative().optional(),
});
export type ApprovalsListResponse = z.infer<typeof ApprovalsListResponseV1>;

// =============================================================================
// EVIDENCE EXPORTS list (CP-9.1f)
// =============================================================================

export const EvidenceExportsListQueryV1 = PaginationQueryV1.extend({
  intake_id: z.string().uuid().optional(),
  repair_plan_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type EvidenceExportsListQuery = z.infer<typeof EvidenceExportsListQueryV1>;

export const EvidenceExportListRowV1 = z.object({
  evidence_export_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  repair_plan_id: z.string().uuid(),
  // Intake context for display
  intake_provider: z.string(),
  intake_run_id: z.string(),
  // Export body
  s3_bucket: z.string(),
  s3_key: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  byte_size: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type EvidenceExportListRow = z.infer<typeof EvidenceExportListRowV1>;

export const EvidenceExportsListResponseV1 = z.object({
  items: z.array(EvidenceExportListRowV1),
  next_cursor: z.string().nullable(),
  total_approx: z.number().int().nonnegative().optional(),
});
export type EvidenceExportsListResponse = z.infer<typeof EvidenceExportsListResponseV1>;
