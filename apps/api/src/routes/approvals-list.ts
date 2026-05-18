/**
 * Approvals List route — API-013 GET /approvals (CP-9.1f).
 *
 * Anchors:
 *   - CP-9 enterprise list views
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-009 approvals
 *
 * Test anchors (apps/api/test/integration/approvals-list.test.ts):
 *   TEST-LST-APPROVAL-1 happy paginate (3 pages over 5 audit rows)
 *   TEST-LST-APPROVAL-2 filter by action=approve
 *   TEST-LST-APPROVAL-3 filter by repair_plan_id
 *   TEST-LST-APPROVAL-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-APPROVAL-5 invalid cursor returns 400 invalid_cursor
 *
 * Endpoint:
 *   GET /v1/approvals
 *     ?limit=<1..200, default 50>
 *     &cursor=<opaque base64url>
 *     &repair_plan_id=<uuid>
 *     &intake_id=<uuid>
 *     &action=submit|approve|reject
 *     &actor=<string>     exact match on actor email/username
 *     &from=<ISO 8601>
 *     &to=<ISO 8601>
 *
 * Ordering: ORDER BY a.created_at DESC, a.approval_id DESC.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { ApprovalsListQueryV1, ApprovalsListResponseV1 } from '@mendoraci/shared';
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

export const approvalsListRoutes: FastifyPluginAsync = async (app) => {
  app.get('/approvals', async (request, reply) => {
    const parsed = ApprovalsListQueryV1.safeParse(request.query ?? {});
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
      where.push(`(a.created_at, a.approval_id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`);
    }
    if (q.repair_plan_id) {
      params.push(q.repair_plan_id);
      where.push(`a.repair_plan_id = $${params.length}::uuid`);
    }
    if (q.intake_id) {
      params.push(q.intake_id);
      where.push(`rp.intake_id = $${params.length}::uuid`);
    }
    if (q.action) {
      params.push(q.action);
      where.push(`a.action = $${params.length}`);
    }
    if (q.actor) {
      params.push(q.actor);
      where.push(`a.actor = $${params.length}`);
    }
    if (q.from) {
      params.push(q.from);
      where.push(`a.created_at >= $${params.length}::timestamptz`);
    }
    if (q.to) {
      params.push(q.to);
      where.push(`a.created_at <= $${params.length}::timestamptz`);
    }

    const whereSql = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
    const fetchLimit = q.limit + 1;
    params.push(fetchLimit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        a.approval_id, a.repair_plan_id, rp.intake_id,
        m.provider AS intake_provider, m.run_id AS intake_run_id,
        rp.summary AS plan_summary,
        a.action, a.prior_status, a.new_status, a.actor, a.note,
        a.created_at
      FROM approvals a
      JOIN repair_plans rp ON rp.repair_plan_id = a.repair_plan_id
      JOIN intake_meta m ON m.intake_id = rp.intake_id
      ${whereSql}
      ORDER BY a.created_at DESC, a.approval_id DESC
      LIMIT $${limitIdx}
    `;

    const items = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        approval_id: string;
        repair_plan_id: string;
        intake_id: string;
        intake_provider: string;
        intake_run_id: string;
        plan_summary: string;
        action: 'submit' | 'approve' | 'reject';
        prior_status: 'draft' | 'submitted' | 'approved' | 'rejected';
        new_status: 'draft' | 'submitted' | 'approved' | 'rejected';
        actor: string;
        note: string | null;
        created_at: Date;
      }>(sql, params);
      return r.rows;
    });

    let nextCursor: string | null = null;
    const sliced = items.slice(0, q.limit);
    if (items.length > q.limit) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeCursor(last.created_at, last.approval_id);
    }

    const response = ApprovalsListResponseV1.parse({
      items: sliced.map((row) => ({
        approval_id: row.approval_id,
        repair_plan_id: row.repair_plan_id,
        intake_id: row.intake_id,
        intake_provider: row.intake_provider,
        intake_run_id: row.intake_run_id,
        plan_summary: row.plan_summary,
        action: row.action,
        prior_status: row.prior_status,
        new_status: row.new_status,
        actor: row.actor,
        note: row.note,
        created_at: row.created_at.toISOString(),
      })),
      next_cursor: nextCursor,
    });

    return reply.code(200).send(response);
  });
};
