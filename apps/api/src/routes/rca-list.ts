/**
 * RCA findings List route — API-011 GET /rca-findings (CP-9.1d).
 *
 * Anchors:
 *   - CP-9 enterprise list views
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-005 rca_findings + DB-006 rca_evidence
 *
 * Test anchors (apps/api/test/integration/rca-list.test.ts):
 *   TEST-LST-RCA-1 happy paginate (3 pages with limit=2 over 5 rows)
 *   TEST-LST-RCA-2 filter by confidence=high
 *   TEST-LST-RCA-3 filter by intake_id (one RCA returned, others filtered out)
 *   TEST-LST-RCA-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-RCA-5 invalid cursor returns 400 invalid_cursor
 *
 * Endpoint:
 *   GET /v1/rca-findings
 *     ?limit=<1..200, default 50>
 *     &cursor=<opaque base64url>
 *     &intake_id=<uuid>
 *     &confidence=low|medium|high
 *     &provider=<string>   (e.g. 'bob' / 'mock-bob')
 *     &q=<free-text on root_cause>
 *     &from=<ISO 8601>
 *     &to=<ISO 8601>
 *
 * Ordering is canonical: ORDER BY rf.created_at DESC, rf.rca_finding_id DESC.
 *
 * NOTE: rca_findings.recommended_actions is stored as JSONB array
 * (see CP-5 migration 1747700000000_rt003-rca.cjs), so we use
 * jsonb_array_length() not array_length().
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { RcaListQueryV1, RcaListResponseV1 } from '@mendoraci/shared';
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

export const rcaListRoutes: FastifyPluginAsync = async (app) => {
  app.get('/rca-findings', async (request, reply) => {
    // --- 1. Validate query string ---
    const parsed = RcaListQueryV1.safeParse(request.query ?? {});
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

    // --- 3. Build dynamic WHERE clause + params array ---
    const where: string[] = [];
    const params: unknown[] = [];

    if (cursorTs && cursorId) {
      params.push(cursorTs);
      const tsIdx = params.length;
      params.push(cursorId);
      const idIdx = params.length;
      where.push(`(rf.created_at, rf.rca_finding_id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`);
    }
    if (q.intake_id) {
      params.push(q.intake_id);
      where.push(`rf.intake_id = $${params.length}::uuid`);
    }
    if (q.confidence) {
      params.push(q.confidence);
      where.push(`rf.confidence = $${params.length}`);
    }
    if (q.provider) {
      params.push(q.provider);
      where.push(`rf.provider = $${params.length}`);
    }
    if (q.q) {
      params.push(`%${q.q}%`);
      where.push(`rf.root_cause ILIKE $${params.length}`);
    }
    if (q.from) {
      params.push(q.from);
      where.push(`rf.created_at >= $${params.length}::timestamptz`);
    }
    if (q.to) {
      params.push(q.to);
      where.push(`rf.created_at <= $${params.length}::timestamptz`);
    }

    const whereSql = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
    const fetchLimit = q.limit + 1;
    params.push(fetchLimit);
    const limitIdx = params.length;

    // --- 4. Main SELECT joining intake_meta for context.
    // recommended_actions is JSONB - use jsonb_array_length, and CASE to
    // handle the case where the column is null or empty (jsonb_array_length
    // throws on non-array values).
    const sql = `
      SELECT
        rf.rca_finding_id, rf.intake_id,
        m.provider AS intake_provider, m.run_id AS intake_run_id, m.branch AS intake_branch,
        rf.provider, rf.model_id, rf.root_cause, rf.confidence,
        COALESCE(ec.evidence_count, 0)::int AS evidence_count,
        CASE
          WHEN rf.recommended_actions IS NULL THEN 0
          WHEN jsonb_typeof(rf.recommended_actions) = 'array'
            THEN jsonb_array_length(rf.recommended_actions)
          ELSE 0
        END AS recommended_actions_count,
        rf.bob_latency_ms, rf.created_at
      FROM rca_findings rf
      JOIN intake_meta m ON m.intake_id = rf.intake_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS evidence_count
        FROM rca_evidence re WHERE re.rca_finding_id = rf.rca_finding_id
      ) ec ON true
      ${whereSql}
      ORDER BY rf.created_at DESC, rf.rca_finding_id DESC
      LIMIT $${limitIdx}
    `;

    const items = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        rca_finding_id: string;
        intake_id: string;
        intake_provider: string;
        intake_run_id: string;
        intake_branch: string | null;
        provider: string;
        model_id: string;
        root_cause: string;
        confidence: 'low' | 'medium' | 'high';
        evidence_count: number;
        recommended_actions_count: number;
        bob_latency_ms: number;
        created_at: Date;
      }>(sql, params);
      return r.rows;
    });

    // --- 5. Slice into a page + next_cursor ---
    let nextCursor: string | null = null;
    const sliced = items.slice(0, q.limit);
    if (items.length > q.limit) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeCursor(last.created_at, last.rca_finding_id);
    }

    const response = RcaListResponseV1.parse({
      items: sliced.map((row) => ({
        rca_finding_id: row.rca_finding_id,
        intake_id: row.intake_id,
        intake_provider: row.intake_provider,
        intake_run_id: row.intake_run_id,
        intake_branch: row.intake_branch,
        provider: row.provider,
        model_id: row.model_id,
        root_cause: row.root_cause,
        confidence: row.confidence,
        evidence_count: row.evidence_count,
        recommended_actions_count: row.recommended_actions_count,
        bob_latency_ms: row.bob_latency_ms,
        created_at: row.created_at.toISOString(),
      })),
      next_cursor: nextCursor,
    });

    return reply.code(200).send(response);
  });
};
