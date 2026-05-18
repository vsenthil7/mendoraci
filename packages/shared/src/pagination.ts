import { z } from 'zod';

/**
 * Shared cursor-pagination contract for all CP-9 list endpoints.
 *
 * Cursor design: opaque base64-encoded `<ISO-8601 created_at>|<uuid>` so the
 * server can deterministically resume after the last row WITHOUT relying on
 * client-supplied offsets (offsets break under concurrent writes and let a
 * malicious client scan ranges they shouldn't). Cursors are tenant-scoped
 * via RLS automatically; a cursor from tenant A is meaningless to tenant B.
 *
 * Every list response is shaped identically:
 *   { items: T[], next_cursor: string | null, total_approx?: number }
 *
 * `next_cursor: null` means "this was the last page".
 * `total_approx` is optional best-effort (count(*) capped at 10_000 for perf).
 */

export const PaginationQueryV1 = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    cursor: z.string().optional(),
  })
  .strict();
export type PaginationQuery = z.infer<typeof PaginationQueryV1>;

export interface CursorShape {
  /** ISO 8601 timestamp of the last row's created_at */
  ts: string;
  /** Last row's primary key uuid - tiebreaker for identical timestamps */
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
  from: z.string().optional(), // ISO 8601 lower bound on created_at
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
  // Roll-ups (per-row LATERAL joins; cheap because each is at most 1 row)
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
  q: z.string().max(200).optional(), // free-text on root_cause
  from: z.string().optional(),
  to: z.string().optional(),
});
export type RcaListQuery = z.infer<typeof RcaListQueryV1>;

export const RcaListRowV1 = z.object({
  rca_finding_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  // Intake context joined for the list view (so user sees what this RCA
  // is attached to without a separate detail click)
  intake_provider: z.string(),
  intake_run_id: z.string(),
  intake_branch: z.string().nullable(),
  provider: z.string(), // RCA provider (bob | mock-bob)
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
