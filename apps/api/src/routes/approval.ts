/**
 * Approval Workflow routes — API-006..API-008.
 *
 * Anchors:
 *   - RT-005 Approval Workflow (BR-005)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant; approvals + repair_plans)
 *   - DB-009 approvals (immutable audit trail)
 *
 * Test anchors (per docs/MendoraCI_Traceability.md RT-005):
 *   TEST-015  draft -> submit -> 200 status submitted, 1 audit row
 *   TEST-016  submitted -> approve -> 200 status approved, 2 audit rows
 *   TEST-017  submitted -> reject -> 200 status rejected, 2 audit rows
 *   TEST-018  invalid transition (approve from draft) -> 409 invalid_transition
 *   TEST-019  cross-tenant -> 404 (RLS on repair_plans / approvals)
 *   NEG x4    invalid uuid 400, missing tenant 401, validation 422, audit log GET
 *
 * Endpoints (all under /v1 prefix):
 *   POST /v1/repair-plan/:id/submit
 *   POST /v1/repair-plan/:id/approve
 *   POST /v1/repair-plan/:id/reject
 *   GET  /v1/repair-plan/:id/approvals    (audit log + current_status)
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  SubmitRequestV1,
  ApproveRequestV1,
  RejectRequestV1,
  ApprovalTransitionResponseV1,
  ApprovalLogV1,
  type ApprovalAction,
  type ApprovalStatus,
} from '@mendoraci/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err(reply: any, status: number, code: string, message: string, extra?: object) {
  return reply
    .code(status)
    .type('application/json')
    .send({ error: { code, message, ...(extra ?? {}) } });
}

function err422Zod(
  reply: any,
  issues: ReadonlyArray<{ path: (string | number)[]; message: string }>,
) {
  return reply.code(422).type('application/json').send({
    error: {
      code: 'validation_failed',
      message: 'request_body_invalid',
      validation_errors: issues.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
        message: String(i.message ?? ''),
      })),
    },
  });
}

/**
 * State machine table. Each row says: from `prior` via `action` go to `next`.
 * Anything not listed is an invalid transition -> 409.
 */
const TRANSITIONS: ReadonlyArray<{
  prior: ApprovalStatus;
  action: ApprovalAction;
  next: ApprovalStatus;
}> = [
  { prior: 'draft', action: 'submit', next: 'submitted' },
  { prior: 'submitted', action: 'approve', next: 'approved' },
  { prior: 'submitted', action: 'reject', next: 'rejected' },
];

function lookupNext(prior: ApprovalStatus, action: ApprovalAction): ApprovalStatus | null {
  return TRANSITIONS.find((t) => t.prior === prior && t.action === action)?.next ?? null;
}

/**
 * Perform a state transition inside a tenant tx. Returns the response envelope
 * or a typed error indicator the route layer maps to HTTP.
 */
async function performTransition(
  app: any,
  args: {
    tenantId: string;
    repairPlanId: string;
    action: ApprovalAction;
    actor: string;
    note: string | null;
    stepDecisions: unknown[];
  },
): Promise<
  | { kind: 'ok'; envelope: any }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; prior: ApprovalStatus }
> {
  return app.withTenant(args.tenantId, async (client: any) => {
    // 1. Read current status under RLS.
    const cur = await client.query<{
      repair_plan_id: string;
      intake_id: string;
      status: ApprovalStatus;
    }>(
      `SELECT repair_plan_id, intake_id, status
         FROM repair_plans
        WHERE repair_plan_id = $1
        LIMIT 1`,
      [args.repairPlanId],
    );
    if (cur.rowCount === 0) return { kind: 'not_found' as const };
    const prior = cur.rows[0]!.status;
    const intakeId = cur.rows[0]!.intake_id;

    const next = lookupNext(prior, args.action);
    if (next === null) {
      return { kind: 'invalid_transition' as const, prior };
    }

    // 2. Insert approval audit row.
    const ins = await client.query<{ approval_id: string; created_at: Date }>(
      `INSERT INTO approvals
         (repair_plan_id, intake_id, tenant_id, action, prior_status, new_status,
          actor, note, step_decisions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING approval_id, created_at`,
      [
        args.repairPlanId,
        intakeId,
        args.tenantId,
        args.action,
        prior,
        next,
        args.actor,
        args.note,
        JSON.stringify(args.stepDecisions ?? []),
      ],
    );
    const approvalId = ins.rows[0]!.approval_id;
    const createdAt = ins.rows[0]!.created_at;

    // 3. Move repair_plans.status forward + pin current_approval_id.
    await client.query(
      `UPDATE repair_plans
          SET status = $1, current_approval_id = $2
        WHERE repair_plan_id = $3`,
      [next, approvalId, args.repairPlanId],
    );

    const envelope = ApprovalTransitionResponseV1.parse({
      repair_plan_id: args.repairPlanId,
      intake_id: intakeId,
      prior_status: prior,
      new_status: next,
      approval_id: approvalId,
      action: args.action,
      actor: args.actor,
      created_at: createdAt.toISOString(),
    });
    return { kind: 'ok' as const, envelope };
  });
}

export const approvalRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // POST /v1/repair-plan/:id/submit
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/repair-plan/:id/submit',
    async (request, reply) => {
      const { id: repairPlanId } = request.params;
      if (!UUID_RE.test(repairPlanId)) {
        return err(reply, 400, 'invalid_repair_plan_id', 'repair_plan_id must be a UUID');
      }

      const parsed = SubmitRequestV1.safeParse(request.body ?? {});
      if (!parsed.success) return err422Zod(reply, parsed.error.issues);

      const result = await performTransition(app, {
        tenantId: request.tenantId,
        repairPlanId,
        action: 'submit',
        actor: 'system',
        note: parsed.data.note ?? null,
        stepDecisions: [],
      });

      if (result.kind === 'not_found') {
        return err(reply, 404, 'repair_plan_not_found', 'no repair plan for this id');
      }
      if (result.kind === 'invalid_transition') {
        return err(
          reply,
          409,
          'invalid_transition',
          `cannot submit a plan currently in status ${result.prior}`,
          { prior_status: result.prior, attempted_action: 'submit' },
        );
      }
      return reply.code(200).send(result.envelope);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /v1/repair-plan/:id/approve
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/repair-plan/:id/approve',
    async (request, reply) => {
      const { id: repairPlanId } = request.params;
      if (!UUID_RE.test(repairPlanId)) {
        return err(reply, 400, 'invalid_repair_plan_id', 'repair_plan_id must be a UUID');
      }

      const parsed = ApproveRequestV1.safeParse(request.body);
      if (!parsed.success) return err422Zod(reply, parsed.error.issues);

      const result = await performTransition(app, {
        tenantId: request.tenantId,
        repairPlanId,
        action: 'approve',
        actor: parsed.data.approver,
        note: parsed.data.note ?? null,
        stepDecisions: parsed.data.step_decisions ?? [],
      });

      if (result.kind === 'not_found') {
        return err(reply, 404, 'repair_plan_not_found', 'no repair plan for this id');
      }
      if (result.kind === 'invalid_transition') {
        return err(
          reply,
          409,
          'invalid_transition',
          `cannot approve a plan currently in status ${result.prior}`,
          { prior_status: result.prior, attempted_action: 'approve' },
        );
      }
      return reply.code(200).send(result.envelope);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /v1/repair-plan/:id/reject
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/repair-plan/:id/reject',
    async (request, reply) => {
      const { id: repairPlanId } = request.params;
      if (!UUID_RE.test(repairPlanId)) {
        return err(reply, 400, 'invalid_repair_plan_id', 'repair_plan_id must be a UUID');
      }

      const parsed = RejectRequestV1.safeParse(request.body);
      if (!parsed.success) return err422Zod(reply, parsed.error.issues);

      const result = await performTransition(app, {
        tenantId: request.tenantId,
        repairPlanId,
        action: 'reject',
        actor: parsed.data.approver,
        note: parsed.data.reason,
        stepDecisions: parsed.data.step_decisions ?? [],
      });

      if (result.kind === 'not_found') {
        return err(reply, 404, 'repair_plan_not_found', 'no repair plan for this id');
      }
      if (result.kind === 'invalid_transition') {
        return err(
          reply,
          409,
          'invalid_transition',
          `cannot reject a plan currently in status ${result.prior}`,
          { prior_status: result.prior, attempted_action: 'reject' },
        );
      }
      return reply.code(200).send(result.envelope);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/repair-plan/:id/approvals — audit log
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/repair-plan/:id/approvals', async (request, reply) => {
    const { id: repairPlanId } = request.params;
    if (!UUID_RE.test(repairPlanId)) {
      return err(reply, 400, 'invalid_repair_plan_id', 'repair_plan_id must be a UUID');
    }

    const detail = await app.withTenant(request.tenantId, async (client) => {
      const cur = await client.query<{
        repair_plan_id: string;
        intake_id: string;
        status: ApprovalStatus;
      }>(
        `SELECT repair_plan_id, intake_id, status
           FROM repair_plans
          WHERE repair_plan_id = $1
          LIMIT 1`,
        [repairPlanId],
      );
      if (cur.rowCount === 0) return null;

      const rows = await client.query<{
        approval_id: string;
        repair_plan_id: string;
        intake_id: string;
        action: ApprovalAction;
        prior_status: ApprovalStatus;
        new_status: ApprovalStatus;
        actor: string;
        note: string | null;
        step_decisions: unknown[];
        created_at: Date;
      }>(
        `SELECT approval_id, repair_plan_id, intake_id, action, prior_status, new_status,
                actor, note, step_decisions, created_at
           FROM approvals
          WHERE repair_plan_id = $1
          ORDER BY created_at ASC`,
        [repairPlanId],
      );

      return { plan: cur.rows[0]!, rows: rows.rows };
    });

    if (!detail) {
      return err(reply, 404, 'repair_plan_not_found', 'no repair plan for this id');
    }

    const out = ApprovalLogV1.parse({
      repair_plan_id: detail.plan.repair_plan_id,
      intake_id: detail.plan.intake_id,
      current_status: detail.plan.status,
      entries: detail.rows.map((r) => ({
        approval_id: r.approval_id,
        repair_plan_id: r.repair_plan_id,
        intake_id: r.intake_id,
        action: r.action,
        prior_status: r.prior_status,
        new_status: r.new_status,
        actor: r.actor,
        note: r.note,
        step_decisions: Array.isArray(r.step_decisions) ? (r.step_decisions as any[]) : [],
        created_at: r.created_at.toISOString(),
      })),
    });
    return reply.code(200).send(out);
  });
};
