/**
 * Evidence Export route — API-009.
 *
 * Anchors:
 *   - RT-006 Evidence Export (BR-006)
 *   - RT-005 Approval gate (must be 'approved' for export; 412 otherwise)
 *   - RT-008 Mask Policy (bundle includes masked body, never raw)
 *   - RT-013 Multi-Tenant Isolation (RLS via withTenant)
 *   - DB-010 evidence_exports
 *
 * Test anchors (per docs/MendoraCI_Traceability.md RT-006):
 *   TEST-020  happy export -> 201 with presigned URL, sha256, byte_size > 0
 *   TEST-021  plan not approved -> 412 plan_not_approved
 *   TEST-022  cross-tenant -> 404 intake_not_found (RLS proof)
 *   TEST-023  unknown intake -> 404 intake_not_found
 *   NEG x4    invalid uuid 400, missing tenant 401, bad ttl 422,
 *             GET-before-export 404 evidence_not_found
 *
 * Endpoints:
 *   POST /v1/intake/:id/evidence-export
 *   GET  /v1/intake/:id/evidence-export  (most recent)
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import {
  EvidenceExportRequestV1,
  EvidenceExportResponseV1,
  EvidenceExportDetailV1,
} from '@mendoraci/shared';
import { EVIDENCE_BUCKET, putObjectBytes, getPresignedGetUrl } from '../lib/s3.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      message: 'request_body_invalid',
      validation_errors: issues.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
        message: String(i.message ?? ''),
      })),
    },
  });
}

function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export const evidenceExportRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // POST /v1/intake/:id/evidence-export
  // ---------------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/intake/:id/evidence-export',
    async (request, reply) => {
      const { id: intakeId } = request.params;
      if (!UUID_RE.test(intakeId)) {
        return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
      }

      const parsed = EvidenceExportRequestV1.safeParse(request.body ?? {});
      if (!parsed.success) return err422Zod(reply, parsed.error.issues);
      const ttl = parsed.data.presigned_ttl_seconds ?? 300;

      // ------- Step 1: load everything we need under tenant RLS ----------------
      const ctx = await app.withTenant(request.tenantId, async (client) => {
        // 1a. Intake + masked body + meta
        const intake = await client.query<{
          intake_id: string;
          body_masked: string;
          mask_policy_version: string;
          provider: string;
          run_id: string;
          attempt_id: string;
          branch: string | null;
          commit_sha: string | null;
          actor: string | null;
        }>(
          `SELECT m.intake_id, r.body_masked, r.mask_policy_version,
                  m.provider, m.run_id, m.attempt_id, m.branch, m.commit_sha, m.actor
             FROM intake_meta m
             JOIN raw_intake  r ON r.intake_id = m.intake_id
            WHERE m.intake_id = $1
            LIMIT 1`,
          [intakeId],
        );
        if (intake.rowCount === 0) return { kind: 'no_intake' as const };

        // 1b. RCA finding + evidence
        const rca = await client.query<{
          rca_finding_id: string;
          provider: string;
          model_id: string;
          root_cause: string;
          confidence: string;
          recommended_actions: string[];
          bob_latency_ms: number;
          created_at: Date;
        }>(
          `SELECT rca_finding_id, provider, model_id, root_cause, confidence,
                  recommended_actions, bob_latency_ms, created_at
             FROM rca_findings
            WHERE intake_id = $1
            ORDER BY created_at DESC LIMIT 1`,
          [intakeId],
        );
        if (rca.rowCount === 0) return { kind: 'no_rca' as const };

        const evidence = await client.query<{ snippet: string; source: string; rank: number }>(
          `SELECT snippet, source, rank FROM rca_evidence
            WHERE rca_finding_id = $1 ORDER BY rank ASC`,
          [rca.rows[0]!.rca_finding_id],
        );

        // 1c. Repair plan + steps + status check
        const plan = await client.query<{
          repair_plan_id: string;
          status: string;
          summary: string;
          overall_risk: string;
          rollback_strategy: string;
          est_total_effort: string;
          provider: string;
          model_id: string;
          created_at: Date;
        }>(
          `SELECT repair_plan_id, status, summary, overall_risk, rollback_strategy,
                  est_total_effort, provider, model_id, created_at
             FROM repair_plans
            WHERE intake_id = $1
            ORDER BY created_at DESC LIMIT 1`,
          [intakeId],
        );
        if (plan.rowCount === 0) return { kind: 'no_plan' as const };
        if (plan.rows[0]!.status !== 'approved') {
          return { kind: 'not_approved' as const, status: plan.rows[0]!.status };
        }

        const steps = await client.query<{
          step_id: string;
          rank: number;
          title: string;
          description: string;
          step_type: string;
          files: string[];
          est_effort: string;
          risk: string;
        }>(
          `SELECT step_id, rank, title, description, step_type, files, est_effort, risk
             FROM repair_steps WHERE repair_plan_id = $1 ORDER BY rank ASC`,
          [plan.rows[0]!.repair_plan_id],
        );

        // 1d. Approvals audit
        const approvals = await client.query<{
          approval_id: string;
          action: string;
          prior_status: string;
          new_status: string;
          actor: string;
          note: string | null;
          step_decisions: unknown[];
          created_at: Date;
        }>(
          `SELECT approval_id, action, prior_status, new_status, actor, note,
                  step_decisions, created_at
             FROM approvals WHERE repair_plan_id = $1 ORDER BY created_at ASC`,
          [plan.rows[0]!.repair_plan_id],
        );

        return {
          kind: 'ok' as const,
          intake: intake.rows[0]!,
          rca: rca.rows[0]!,
          evidence: evidence.rows,
          plan: plan.rows[0]!,
          steps: steps.rows,
          approvals: approvals.rows,
        };
      });

      if (ctx.kind === 'no_intake') {
        return err(reply, 404, 'intake_not_found', 'no intake found for this id');
      }
      if (ctx.kind === 'no_rca') {
        return err(reply, 412, 'rca_required', 'no RCA finding for this intake');
      }
      if (ctx.kind === 'no_plan') {
        return err(reply, 412, 'plan_required', 'no repair plan for this intake');
      }
      if (ctx.kind === 'not_approved') {
        return err(
          reply,
          412,
          'plan_not_approved',
          `repair plan is in status ${ctx.status}; only approved plans can be exported`,
          { current_status: ctx.status },
        );
      }

      // ------- Step 2: build the ZIP in memory -------------------------------
      const generatedAt = new Date().toISOString();
      const files: Array<{ path: string; bytes: Buffer; contentType: string }> = [];

      // masked_log.txt — the masked log body
      const maskedBody = Buffer.from(ctx.intake.body_masked, 'utf8');
      files.push({ path: 'masked_log.txt', bytes: maskedBody, contentType: 'text/plain' });

      // rca.json
      const rcaPayload = {
        rca_finding_id: ctx.rca.rca_finding_id,
        provider: ctx.rca.provider,
        model_id: ctx.rca.model_id,
        root_cause: ctx.rca.root_cause,
        confidence: ctx.rca.confidence,
        recommended_actions: Array.isArray(ctx.rca.recommended_actions)
          ? ctx.rca.recommended_actions
          : [],
        bob_latency_ms: ctx.rca.bob_latency_ms,
        evidence: ctx.evidence.map((e) => ({ snippet: e.snippet, source: e.source, rank: e.rank })),
        created_at: ctx.rca.created_at.toISOString(),
      };
      files.push({
        path: 'rca.json',
        bytes: Buffer.from(JSON.stringify(rcaPayload, null, 2), 'utf8'),
        contentType: 'application/json',
      });

      // repair_plan.json
      const planPayload = {
        repair_plan_id: ctx.plan.repair_plan_id,
        status: ctx.plan.status,
        provider: ctx.plan.provider,
        model_id: ctx.plan.model_id,
        summary: ctx.plan.summary,
        overall_risk: ctx.plan.overall_risk,
        rollback_strategy: ctx.plan.rollback_strategy,
        est_total_effort: ctx.plan.est_total_effort,
        steps: ctx.steps.map((s) => ({
          step_id: s.step_id,
          rank: s.rank,
          title: s.title,
          description: s.description,
          type: s.step_type,
          files: Array.isArray(s.files) ? s.files : [],
          est_effort: s.est_effort,
          risk: s.risk,
        })),
        created_at: ctx.plan.created_at.toISOString(),
      };
      files.push({
        path: 'repair_plan.json',
        bytes: Buffer.from(JSON.stringify(planPayload, null, 2), 'utf8'),
        contentType: 'application/json',
      });

      // approvals.json
      const approvalsPayload = ctx.approvals.map((a) => ({
        approval_id: a.approval_id,
        action: a.action,
        prior_status: a.prior_status,
        new_status: a.new_status,
        actor: a.actor,
        note: a.note,
        step_decisions: Array.isArray(a.step_decisions) ? a.step_decisions : [],
        created_at: a.created_at.toISOString(),
      }));
      files.push({
        path: 'approvals.json',
        bytes: Buffer.from(JSON.stringify(approvalsPayload, null, 2), 'utf8'),
        contentType: 'application/json',
      });

      // intake_meta.json
      const metaPayload = {
        intake_id: ctx.intake.intake_id,
        mask_policy_version: ctx.intake.mask_policy_version,
        provider: ctx.intake.provider,
        run_id: ctx.intake.run_id,
        attempt_id: ctx.intake.attempt_id,
        branch: ctx.intake.branch,
        commit_sha: ctx.intake.commit_sha,
        actor: ctx.intake.actor,
      };
      files.push({
        path: 'intake_meta.json',
        bytes: Buffer.from(JSON.stringify(metaPayload, null, 2), 'utf8'),
        contentType: 'application/json',
      });

      // manifest.json — last so it can sha-sum the other files
      const manifest = {
        intake_id: ctx.intake.intake_id,
        repair_plan_id: ctx.plan.repair_plan_id,
        mask_policy_version: ctx.intake.mask_policy_version,
        files: files.map((f) => ({
          path: f.path,
          sha256: sha256Hex(f.bytes),
          byte_size: f.bytes.length,
        })),
        generated_at: generatedAt,
      };
      const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');

      const zip = new JSZip();
      for (const f of files) zip.file(f.path, f.bytes);
      zip.file('manifest.json', manifestBytes);
      const zipBytes = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const zipSha256 = sha256Hex(zipBytes);

      // ------- Step 3: insert row, upload to MinIO, then update s3_key -------
      const persisted = await app.withTenant(request.tenantId, async (client) => {
        const ins = await client.query<{ evidence_export_id: string; created_at: Date }>(
          `INSERT INTO evidence_exports
             (intake_id, repair_plan_id, tenant_id, s3_bucket, s3_key, sha256, byte_size, manifest)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           RETURNING evidence_export_id, created_at`,
          [
            ctx.intake.intake_id,
            ctx.plan.repair_plan_id,
            request.tenantId,
            EVIDENCE_BUCKET,
            'pending',
            zipSha256,
            zipBytes.length,
            JSON.stringify(manifest),
          ],
        );
        return {
          evidenceExportId: ins.rows[0]!.evidence_export_id,
          createdAt: ins.rows[0]!.created_at,
        };
      });

      const s3Key = `${request.tenantId}/${ctx.intake.intake_id}/${persisted.evidenceExportId}.zip`;
      try {
        await putObjectBytes({
          bucket: EVIDENCE_BUCKET,
          key: s3Key,
          body: zipBytes,
          contentType: 'application/zip',
          metadata: {
            'intake-id': ctx.intake.intake_id,
            'repair-plan-id': ctx.plan.repair_plan_id,
            sha256: zipSha256,
          },
        });
      } catch (e) {
        await app.withTenant(request.tenantId, async (client) => {
          await client.query(`DELETE FROM evidence_exports WHERE evidence_export_id = $1`, [
            persisted.evidenceExportId,
          ]);
        });
        return err(reply, 503, 's3_unavailable', `upload to ${EVIDENCE_BUCKET} failed: ${(e as Error).message}`);
      }

      await app.withTenant(request.tenantId, async (client) => {
        await client.query(
          `UPDATE evidence_exports SET s3_key = $1 WHERE evidence_export_id = $2`,
          [s3Key, persisted.evidenceExportId],
        );
      });

      const presignedUrl = await getPresignedGetUrl({
        bucket: EVIDENCE_BUCKET,
        key: s3Key,
        expiresInSeconds: ttl,
      });
      const presignedExpiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      const envelope = EvidenceExportResponseV1.parse({
        evidence_export_id: persisted.evidenceExportId,
        intake_id: ctx.intake.intake_id,
        repair_plan_id: ctx.plan.repair_plan_id,
        s3_key: s3Key,
        sha256: zipSha256,
        byte_size: zipBytes.length,
        presigned_url: presignedUrl,
        presigned_expires_at: presignedExpiresAt,
        created_at: persisted.createdAt.toISOString(),
      });
      return reply.code(201).send(envelope);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/intake/:id/evidence-export — most recent export + manifest
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string }; Querystring: { ttl?: string } }>(
    '/intake/:id/evidence-export',
    async (request, reply) => {
      const { id: intakeId } = request.params;
      if (!UUID_RE.test(intakeId)) {
        return err(reply, 400, 'invalid_intake_id', 'intake_id must be a UUID');
      }
      let ttl = 300;
      if (request.query?.ttl !== undefined) {
        const t = Number(request.query.ttl);
        if (!Number.isFinite(t) || t < 60 || t > 3600) {
          return err(reply, 400, 'invalid_ttl', 'ttl must be 60..3600 seconds');
        }
        ttl = Math.trunc(t);
      }

      const row = await app.withTenant(request.tenantId, async (client) => {
        const r = await client.query<{
          evidence_export_id: string;
          intake_id: string;
          repair_plan_id: string;
          s3_bucket: string;
          s3_key: string;
          sha256: string;
          byte_size: string;
          manifest: any;
          created_at: Date;
        }>(
          `SELECT evidence_export_id, intake_id, repair_plan_id, s3_bucket, s3_key,
                  sha256, byte_size, manifest, created_at
             FROM evidence_exports
            WHERE intake_id = $1
            ORDER BY created_at DESC LIMIT 1`,
          [intakeId],
        );
        return r.rowCount === 0 ? null : r.rows[0]!;
      });

      if (!row) {
        return err(reply, 404, 'evidence_not_found', 'no evidence export for this intake yet');
      }

      const presignedUrl = await getPresignedGetUrl({
        bucket: row.s3_bucket,
        key: row.s3_key,
        expiresInSeconds: ttl,
      });
      const presignedExpiresAt = new Date(Date.now() + ttl * 1000).toISOString();

      const out = EvidenceExportDetailV1.parse({
        evidence_export_id: row.evidence_export_id,
        intake_id: row.intake_id,
        repair_plan_id: row.repair_plan_id,
        s3_key: row.s3_key,
        sha256: row.sha256,
        byte_size: Number(row.byte_size),
        presigned_url: presignedUrl,
        presigned_expires_at: presignedExpiresAt,
        created_at: row.created_at.toISOString(),
        manifest: row.manifest,
      });
      return reply.code(200).send(out);
    },
  );
};
