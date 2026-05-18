import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import JSZip from 'jszip';

/**
 * Integration tests for API-009 Evidence Export
 * (POST + GET /v1/intake/:id/evidence-export).
 *
 * Anchors (per docs/MendoraCI_Traceability.md RT-006):
 *   TEST-020  happy: full pipeline (intake -> rca -> plan -> submit ->
 *             approve -> export) -> 201 with presigned url + sha256
 *   TEST-021  plan in draft (not approved) -> 412 plan_not_approved
 *   TEST-022  cross-tenant -> 404 intake_not_found (RLS proof)
 *   TEST-023  unknown intake -> 404
 *   NEG x4    bad uuid 400, missing tenant 401, bad ttl 422,
 *             GET before export 404 evidence_not_found
 *
 * All tests run with USE_MOCK_BOB=true.
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_URL = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function validIntakeBody() {
  return {
    provider: 'github',
    run_id: `run-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64(
        'INFO build 4421 starting\nWARN config: AKIAIOSFODNN7EXAMPLE was the secret\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
      ),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'evidence-test' },
  };
}

describe('Evidence Export routes (CP-8 integration)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;
  const prevUseMock = process.env.USE_MOCK_BOB;

  beforeAll(async () => {
    process.env.USE_MOCK_BOB = 'true';
    app = await buildApp(loadConfig());
    await app.ready();
    pool = new pg.Pool({ connectionString: ADMIN_URL });
    await pool.query(
      `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [TENANT_A, 'AcmePilot'],
    );
    await pool.query(
      `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [TENANT_B, 'BetaCorp'],
    );
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM evidence_exports');
    await pool.query('DELETE FROM approvals');
    await pool.query('DELETE FROM repair_steps');
    await pool.query('DELETE FROM repair_plans');
    await pool.query('DELETE FROM rca_evidence');
    await pool.query('DELETE FROM rca_findings');
    await pool.query('DELETE FROM repo_commits');
    await pool.query('DELETE FROM repo_links');
    await pool.query('DELETE FROM idempotency_keys');
    await pool.query('DELETE FROM intake_meta');
    await pool.query('DELETE FROM raw_intake');
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    if (prevUseMock === undefined) delete process.env.USE_MOCK_BOB;
    else process.env.USE_MOCK_BOB = prevUseMock;
  });

  async function fullPipeline(
    tenant: string,
    opts: { approve?: boolean } = { approve: true },
  ): Promise<{ intakeId: string; repairPlanId: string }> {
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-evid-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validIntakeBody(),
    });
    expect(intake.statusCode, intake.payload).toBe(201);
    const intakeId = intake.json().intake_id as string;

    const rca = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(rca.statusCode).toBe(201);

    const plan = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(plan.statusCode).toBe(201);
    const repairPlanId = plan.json().repair_plan_id as string;

    if (opts.approve) {
      const submit = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/submit`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: {},
      });
      expect(submit.statusCode).toBe(200);
      const approve = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/approve`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: { approver: 'alice@acme.test', note: 'approved for export test' },
      });
      expect(approve.statusCode).toBe(200);
    }
    return { intakeId, repairPlanId };
  }

  // ---------------------------------------------------------------------------
  // TEST-020 — happy path
  // ---------------------------------------------------------------------------
  it('TEST-020: exports evidence bundle after approval, returns 201 with presigned URL', async () => {
    const { intakeId, repairPlanId } = await fullPipeline(TENANT_A);

    const exp = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(exp.statusCode, exp.payload).toBe(201);
    const j = exp.json();

    expect(j.evidence_export_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.intake_id).toBe(intakeId);
    expect(j.repair_plan_id).toBe(repairPlanId);
    expect(j.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(j.byte_size).toBeGreaterThan(200); // ZIP overhead alone exceeds this
    expect(j.s3_key).toContain(intakeId);
    expect(j.s3_key.endsWith('.zip')).toBe(true);
    expect(typeof j.presigned_url).toBe('string');
    expect(j.presigned_url.length).toBeGreaterThan(0);

    // Download via the presigned URL using global fetch (Node 22)
    const r = await fetch(j.presigned_url);
    expect(r.status).toBe(200);
    const arr = new Uint8Array(await r.arrayBuffer());
    const downloaded = Buffer.from(arr);
    expect(downloaded.length).toBe(j.byte_size);
    // Recompute sha256 to confirm bit-exact
    const sha = createHash('sha256').update(downloaded).digest('hex');
    expect(sha).toBe(j.sha256);

    // Unzip + verify manifest references the right files
    const zip = await JSZip.loadAsync(downloaded);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(
      [
        'approvals.json',
        'intake_meta.json',
        'manifest.json',
        'masked_log.txt',
        'rca.json',
        'repair_plan.json',
      ].sort(),
    );
    const manifestJson = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifestJson.intake_id).toBe(intakeId);
    expect(manifestJson.repair_plan_id).toBe(repairPlanId);
    expect(manifestJson.mask_policy_version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(Array.isArray(manifestJson.files)).toBe(true);

    // masked_log.txt should NOT contain the original AKIA secret
    const maskedLog = await zip.file('masked_log.txt')!.async('string');
    expect(maskedLog).not.toContain('AKIAIOSFODNN7EXAMPLE');

    // GET round-trip returns the same export + a fresh presigned URL
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(detail.statusCode).toBe(200);
    const d = detail.json();
    expect(d.evidence_export_id).toBe(j.evidence_export_id);
    expect(d.sha256).toBe(j.sha256);
    expect(d.byte_size).toBe(j.byte_size);
    expect(d.manifest.intake_id).toBe(intakeId);
  }, 30_000);

  // ---------------------------------------------------------------------------
  // TEST-021 — plan in draft -> 412
  // ---------------------------------------------------------------------------
  it('TEST-021: export with un-approved plan returns 412 plan_not_approved', async () => {
    const { intakeId } = await fullPipeline(TENANT_A, { approve: false });

    const exp = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(exp.statusCode, exp.payload).toBe(412);
    expect(exp.json().error.code).toBe('plan_not_approved');
    expect(exp.json().error.current_status).toBe('draft');
  });

  // ---------------------------------------------------------------------------
  // TEST-022 — cross-tenant
  // ---------------------------------------------------------------------------
  it('TEST-022: tenant B cannot export tenant A intake -> 404', async () => {
    const { intakeId } = await fullPipeline(TENANT_A);

    const attack = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_B, 'content-type': 'application/json' },
      payload: {},
    });
    expect(attack.statusCode, attack.payload).toBe(404);
    expect(attack.json().error.code).toBe('intake_not_found');

    const get = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(get.statusCode).toBe(404);
    expect(get.json().error.code).toBe('evidence_not_found');
  });

  // ---------------------------------------------------------------------------
  // TEST-023 — unknown intake
  // ---------------------------------------------------------------------------
  it('TEST-023: unknown intake returns 404 intake_not_found', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('intake_not_found');
  });

  // ---------------------------------------------------------------------------
  // NEG cases
  // ---------------------------------------------------------------------------
  it('NEG-EVID: invalid intake_id returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake/not-a-uuid/evidence-export',
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_intake_id');
  });

  it('NEG-EVID: missing X-Tenant-Id returns 401', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/evidence-export`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('NEG-EVID: ttl out of range returns 422', async () => {
    const { intakeId } = await fullPipeline(TENANT_A);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { presigned_ttl_seconds: 1 }, // min is 60
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_failed');
  });

  it('NEG-EVID: GET before export returns 404 evidence_not_found', async () => {
    const { intakeId } = await fullPipeline(TENANT_A);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('evidence_not_found');
  });
});
