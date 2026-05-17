/**
 * Intake routes — API-001 POST /intake and API-002 GET /intake/:id.
 *
 * Anchors:
 *   - RT-001 CI Log Intake (BR-001)
 *   - RT-008 Mask Policy v1 pre-persist (BR-008) — mandatory, fail-closed
 *   - RT-015 Idempotency & Replay — Idempotency-Key header required
 *   - DB-001 raw_intake, DB-002 intake_meta, idempotency_keys
 *
 * Test anchors:
 *   - TEST-001 happy path  - p95 <= 5s ingest
 *   - TEST-001-A idempotency replay - 0 duplicates
 *   - TEST-002 schema validation - 422 on invalid
 *   - TEST-003 unsigned/missing tenant - 401 (via tenant-context middleware)
 *   - TEST-004 oversized payload - 413
 *   - TEST-015 missing idempotency-key - 400
 *   - TEST-024 mask engine failure - 500 mask_engine_failure (via error handler)
 *
 * DESIGN NOTE (CP-2c-5): all client errors here are returned via explicit
 * `reply.code(N).send({error:{code,message}})` to remove any dependency on
 * Fastify error-handler propagation paths. The setErrorHandler is still
 * registered as a safety net for unexpected throws (DB errors, mask blocks).
 */
import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  IntakeRequestV1,
  IntakeResponseV1,
  IntakeDetailV1,
  MAX_ARTIFACT_BYTES,
  type IntakeStatus,
} from '@mendoraci/shared';
import { applyMaskOrThrow } from '@mendoraci/mask-policy';

const IDEMPOTENCY_WINDOW_SECONDS = 24 * 60 * 60; // 24h dedupe per spec

function decodeArtifactBody(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function err400(reply: any, code: string, message: string) {
  return reply.code(400).type('application/json').send({ error: { code, message } });
}
function err413(reply: any, code: string, message: string) {
  return reply.code(413).type('application/json').send({ error: { code, message } });
}
function err422Zod(reply: any, issues: ReadonlyArray<{ path: (string | number)[]; message: string }>) {
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
function err404(reply: any, code: string, message: string) {
  return reply.code(404).type('application/json').send({ error: { code, message } });
}

export const intakeRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // API-001 POST /intake
  // ---------------------------------------------------------------------------
  app.post('/intake', async (request, reply) => {
    // -- 1. Idempotency-Key REQUIRED for writes (RT-015 / TEST-015)
    const idemKeyRaw = request.headers['idempotency-key'];
    const idemKey = Array.isArray(idemKeyRaw) ? idemKeyRaw[0] : idemKeyRaw;
    if (!idemKey || typeof idemKey !== 'string' || idemKey.length < 8 || idemKey.length > 256) {
      return err400(reply, 'idempotency_key_required', 'Idempotency-Key header is required (8-256 chars)');
    }

    // -- 2. Schema validation (TEST-002) — safeParse so we hand a typed ZodError shape
    const parseResult = IntakeRequestV1.safeParse(request.body);
    if (!parseResult.success) {
      return err422Zod(reply, parseResult.error.issues);
    }
    const parsed = parseResult.data;

    // -- 3. Decode + 50 MB cap (TEST-004)
    const bodyBuf = decodeArtifactBody(parsed.artifact.body_base64);
    if (bodyBuf.length > MAX_ARTIFACT_BYTES) {
      return err413(reply, 'artifact_exceeds_50mb', 'artifact body exceeds the 50 MB limit');
    }
    const bodyRaw = bodyBuf.toString('utf8');

    // -- 4. Mask BEFORE persist (RT-008 / BR-008 / TEST-024). MaskBlockedError → handler → 500
    const masked = await applyMaskOrThrow(bodyRaw);

    const intakeId = randomUUID();
    const receivedAt = new Date().toISOString();

    // -- 5. DB write with RLS tenant context
    const result = await app.withTenant(request.tenantId, async (client) => {
      const dedupeKey = `${parsed.provider}:${parsed.run_id}:${parsed.attempt_id}`;

      // Check active dedupe row first (avoid INSERT-then-detect race)
      const existing = await client.query<{ intake_id: string; status: IntakeStatus; received_at: Date }>(
        `SELECT m.intake_id, m.status, m.received_at
         FROM idempotency_keys k
         JOIN intake_meta m ON m.intake_id = k.intake_id
         WHERE k.tenant_id = $1 AND k.dedupe_key = $2 AND k.expires_at > NOW()
         LIMIT 1`,
        [request.tenantId, dedupeKey],
      );
      if (existing.rowCount && existing.rows[0]) {
        const row = existing.rows[0];
        return {
          intake_id: row.intake_id,
          status: row.status,
          mask_policy_version: masked.policyVersion,
          received_at: row.received_at.toISOString(),
          replay: true as const,
        };
      }

      // Fresh insert: raw_intake + intake_meta + idempotency_keys
      await client.query(
        `INSERT INTO raw_intake (intake_id, tenant_id, body_masked, mask_policy_version, received_at,
                                 provider, size_bytes, lineage_chain)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          intakeId,
          request.tenantId,
          masked.masked,
          masked.policyVersion,
          receivedAt,
          parsed.provider,
          bodyBuf.length,
          JSON.stringify({ intake_id: intakeId }),
        ],
      );

      await client.query(
        `INSERT INTO intake_meta (intake_id, tenant_id, provider, run_id, attempt_id,
                                  repo_url, branch, commit_sha, actor,
                                  size_bytes, received_at, status, input_sha256, output_sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          intakeId,
          request.tenantId,
          parsed.provider,
          parsed.run_id,
          parsed.attempt_id,
          parsed.repo_url ?? null,
          parsed.metadata?.branch ?? null,
          parsed.metadata?.commit_sha ?? null,
          parsed.metadata?.actor ?? null,
          bodyBuf.length,
          receivedAt,
          'masked' satisfies IntakeStatus,
          masked.inputSha256,
          masked.outputSha256,
        ],
      );

      await client.query(
        `INSERT INTO idempotency_keys (tenant_id, idempotency_key, dedupe_key, intake_id, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${IDEMPOTENCY_WINDOW_SECONDS} seconds')`,
        [request.tenantId, idemKey, dedupeKey, intakeId],
      );

      return {
        intake_id: intakeId,
        status: 'masked' satisfies IntakeStatus,
        mask_policy_version: masked.policyVersion,
        received_at: receivedAt,
        replay: false as const,
      };
    });

    const response = IntakeResponseV1.parse({
      intake_id: result.intake_id,
      status: result.status,
      mask_policy_version: result.mask_policy_version,
      received_at: result.received_at,
    });

    return reply.code(result.replay ? 200 : 201).send(response);
  });

  // ---------------------------------------------------------------------------
  // API-002 GET /intake/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/intake/:id', async (request, reply) => {
    const { id } = request.params;
    if (!UUID_RE.test(id)) {
      return err400(reply, 'invalid_intake_id', 'intake_id must be a UUID');
    }

    const detail = await app.withTenant(request.tenantId, async (client) => {
      const r = await client.query<{
        intake_id: string;
        status: IntakeStatus;
        body_masked: string;
        mask_policy_version: string;
        provider: string;
        run_id: string;
        attempt_id: string;
        branch: string | null;
        commit_sha: string | null;
        actor: string | null;
        size_bytes: number;
        received_at: Date;
        lineage_chain: Record<string, string>;
      }>(
        `SELECT m.intake_id, m.status, r.body_masked, r.mask_policy_version,
                m.provider, m.run_id, m.attempt_id, m.branch, m.commit_sha, m.actor,
                m.size_bytes, m.received_at, r.lineage_chain
         FROM intake_meta m
         JOIN raw_intake  r ON r.intake_id = m.intake_id
         WHERE m.intake_id = $1
         LIMIT 1`,
        [id],
      );
      return r.rows[0] ?? null;
    });

    if (!detail) {
      return err404(reply, 'intake_not_found', 'no intake found for this id');
    }

    const preview = detail.body_masked.slice(0, 4096);

    const out = IntakeDetailV1.parse({
      intake_id: detail.intake_id,
      status: detail.status,
      body_masked_preview: preview,
      intake_meta: {
        provider: detail.provider,
        run_id: detail.run_id,
        attempt_id: detail.attempt_id,
        branch: detail.branch,
        commit_sha: detail.commit_sha,
        actor: detail.actor,
        size_bytes: Number(detail.size_bytes),
        received_at: detail.received_at.toISOString(),
      },
      lineage_chain: detail.lineage_chain ?? {},
      mask_policy_version: detail.mask_policy_version,
    });

    return reply.code(200).send(out);
  });
};
