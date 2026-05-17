import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-004 RCA (POST + GET /v1/intake/:id/rca).
 *
 * Anchors (per docs/MendoraCI_Traceability.md RT-003):
 *   TEST-008    happy RCA with mock-Bob       -> 201
 *   TEST-009    cross-tenant attempt          -> 404 intake_not_found (RLS)
 *   TEST-010    unknown intake                -> 404
 *   TEST-011    empty masked body             -> 412 mask_preview_unavailable
 *   NEG x4      invalid intake_id 400, missing tenant 401, validation 422,
 *               GET-before-RCA 404 rca_not_found
 *
 * All tests run with USE_MOCK_BOB=true so they're deterministic and don't
 * burn real IBM Bob tokens. Real Bob is verified separately by the smoke
 * test scripts/bob_container_smoke.sh.
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
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'rca-test' },
  };
}

describe('RCA routes (CP-5 integration, mock-Bob)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;
  const prevUseMock = process.env.USE_MOCK_BOB;

  beforeAll(async () => {
    // Force mock-Bob for deterministic tests regardless of container env.
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
    // Wipe in dependency order. Admin pool bypasses RLS.
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

  async function createIntake(tenant: string, body = validIntakeBody()): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-rca-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: body,
    });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json().intake_id as string;
  }

  // ---------------------------------------------------------------------------
  // TEST-008 — happy with mock-Bob
  // ---------------------------------------------------------------------------
  it('TEST-008: runs RCA via mock-Bob and returns 201 with structured output', async () => {
    const intakeId = await createIntake(TENANT_A);

    const rca = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });

    expect(rca.statusCode, rca.payload).toBe(201);
    const j = rca.json();
    expect(j.rca_finding_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.intake_id).toBe(intakeId);
    expect(j.provider).toBe('mock-bob');
    expect(j.model_id).toBe('mock-bob-v1');
    expect(j.output.root_cause).toMatch(/out-of-memory|memory/i);
    expect(j.output.confidence).toBe('high');
    expect(Array.isArray(j.output.evidence_snippets)).toBe(true);
    expect(j.output.evidence_snippets.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(j.output.recommended_actions)).toBe(true);
    expect(j.output.recommended_actions.length).toBeGreaterThanOrEqual(1);
    // mock-Bob should flag the AKIA**** masked key as a security action
    expect(j.output.recommended_actions.join(' ')).toMatch(/AKIA|aws/i);
    expect(typeof j.bob_latency_ms).toBe('number');
    expect(j.bob_latency_ms).toBeGreaterThanOrEqual(0);

    // GET round-trip
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(detail.statusCode, detail.payload).toBe(200);
    const d = detail.json();
    expect(d.rca_finding_id).toBe(j.rca_finding_id);
    expect(d.output.root_cause).toBe(j.output.root_cause);
    expect(d.evidence).toHaveLength(j.output.evidence_snippets.length);
    // evidence rank starts at 0
    expect(d.evidence[0].rank).toBe(0);
    expect(d.evidence[0].source).toBe('masked_log');
  });

  // ---------------------------------------------------------------------------
  // TEST-009 — cross-tenant: tenant B cannot RCA tenant A's intake
  // ---------------------------------------------------------------------------
  it('TEST-009: tenant B cannot RCA tenant A intake -> 404 intake_not_found', async () => {
    const intakeId = await createIntake(TENANT_A);

    const attack = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_B, 'content-type': 'application/json' },
      payload: {},
    });
    expect(attack.statusCode, attack.payload).toBe(404);
    expect(attack.json().error.code).toBe('intake_not_found');

    // GET also blocked (RLS hides the intake itself, so the finding is unreachable)
    const get = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(get.statusCode).toBe(404);
    expect(get.json().error.code).toBe('rca_not_found');
  });

  // ---------------------------------------------------------------------------
  // TEST-010 — unknown intake -> 404
  // ---------------------------------------------------------------------------
  it('TEST-010: unknown intake returns 404 intake_not_found', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/rca`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('intake_not_found');
  });

  // ---------------------------------------------------------------------------
  // TEST-011 — empty masked body -> 412 precondition
  // ---------------------------------------------------------------------------
  it('TEST-011: intake with empty masked body returns 412', async () => {
    const intakeId = await createIntake(TENANT_A);
    // Clear out the masked body directly to simulate a degraded upstream.
    // Admin pool bypasses RLS for this setup-only update.
    await pool.query(`UPDATE raw_intake SET body_masked = '' WHERE intake_id = $1`, [intakeId]);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode, res.payload).toBe(412);
    expect(res.json().error.code).toBe('mask_preview_unavailable');
  });

  // ---------------------------------------------------------------------------
  // Negative cases
  // ---------------------------------------------------------------------------
  it('NEG-RCA: invalid intake_id returns 400 invalid_intake_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake/not-a-uuid/rca',
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_intake_id');
  });

  it('NEG-RCA: missing X-Tenant-Id returns 401', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/rca`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('NEG-RCA: bad chat_mode returns 422 validation_failed', async () => {
    const intakeId = await createIntake(TENANT_A);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { chat_mode: 'no-such-mode' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_failed');
  });

  it('NEG-RCA: GET on intake with no RCA yet returns 404 rca_not_found', async () => {
    const intakeId = await createIntake(TENANT_A);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('rca_not_found');
  });
});
