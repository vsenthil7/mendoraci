import { z } from 'zod';

/**
 * MendoraCI shared schemas — Approval workflow (RT-005).
 * Anchored to docs/MendoraCI_APIContractSpec.md (API-006..API-008) and
 * docs/MendoraCI_DataModelERD.md (DB-009 approvals).
 *
 * State machine on repair_plans.status:
 *
 *   draft  --submit-->  submitted
 *                          |--approve--> approved (terminal)
 *                          |--reject---> rejected (terminal)
 *
 * Allowed only-once transitions; an already-approved plan cannot be re-submitted
 * or re-approved (409 invalid_transition). Each transition writes a row to
 * `approvals` for an immutable audit trail.
 */

export const ApprovalStatusEnum = z.enum(['draft', 'submitted', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const ApprovalActionEnum = z.enum(['submit', 'approve', 'reject']);
export type ApprovalAction = z.infer<typeof ApprovalActionEnum>;

// Per-step ack (CP-7 minimal: optional list of approved/rejected step_ids).
export const StepDecisionV1 = z.object({
  step_id: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().max(2048).optional(),
});
export type StepDecision = z.infer<typeof StepDecisionV1>;

// API-006 POST /v1/repair-plan/:id/submit
export const SubmitRequestV1 = z
  .object({
    note: z.string().max(2048).optional(),
  })
  .strict();
export type SubmitRequest = z.infer<typeof SubmitRequestV1>;

// API-007 POST /v1/repair-plan/:id/approve
export const ApproveRequestV1 = z
  .object({
    approver: z.string().min(1).max(128),
    note: z.string().max(2048).optional(),
    step_decisions: z.array(StepDecisionV1).max(20).optional(),
  })
  .strict();
export type ApproveRequest = z.infer<typeof ApproveRequestV1>;

// API-008 POST /v1/repair-plan/:id/reject
export const RejectRequestV1 = z
  .object({
    approver: z.string().min(1).max(128),
    reason: z.string().min(1).max(2048),
    step_decisions: z.array(StepDecisionV1).max(20).optional(),
  })
  .strict();
export type RejectRequest = z.infer<typeof RejectRequestV1>;

// Common response for all three transition endpoints.
export const ApprovalTransitionResponseV1 = z.object({
  repair_plan_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  prior_status: ApprovalStatusEnum,
  new_status: ApprovalStatusEnum,
  approval_id: z.string().uuid(),
  action: ApprovalActionEnum,
  actor: z.string(),
  created_at: z.string(),
});
export type ApprovalTransitionResponse = z.infer<typeof ApprovalTransitionResponseV1>;

// GET /v1/repair-plan/:id/approvals — full audit history
export const ApprovalLogEntryV1 = z.object({
  approval_id: z.string().uuid(),
  repair_plan_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  action: ApprovalActionEnum,
  prior_status: ApprovalStatusEnum,
  new_status: ApprovalStatusEnum,
  actor: z.string(),
  note: z.string().nullable(),
  step_decisions: z.array(StepDecisionV1),
  created_at: z.string(),
});
export type ApprovalLogEntry = z.infer<typeof ApprovalLogEntryV1>;

export const ApprovalLogV1 = z.object({
  repair_plan_id: z.string().uuid(),
  intake_id: z.string().uuid(),
  current_status: ApprovalStatusEnum,
  entries: z.array(ApprovalLogEntryV1),
});
export type ApprovalLog = z.infer<typeof ApprovalLogV1>;
