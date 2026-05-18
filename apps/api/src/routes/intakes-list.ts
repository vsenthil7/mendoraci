/**
 * Intakes List route — API-010 GET /intakes (CP-9.1c).
 *
 * Anchors:
 *   - CP-9 enterprise list views (replaces sessionStorage hack from CP-8b)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-001 raw_intake / DB-002 intake_meta with LATERAL roll-ups against
 *     DB-005 rca_findings, DB-007 repair_plans, DB-010 evidence_exports
 *
 * Test anchors (apps/api/test/integration/intakes-list.test.ts):
 *   TEST-LST-INTAKE-1 happy paginate (3 pages with limit=2 over 5 rows)
 *   TEST-LST-INTAKE-2 filter by plan_status='approved'
 *   TEST-LST-INTAKE-3 filter by has_rca=true
 *   TEST-LST-INTAKE-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-INTAKE-5 invalid cursor returns 400 invalid_cursor
 *   TEST-LST-INTAKE-6 free-text q matches run_id partial
 *
 * Endpoint:
 *   GET /v1/intakes
 *     ?limit=<1..200, default 50>
 *     &cursor=<opaque base64url>
 *     &has_rca=true|false
 *     &has_plan=true|false
 *     &plan_status=draft|submitted|approved|rejected
 *     &has_export=true|false
 *     &provider=<string>
 *     &q=<free-text on run_id/branch/actor>
 *     &from=<ISO 8601>
 *     &to=<ISO 8601>
 *
 * Ordering is canonical: `ORDER BY m.received_at DESC, m.intake_id DESC`.
 * The cursor encodes the last seen (received_at, intake_id) tuple.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { IntakesListQueryV1, IntakesListResponseV1 } from '@mendoraci/shared';
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

export const intakesListRoutes: FastifyPluginAsync = async (app) => {
  app.get('/intakes', async (request, reply) => {
    // --- 1. Validate query string ---
    const parsed = IntakesListQueryV1.safeParse(request.query ?? {});
    if (!parsed.success) return err422Zod(reply, parsed.error.issues);
    const q = parsed.data;

    // --- 2. Decode cursor (if any) ---
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

    // --- 3. Build dynamic WHERE clause + params array.
    // Each filter pushes its own params and constructs its own positional
    // placeholders ($N) using the current params.length. This avoids the
    // bug where a "?" template doesn't know how many params it needs.
    const where: string[] = [];
    const params: unknown[] = [];

    if (cursorTs && cursorId) {
      // Strict "older than cursor" tuple comparison so we never repeat rows.
      params.push(cursorTs);
      const tsIdx = params.length;
      params.push(cursorId);
      const idIdx = params.length;
      where.push(`(m.received_at, m.intake_id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`);
    }
    if (q.provider) {
      params.push(q.provider);
      where.push(`m.provider = $${params.length}`);
    }
    if (q.from) {
      params.push(q.from);
      where.push(`m.received_at >= $${params.length}::timestamptz`);
    }
    if (q.to) {
      params.push(q.to);
      where.push(`m.received_at <= $${params.length}::timestamptz`);
    }
    if (q.q) {
      // Same pattern matched against three nullable columns.
      params.push(`%${q.q}%`);
      const i = params.length;
      where.push(`(m.run_id ILIKE $${i} OR m.branch ILIKE $${i} OR m.actor ILIKE $${i})`);
    }

    // Roll-up filters via EXISTS subqueries; the LATERAL roll-up below is
    // for the SELECT shape, but EXISTS lets the planner short-circuit cheaply.
    if (q.has_rca === 'true') {
      where.push(`EXISTS (SELECT 1 FROM rca_findings rf WHERE rf.intake_id = m.intake_id)`);
    } else if (q.has_rca === 'false') {
      where.push(`NOT EXISTS (SELECT 1 FROM rca_findings rf WHERE rf.intake_id = m.intake_id)`);
    }
    if (q.has_plan === 'true') {
      where.push(`EXISTS (SELECT 1 FROM repair_plans rp WHERE rp.intake_id = m.intake_id)`);
    } else if (q.has_plan === 'false') {
      where.push(`NOT EXISTS (SELECT 1 FROM repair_plans rp WHERE rp.intake_id = m.intake_id)`);
    }
    if (q.plan_status) {
      params.push(q.plan_status);
      const i = params.length;
      where.push(
        `EXISTS (SELECT 1 FROM repair_plans rp WHERE rp.intake_id = m.intake_id AND rp.status = $${i})`,
      );
    }
    if (q.has_export === 'true') {
      where.push(`EXISTS (SELECT 1 FROM evidence_exports e WHERE e.intake_id = m.intake_id)`);
    } else if (q.has_export === 'false') {
      where.push(`NOT EXISTS (SELECT 1 FROM evidence_exports e WHERE e.intake_id = m.intake_id)`);
    }

    const whereSql = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
    // Fetch limit+1 so we know if there's a next page without a count(*).
    const fetchLimit = q.limit + 1;
    params.push(fetchLimit);
    const limitIdx = params.length;

    // --- 4. Main SELECT with LATERAL roll-ups for the response shape.
    // LATERAL gives us `plan_status` (which EXISTS can't), and per-row 1-row
    // sub-selects so planner does an index lookup and stops.
    const sql = `
      SELECT
        m.intake_id, m.provider, m.run_id, m.attempt_id, m.branch, m.commit_sha,
        m.actor, r.mask_policy_version, m.received_at AS created_at,
        (rca.rca_finding_id IS NOT NULL) AS has_rca,
        (rp.repair_plan_id IS NOT NULL)  AS has_plan,
        rp.status                         AS plan_status,
        (ev.evidence_export_id IS NOT NULL) AS has_export
      FROM intake_meta m
      JOIN raw_intake r ON r.intake_id = m.intake_id
      LEFT JOIN LATERAL (
        SELECT rca_finding_id FROM rca_findings WHERE intake_id = m.intake_id
        ORDER BY created_at DESC LIMIT 1
      ) rca ON true
      LEFT JOIN LATERAL (
        SELECT repair_plan_id, status FROM repair_plans WHERE intake_id = m.intake_id
        ORDER BY created_at DESC LIMIT 1
      ) rp ON true
      LEFT JOIN LATERAL (
        SELECT evidence_export_id FROM evidence_exports WHERE intake_id = m.intake_id
        ORDER BY created_at DESC LIMIT 1
      ) ev ON true
      ${whereSql}
      ORDER BY m.received_at DESC, m.intake_id DESC
      LIMIT $${limitIdx}
    `;

    const items = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        intake_id: string;
        provider: string;
        run_id: string;
        attempt_id: string;
        branch: string | null;
        commit_sha: string | null;
        actor: string | null;
        mask_policy_version: string;
        created_at: Date;
        has_rca: boolean;
        has_plan: boolean;
        plan_status: 'draft' | 'submitted' | 'approved' | 'rejected' | null;
        has_export: boolean;
      }>(sql, params);
      return r.rows;
    });

    // --- 5. Slice the limit+1 fetch into a page + next_cursor.
    let nextCursor: string | null = null;
    const sliced = items.slice(0, q.limit);
    if (items.length > q.limit) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeCursor(last.created_at, last.intake_id);
    }

    const response = IntakesListResponseV1.parse({
      items: sliced.map((row) => ({
        intake_id: row.intake_id,
        provider: row.provider,
        run_id: row.run_id,
        attempt_id: row.attempt_id,
        branch: row.branch,
        commit_sha: row.commit_sha,
        actor: row.actor,
        mask_policy_version: row.mask_policy_version,
        created_at: row.created_at.toISOString(),
        has_rca: !!row.has_rca,
        has_plan: !!row.has_plan,
        plan_status: row.plan_status,
        has_export: !!row.has_export,
      })),
      next_cursor: nextCursor,
    });

    return reply.code(200).send(response);
  });
};
