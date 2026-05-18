/**
 * Evidence-exports List route — API-014 GET /evidence-exports (CP-9.1f).
 *
 * Anchors:
 *   - CP-9 enterprise list views
 *   - RT-006 Evidence Export (BR-006)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-010 evidence_exports
 *
 * Test anchors (apps/api/test/integration/evidence-exports-list.test.ts):
 *   TEST-LST-EVIDENCE-1 happy paginate (3 pages over 5 exports)
 *   TEST-LST-EVIDENCE-2 filter by intake_id
 *   TEST-LST-EVIDENCE-3 filter by from/to time range
 *   TEST-LST-EVIDENCE-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-EVIDENCE-5 invalid cursor returns 400 invalid_cursor
 *
 * Endpoint:
 *   GET /v1/evidence-exports
 *     ?limit=<1..200, default 50>
 *     &cursor=<opaque base64url>
 *     &intake_id=<uuid>
 *     &repair_plan_id=<uuid>
 *     &from=<ISO 8601>
 *     &to=<ISO 8601>
 *
 * Ordering: ORDER BY e.created_at DESC, e.evidence_export_id DESC.
 *
 * NOTE: The list endpoint does NOT mint presigned URLs to avoid wasting
 * MinIO signing for rows the user may never click. The detail endpoint
 * (POST /v1/intake/:id/evidence-export from CP-8) mints them on demand.
 * For re-downloads from the list page, the UI should GET /v1/intake/:id/
 * evidence-export which mints a fresh URL each call.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { EvidenceExportsListQueryV1, EvidenceExportsListResponseV1 } from '@mendoraci/shared';
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

export const evidenceExportsListRoutes: FastifyPluginAsync = async (app) => {
  app.get('/evidence-exports', async (request, reply) => {
    const parsed = EvidenceExportsListQueryV1.safeParse(request.query ?? {});
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
      where.push(`(e.created_at, e.evidence_export_id) < ($${tsIdx}::timestamptz, $${idIdx}::uuid)`);
    }
    if (q.intake_id) {
      params.push(q.intake_id);
      where.push(`e.intake_id = $${params.length}::uuid`);
    }
    if (q.repair_plan_id) {
      params.push(q.repair_plan_id);
      where.push(`e.repair_plan_id = $${params.length}::uuid`);
    }
    if (q.from) {
      params.push(q.from);
      where.push(`e.created_at >= $${params.length}::timestamptz`);
    }
    if (q.to) {
      params.push(q.to);
      where.push(`e.created_at <= $${params.length}::timestamptz`);
    }

    const whereSql = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
    const fetchLimit = q.limit + 1;
    params.push(fetchLimit);
    const limitIdx = params.length;

    const sql = `
      SELECT
        e.evidence_export_id, e.intake_id, e.repair_plan_id,
        m.provider AS intake_provider, m.run_id AS intake_run_id,
        e.s3_bucket, e.s3_key, e.sha256, e.byte_size, e.created_at
      FROM evidence_exports e
      JOIN intake_meta m ON m.intake_id = e.intake_id
      ${whereSql}
      ORDER BY e.created_at DESC, e.evidence_export_id DESC
      LIMIT $${limitIdx}
    `;

    const items = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        evidence_export_id: string;
        intake_id: string;
        repair_plan_id: string;
        intake_provider: string;
        intake_run_id: string;
        s3_bucket: string;
        s3_key: string;
        sha256: string;
        byte_size: string; // bigint returns as string from pg
        created_at: Date;
      }>(sql, params);
      return r.rows;
    });

    let nextCursor: string | null = null;
    const sliced = items.slice(0, q.limit);
    if (items.length > q.limit) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeCursor(last.created_at, last.evidence_export_id);
    }

    const response = EvidenceExportsListResponseV1.parse({
      items: sliced.map((row) => ({
        evidence_export_id: row.evidence_export_id,
        intake_id: row.intake_id,
        repair_plan_id: row.repair_plan_id,
        intake_provider: row.intake_provider,
        intake_run_id: row.intake_run_id,
        s3_bucket: row.s3_bucket,
        s3_key: row.s3_key,
        sha256: row.sha256,
        byte_size: Number(row.byte_size),
        created_at: row.created_at.toISOString(),
      })),
      next_cursor: nextCursor,
    });

    return reply.code(200).send(response);
  });
};
