/**
 * RCA routes — API-004.
 *
 * Anchors:
 *   - RT-003 Root-Cause Analysis (BR-003, BR-012)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - RT-008 Mask Policy v1 (we pass the masked preview to Bob, never raw body)
 *   - DB-005 rca_findings, DB-006 rca_evidence
 *
 * Test anchors:
 *   - TEST-008 happy RCA with mock-Bob -> 201
 *   - TEST-009 cross-tenant -> 404 intake_not_found (RLS proof)
 *   - TEST-010 unknown intake -> 404
 *   - TEST-011 missing mask preview -> 412 precondition_failed
 *   - NEG-RCA-01..03 invalid intake_id 400, missing tenant 401, validation 422
 *
 * Endpoints:
 *   POST /v1/intake/:id/rca   -> run RCA, persist finding + evidence, return 201
 *   GET  /v1/intake/:id/rca   -> get most recent finding (200) or 404
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  RcaRequestV1,
  RcaResponseV1,
  RcaDetailV1,
  type RcaModelOutput,
} from '@mendoraci/shared';
import {
  buildRcaPrompt,
  runRca,
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

export const rcaRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // POST /v1/intake/:id/rca
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>('/intake/:id/rca', async (request, reply) => {
    const { id: intakeId } = request.params;
    if (!UUID_RE.test(intakeId)) {
      return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
    }

    // request body is optional; only chat_mode override.
    const parsedBody = RcaRequestV1.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return err422Zod(reply, parsedBody.error.issues);
    }
    const chatMode = parsedBody.data.chat_mode ?? 'ask';

    // ---------- Step 1: load intake + masked preview under tenant context -----
    const intakeInfo = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        intake_id: string;
        provider: string;
        branch: string | null;
        commit_sha: string | null;
        body_masked_preview: string | null;
      }>(
        `SELECT m.intake_id, m.provider, m.branch, m.commit_sha,
                r.body_masked_preview
           FROM intake_meta m
           JOIN raw_intake  r ON r.intake_id = m.intake_id
          WHERE m.intake_id = $1
          LIMIT 1`,
        [intakeId],
      );
      if (r.rowCount === 0) return null;
      return r.rows[0]!;
    });

    if (!intakeInfo) {
      return err(reply, 404, 'intake_not_found', 'no intake found for this id');
    }

    if (!intakeInfo.body_masked_preview || intakeInfo.body_masked_preview.trim().length === 0) {
      return err(
        reply,
        412,
        'mask_preview_unavailable',
        'intake has no masked body preview; RCA cannot proceed without masked context',
      );
    }

    // ---------- Step 2: build prompt + call Bob (or mock-Bob) ----------------
    const prompt = buildRcaPrompt({
      maskedLogPreview: intakeInfo.body_masked_preview,
      intakeId,
      branch: intakeInfo.branch ?? undefined,
      commitSha: intakeInfo.commit_sha ?? undefined,
    });

    let bobResult: {
      provider: 'bob' | 'mock-bob';
      model_id: string;
      output: RcaModelOutput;
      raw_text: string;
      latency_ms: number;
    };
    try {
      bobResult = await runRca({ prompt, chatMode });
    } catch (e: unknown) {
      if (e instanceof BobTimeoutError) {
        return err(reply, 504, 'bob_timeout', e.message);
      }
      if (e instanceof BobParseError) {
        return err(reply, 502, 'bob_bad_output', e.message, { raw_preview: e.rawText.slice(0, 500) });
      }
      if (e instanceof BobInvocationError) {
        return err(reply, 503, 'bob_unavailable', e.message);
      }
      throw e;
    }

    // ---------- Step 3: persist finding + evidence under tenant context ------
    const persisted = await app.withTenant(request.tenantId, async (client) => {
      const f = await client.query<{ rca_finding_id: string; created_at: Date }>(
        `INSERT INTO rca_findings
           (intake_id, tenant_id, provider, model_id, root_cause, confidence,
            recommended_actions, raw_model_output, bob_latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         RETURNING rca_finding_id, created_at`,
        [
          intakeId,
          request.tenantId,
          bobResult.provider,
          bobResult.model_id,
          bobResult.output.root_cause,
          bobResult.output.confidence,
          JSON.stringify(bobResult.output.recommended_actions),
          bobResult.raw_text.slice(0, 8192),
          bobResult.latency_ms,
        ],
      );
      const rcaFindingId = f.rows[0]!.rca_finding_id;
      const createdAt = f.rows[0]!.created_at;

      let rank = 0;
      for (const snippet of bobResult.output.evidence_snippets) {
        await client.query(
          `INSERT INTO rca_evidence
             (rca_finding_id, intake_id, tenant_id, snippet, source, rank)
           VALUES ($1, $2, $3, $4, 'masked_log', $5)`,
          [rcaFindingId, intakeId, request.tenantId, snippet, rank++],
        );
      }
      return { rcaFindingId, createdAt };
    });

    const out = RcaResponseV1.parse({
      rca_finding_id: persisted.rcaFindingId,
      intake_id: intakeId,
      provider: bobResult.provider,
      model_id: bobResult.model_id,
      output: bobResult.output,
      bob_latency_ms: bobResult.latency_ms,
      created_at: persisted.createdAt.toISOString(),
    });
    return reply.code(201).send(out);
  });

  // ---------------------------------------------------------------------------
  // GET /v1/intake/:id/rca — most recent finding for this intake
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/intake/:id/rca', async (request, reply) => {
    const { id: intakeId } = request.params;
    if (!UUID_RE.test(intakeId)) {
      return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
    }

    const detail = await app.withTenant(request.tenantId, async (client) => {
      const f = await client.query<{
        rca_finding_id: string;
        intake_id: string;
        provider: 'bob' | 'mock-bob';
        model_id: string;
        root_cause: string;
        confidence: 'low' | 'medium' | 'high';
        recommended_actions: string[];
        bob_latency_ms: number;
        created_at: Date;
      }>(
        `SELECT rca_finding_id, intake_id, provider, model_id,
                root_cause, confidence,
                recommended_actions, bob_latency_ms, created_at
           FROM rca_findings
          WHERE intake_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [intakeId],
      );
      if (f.rowCount === 0) return null;
      const finding = f.rows[0]!;

      const ev = await client.query<{
        evidence_id: string;
        snippet: string;
        source: 'masked_log' | 'commit_message' | 'commit_diff';
        rank: number;
      }>(
        `SELECT evidence_id, snippet, source, rank
           FROM rca_evidence
          WHERE rca_finding_id = $1
          ORDER BY rank ASC, created_at ASC`,
        [finding.rca_finding_id],
      );

      return { finding, evidence: ev.rows };
    });

    if (!detail) {
      return err(reply, 404, 'rca_not_found', 'no RCA finding for this intake yet');
    }

    const out = RcaDetailV1.parse({
      rca_finding_id: detail.finding.rca_finding_id,
      intake_id: detail.finding.intake_id,
      provider: detail.finding.provider,
      model_id: detail.finding.model_id,
      output: {
        root_cause: detail.finding.root_cause,
        confidence: detail.finding.confidence,
        evidence_snippets: detail.evidence.map((e) => e.snippet),
        recommended_actions: Array.isArray(detail.finding.recommended_actions)
          ? detail.finding.recommended_actions
          : [],
      },
      bob_latency_ms: detail.finding.bob_latency_ms,
      created_at: detail.finding.created_at.toISOString(),
      evidence: detail.evidence.map((e) => ({
        evidence_id: e.evidence_id,
        snippet: e.snippet,
        source: e.source,
        rank: e.rank,
      })),
    });
    return reply.code(200).send(out);
  });
};
