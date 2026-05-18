/**
 * Repair plans List route — API-012 GET /repair-plans (CP-9.1e).
 *
 * Anchors:
 *   - CP-9 enterprise list views
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-007 repair_plans + DB-008 repair_steps + DB-009 approvals
 *
 * Test anchors (apps/api/test/integration/repair-plans-list.test.ts):
 *   TEST-LST-PLAN-1 happy paginate (3 pages with limit=2 over 5 rows)
 *   TEST-LST-PLAN-2 filter by status=approved
 *   TEST-LST-PLAN-3 filter by overall_risk=medium (mock-Bob default)
 *   TEST-LST-PLAN-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-PLAN-5 invalid cursor returns 400 invalid_cursor
 *
 * Endpoint:
 *   GET /v1/repair-plans
 *     ?limit=<1..200, default 50>
 *     &cursor=<opaque base64url>
 *     &intake_id=<uuid>
 *     &status=draft|submitted|approved|rejected
 *     &overall_risk=low|medium|high
 *     &est_total_effort=XS|S|M|L|XL
 *     &provider=<string>
 *     &q=<free-text on summary>
 *     &from=<ISO 8601>
 *     &to=<ISO 8601>
 *
 * Ordering: ORDER BY rp.created_at DESC, rp.repair_plan_id DESC.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { RepairPlansListQueryV1, RepairPlansListResponseV1 } from '@mendoraci/shared';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';

function err(reply: FastifyReply, status: number, code: string, message: string, extra?: object) {
  return reply
    .code(status)
    .type('application/json')
    .send({ error: { code, message, ...(extra ?? {}) } });
}

function err422Zod(
  reply: FastifyReply,
  issues: ReadonlyArray<{ path: (string | number)[]; message: string }>,
) {
  return reply.code(422).type('application/json').send({
    error: {
      code: 'validation_failed',
      message: 'request_query_invalid',
      validation_errors: issues.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
        message: String(i.message ?? ''),
      })),
    },
  });
}

export const repairPlansListRoutes: FastifyPluginAsync = async (app) => {
  app.get('/repair-plans', async (request, reply) => {
    const parsed = RepairPlansListQueryV1.safeParse(request.query ?? {});
    if (!parsed.success) return err422Zod(reply, parsed.error.issues);
    const q = parsed.data;

    let cursorTs: string | null = null;
    let cursorId: string | null = null;
    if (q.cursor) {
      try {
        const decoded = decodeCursor(q.cursor);
        cursorTs = decoded.ts;
        cursorId = decoded.id;
      } catch (e) {
        return err(reply, 400, 'invalid_cursor', (e as Error).message);
      }
    }

    const where: string[] = [];
    const params: unknown[] = [];

    if (cursorTs && cursorId) {
      params.push(cursorTs);
      const tsIdx = params.length;
      params.push(cursorId);
      const idIdx = params.length;
      where.push(`(rp.created_at, rp.repair_plan_id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`);
    }
    if (q.intake_id) {
      params.push(q.intake_id);
      where.push(`rp.intake_id = $${params.length}::uuid`);
    }
    if (q.status) {
      params.push(q.status);
      where.push(`rp.status = $${params.length}`);
    }
    if (q.overall_risk) {
      params.push(q.overall_risk);
      where.push(`rp.overall_risk = $${params.length}`);
    }
    if (q.est_total_effort) {
      params.push(q.est_total_effort);
      where.push(`rp.est_total_effort = $${params.length}`);
    }
    if (q.provider) {
      params.push(q.provider);
      where.push(`rp.provider = $${params.length}`);
    }
    if (q.q) {
      params.push(`%${q.q}%`);
      where.push(`rp.summary ILIKE $${params.length}`);
    }
    if (q.from) {
      params.push(q.from);
      where.push(`rp.created_at >= $${params.length}::timestamptz`);
    }
    if (q.to) {
      params.push(q.to);
      where.push(`rp.created_at <= $${params.length}::timestamptz`);
    }

    const whereSql = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
    const fetchLimit = q.limit + 1;
    params.push(fetchLimit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        rp.repair_plan_id, rp.intake_id,
        m.provider AS intake_provider, m.run_id AS intake_run_id, m.branch AS intake_branch,
        rp.status, rp.summary, rp.overall_risk, rp.est_total_effort,
        COALESCE(sc.step_count, 0)::int AS step_count,
        rp.provider, rp.model_id, rp.bob_latency_ms,
        la.action AS last_approval_action,
        la.actor  AS last_approval_actor,
        la.created_at AS last_approval_at,
        rp.created_at
      FROM repair_plans rp
      JOIN intake_meta m ON m.intake_id = rp.intake_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS step_count
        FROM repair_steps s WHERE s.repair_plan_id = rp.repair_plan_id
      ) sc ON true
      LEFT JOIN LATERAL (
        SELECT a.action, a.actor, a.created_at
        FROM approvals a WHERE a.repair_plan_id = rp.repair_plan_id
        ORDER BY a.created_at DESC LIMIT 1
      ) la ON true
      ${whereSql}
      ORDER BY rp.created_at DESC, rp.repair_plan_id DESC
      LIMIT $${limitIdx}
    `;

    const items = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        repair_plan_id: string;
        intake_id: string;
        intake_provider: string;
        intake_run_id: string;
        intake_branch: string | null;
        status: 'draft' | 'submitted' | 'approved' | 'rejected';
        summary: string;
        overall_risk: 'low' | 'medium' | 'high';
        est_total_effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
        step_count: number;
        provider: string;
        model_id: string;
        bob_latency_ms: number;
        last_approval_action: 'submit' | 'approve' | 'reject' | null;
        last_approval_actor: string | null;
        last_approval_at: Date | null;
        created_at: Date;
      }>(sql, params);
      return r.rows;
    });

    let nextCursor: string | null = null;
    const sliced = items.slice(0, q.limit);
    if (items.length > q.limit) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeCursor(last.created_at, last.repair_plan_id);
    }

    const response = RepairPlansListResponseV1.parse({
      items: sliced.map((row) => ({
        repair_plan_id: row.repair_plan_id,
        intake_id: row.intake_id,
        intake_provider: row.intake_provider,
        intake_run_id: row.intake_run_id,
        intake_branch: row.intake_branch,
        status: row.status,
        summary: row.summary,
        overall_risk: row.overall_risk,
        est_total_effort: row.est_total_effort,
        step_count: row.step_count,
        provider: row.provider,
        model_id: row.model_id,
        bob_latency_ms: row.bob_latency_ms,
        last_approval_action: row.last_approval_action,
        last_approval_actor: row.last_approval_actor,
        last_approval_at: row.last_approval_at ? row.last_approval_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
      })),
      next_cursor: nextCursor,
    });

    return reply.code(200).send(response);
  });
};
