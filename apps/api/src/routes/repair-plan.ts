/**
 * Repair Plan routes — API-005.
 *
 * Anchors:
 *   - RT-004 Repair Plan (BR-004)
 *   - RT-003 RCA dependency: a repair plan requires a finished RCA finding
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-007 repair_plans, DB-008 repair_steps
 *
 * Test anchors:
 *   - TEST-012 happy plan with mock-Bob -> 201
 *   - TEST-013 cross-tenant -> 404 (RLS proof for repair_plans/steps)
 *   - TEST-014 RCA missing -> 412 rca_required
 *   - NEG x4 invalid intake_id 400, missing tenant 401, validation 422,
 *           GET-before-plan 404 repair_plan_not_found
 *
 * Endpoints:
 *   POST /v1/intake/:id/repair-plan  -> generate plan, persist, return 201
 *   GET  /v1/intake/:id/repair-plan  -> most recent plan with ordered steps
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  RepairPlanRequestV1,
  RepairPlanResponseV1,
  RepairPlanDetailV1,
  type RepairPlanModelOutput,
} from '@mendoraci/shared';
import {
  buildRepairPlanPrompt,
  runRepairPlan,
  BobTimeoutError,
  BobInvocationError,
  BobParseError,
} from '../lib/bob.js';

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

export const repairPlanRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // POST /v1/intake/:id/repair-plan
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/intake/:id/repair-plan',
    async (request, reply) => {
      const { id: intakeId } = request.params;
      if (!UUID_RE.test(intakeId)) {
        return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
      }

      const parsedBody = RepairPlanRequestV1.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return err422Zod(reply, parsedBody.error.issues);
      }
      // Default to plan mode for repair-plan (vs ask for RCA).
      const chatMode = parsedBody.data.chat_mode ?? 'plan';

      // ------- Step 1: load intake + most-recent RCA finding under tenant ------
      const context = await app.withTenant(request.tenantId, async (client) => {
        const intake = await client.query<{
          intake_id: string;
          branch: string | null;
          commit_sha: string | null;
        }>(
          `SELECT intake_id, branch, commit_sha
             FROM intake_meta WHERE intake_id = $1 LIMIT 1`,
          [intakeId],
        );
        if (intake.rowCount === 0) return { kind: 'no_intake' as const };

        const rca = await client.query<{
          rca_finding_id: string;
          root_cause: string;
          confidence: 'low' | 'medium' | 'high';
          recommended_actions: string[];
        }>(
          `SELECT rca_finding_id, root_cause, confidence, recommended_actions
             FROM rca_findings
            WHERE intake_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [intakeId],
        );
        if (rca.rowCount === 0) {
          return { kind: 'no_rca' as const, intake: intake.rows[0]! };
        }

        const evidence = await client.query<{ snippet: string }>(
          `SELECT snippet FROM rca_evidence
             WHERE rca_finding_id = $1 ORDER BY rank ASC, created_at ASC`,
          [rca.rows[0]!.rca_finding_id],
        );

        return {
          kind: 'ok' as const,
          intake: intake.rows[0]!,
          rca: rca.rows[0]!,
          evidenceSnippets: evidence.rows.map((r) => r.snippet),
        };
      });

      if (context.kind === 'no_intake') {
        return err(reply, 404, 'intake_not_found', 'no intake found for this id');
      }
      if (context.kind === 'no_rca') {
        return err(
          reply,
          412,
          'rca_required',
          'no RCA finding exists for this intake; run POST /v1/intake/:id/rca first',
        );
      }

      // ------- Step 2: build prompt + call Bob ----------------------------------
      const prompt = buildRepairPlanPrompt({
        rcaSummary: context.rca.root_cause,
        rcaConfidence: context.rca.confidence,
        recommendedActions: Array.isArray(context.rca.recommended_actions)
          ? context.rca.recommended_actions
          : [],
        evidenceSnippets: context.evidenceSnippets,
        intakeId,
        branch: context.intake.branch ?? undefined,
        commitSha: context.intake.commit_sha ?? undefined,
      });

      let bobResult: {
        provider: 'bob' | 'mock-bob';
        model_id: string;
        output: RepairPlanModelOutput;
        raw_text: string;
        latency_ms: number;
      };
      try {
        bobResult = await runRepairPlan(
          { prompt, chatMode },
          {
            rootCause: context.rca.root_cause,
            confidence: context.rca.confidence,
            recommendedActions: Array.isArray(context.rca.recommended_actions)
              ? context.rca.recommended_actions
              : [],
          },
        );
      } catch (e: unknown) {
        if (e instanceof BobTimeoutError) {
          return err(reply, 504, 'bob_timeout', e.message);
        }
        if (e instanceof BobParseError) {
          return err(reply, 502, 'bob_bad_output', e.message, {
            raw_preview: e.rawText.slice(0, 500),
          });
        }
        if (e instanceof BobInvocationError) {
          return err(reply, 503, 'bob_unavailable', e.message);
        }
        throw e;
      }

      // ------- Step 3: persist plan + steps -------------------------------------
      const persisted = await app.withTenant(request.tenantId, async (client) => {
        const p = await client.query<{ repair_plan_id: string; created_at: Date }>(
          `INSERT INTO repair_plans
             (rca_finding_id, intake_id, tenant_id, provider, model_id,
              summary, overall_risk, rollback_strategy, est_total_effort,
              raw_model_output, bob_latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING repair_plan_id, created_at`,
          [
            context.rca.rca_finding_id,
            intakeId,
            request.tenantId,
            bobResult.provider,
            bobResult.model_id,
            bobResult.output.summary,
            bobResult.output.overall_risk,
            bobResult.output.rollback_strategy,
            bobResult.output.est_total_effort,
            bobResult.raw_text.slice(0, 8192),
            bobResult.latency_ms,
          ],
        );
        const repairPlanId = p.rows[0]!.repair_plan_id;
        const createdAt = p.rows[0]!.created_at;

        let rank = 0;
        for (const step of bobResult.output.steps) {
          await client.query(
            `INSERT INTO repair_steps
               (repair_plan_id, intake_id, tenant_id, rank, title, description,
                step_type, files, est_effort, risk)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
            [
              repairPlanId,
              intakeId,
              request.tenantId,
              rank++,
              step.title,
              step.description,
              step.type,
              JSON.stringify(step.files ?? []),
              step.est_effort,
              step.risk,
            ],
          );
        }
        return { repairPlanId, createdAt };
      });

      const out = RepairPlanResponseV1.parse({
        repair_plan_id: persisted.repairPlanId,
        rca_finding_id: context.rca.rca_finding_id,
        intake_id: intakeId,
        provider: bobResult.provider,
        model_id: bobResult.model_id,
        output: bobResult.output,
        bob_latency_ms: bobResult.latency_ms,
        created_at: persisted.createdAt.toISOString(),
      });
      return reply.code(201).send(out);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/intake/:id/repair-plan
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/intake/:id/repair-plan', async (request, reply) => {
    const { id: intakeId } = request.params;
    if (!UUID_RE.test(intakeId)) {
      return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
    }

    const detail = await app.withTenant(request.tenantId, async (client) => {
      const p = await client.query<{
        repair_plan_id: string;
        rca_finding_id: string;
        intake_id: string;
        provider: 'bob' | 'mock-bob';
        model_id: string;
        summary: string;
        overall_risk: 'low' | 'medium' | 'high';
        rollback_strategy: string;
        est_total_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
        bob_latency_ms: number;
        created_at: Date;
      }>(
        `SELECT repair_plan_id, rca_finding_id, intake_id, provider, model_id,
                summary, overall_risk, rollback_strategy, est_total_effort,
                bob_latency_ms, created_at
           FROM repair_plans
          WHERE intake_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [intakeId],
      );
      if (p.rowCount === 0) return null;
      const plan = p.rows[0]!;

      const stepsRes = await client.query<{
        step_id: string;
        rank: number;
        title: string;
        description: string;
        step_type:
          | 'code-edit'
          | 'config-change'
          | 'infra-change'
          | 'rollback'
          | 'investigation'
          | 'dependency-update'
          | 'test-add'
          | 'other';
        files: string[];
        est_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
        risk: 'low' | 'medium' | 'high';
      }>(
        `SELECT step_id, rank, title, description, step_type, files, est_effort, risk
           FROM repair_steps
          WHERE repair_plan_id = $1
          ORDER BY rank ASC, created_at ASC`,
        [plan.repair_plan_id],
      );

      return { plan, steps: stepsRes.rows };
    });

    if (!detail) {
      return err(reply, 404, 'repair_plan_not_found', 'no repair plan for this intake yet');
    }

    const out = RepairPlanDetailV1.parse({
      repair_plan_id: detail.plan.repair_plan_id,
      rca_finding_id: detail.plan.rca_finding_id,
      intake_id: detail.plan.intake_id,
      provider: detail.plan.provider,
      model_id: detail.plan.model_id,
      output: {
        summary: detail.plan.summary,
        overall_risk: detail.plan.overall_risk,
        steps: detail.steps.map((s) => ({
          title: s.title,
          description: s.description,
          type: s.step_type,
          files: Array.isArray(s.files) ? s.files : [],
          est_effort: s.est_effort,
          risk: s.risk,
        })),
        rollback_strategy: detail.plan.rollback_strategy,
        est_total_effort: detail.plan.est_total_effort,
      },
      bob_latency_ms: detail.plan.bob_latency_ms,
      created_at: detail.plan.created_at.toISOString(),
      steps: detail.steps.map((s) => ({
        step_id: s.step_id,
        rank: s.rank,
        title: s.title,
        description: s.description,
        type: s.step_type,
        files: Array.isArray(s.files) ? s.files : [],
        est_effort: s.est_effort,
        risk: s.risk,
      })),
    });
    return reply.code(200).send(out);
  });
};
