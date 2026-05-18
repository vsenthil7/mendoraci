import { z } from 'zod';

/**
 * MendoraCI shared schemas — Repair Plan (RT-004).
 * Anchored to docs/MendoraCI_APIContractSpec.md (API-005) and
 * docs/MendoraCI_DataModelERD.md (DB-007 repair_plans, DB-008 repair_steps).
 *
 * The structured plan Bob returns is parsed against `RepairPlanModelOutputV1`.
 * Each step is small + actionable so it can be reviewed in CP-7 approval flow.
 */

export const RepairRiskEnum = z.enum(['low', 'medium', 'high']);
export type RepairRisk = z.infer<typeof RepairRiskEnum>;

export const RepairEffortEnum = z.enum(['XS', 'S', 'M', 'L', 'XL']);
export type RepairEffort = z.infer<typeof RepairEffortEnum>;

export const RepairStepTypeEnum = z.enum([
  'code-edit',
  'config-change',
  'infra-change',
  'rollback',
  'investigation',
  'dependency-update',
  'test-add',
  'other',
]);
export type RepairStepType = z.infer<typeof RepairStepTypeEnum>;

/** Individual step Bob proposes. */
export const RepairStepModelV1 = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(2048),
  type: RepairStepTypeEnum,
  files: z.array(z.string().min(1).max(512)).max(20).optional(),
  est_effort: RepairEffortEnum,
  risk: RepairRiskEnum,
});
export type RepairStepModel = z.infer<typeof RepairStepModelV1>;

/** What Bob is asked to return as strict JSON. */
export const RepairPlanModelOutputV1 = z.object({
  summary: z.string().min(1).max(2048),
  overall_risk: RepairRiskEnum,
  steps: z.array(RepairStepModelV1).min(1).max(12),
  rollback_strategy: z.string().min(1).max(2048),
  est_total_effort: RepairEffortEnum,
});
export type RepairPlanModelOutput = z.infer<typeof RepairPlanModelOutputV1>;

/** API-005 POST /v1/intake/:id/repair-plan — request. */
export const RepairPlanRequestV1 = z
  .object({
    chat_mode: z.enum(['plan', 'code', 'advanced', 'ask']).optional(),
  })
  .strict();
export type RepairPlanRequest = z.infer<typeof RepairPlanRequestV1>;

export const RepairPlanResponseV1 = z.object({
  repair_plan_id: z.string().uuid(),
  rca_finding_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  provider: z.enum(['bob', 'mock-bob']),
  model_id: z.string(),
  output: RepairPlanModelOutputV1,
  bob_latency_ms: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type RepairPlanResponse = z.infer<typeof RepairPlanResponseV1>;

/** GET /v1/intake/:id/repair-plan — detail (200). */
export const RepairPlanDetailV1 = RepairPlanResponseV1.extend({
  steps: z.array(
    RepairStepModelV1.extend({
      step_id: z.string().uuid(),
      rank: z.number().int().nonnegative(),
    }),
  ),
});
export type RepairPlanDetail = z.infer<typeof RepairPlanDetailV1>;
