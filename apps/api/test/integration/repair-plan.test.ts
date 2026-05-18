import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-005 Repair Plan
 * (POST + GET /v1/intake/:id/repair-plan).
 *
 * Anchors (per docs/MendoraCI_Traceability.md RT-004):
 *   TEST-012   happy plan with mock-Bob      -> 201
 *   TEST-013   cross-tenant attempt          -> 404 intake_not_found (RLS)
 *   TEST-014   RCA missing                   -> 412 rca_required
 *   NEG x4     invalid intake_id 400, missing tenant 401, validation 422,
 *              GET-before-plan 404 repair_plan_not_found
 *
 * All tests run with USE_MOCK_BOB=true so they're deterministic.
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
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'plan-test' },
  };
}

describe('Repair Plan routes (CP-6 integration, mock-Bob)', () => {
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
    // Wipe in dependency order. Admin pool bypasses RLS.
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

  async function createIntake(tenant: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-plan-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validIntakeBody(),
    });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json().intake_id as string;
  }

  async function createRca(intakeId: string, tenant: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode, res.payload).toBe(201);
  }

  // ---------------------------------------------------------------------------
  // TEST-012 — happy with mock-Bob
  // ---------------------------------------------------------------------------
  it('TEST-012: generates a repair plan after RCA and returns 201', async () => {
    const intakeId = await createIntake(TENANT_A);
    await createRca(intakeId, TENANT_A);

    const plan = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });

    expect(plan.statusCode, plan.payload).toBe(201);
    const j = plan.json();
    expect(j.repair_plan_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.rca_finding_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.intake_id).toBe(intakeId);
    expect(j.provider).toBe('mock-bob');
    expect(j.model_id).toBe('mock-bob-v1');
    expect(typeof j.output.summary).toBe('string');
    expect(['low', 'medium', 'high']).toContain(j.output.overall_risk);
    expect(['XS', 'S', 'M', 'L', 'XL']).toContain(j.output.est_total_effort);
    expect(typeof j.output.rollback_strategy).toBe('string');
    expect(Array.isArray(j.output.steps)).toBe(true);
    expect(j.output.steps.length).toBeGreaterThanOrEqual(1);

    // With OOM + AKIA**** in the masked body, mock-Bob bumps overall_risk=high
    // and inserts a rotation step first.
    expect(j.output.overall_risk).toBe('high');
    expect(j.output.steps[0].title.toLowerCase()).toContain('rotate');
    expect(j.output.steps[0].risk).toBe('high');

    // Each step has the right shape
    for (const s of j.output.steps) {
      expect(typeof s.title).toBe('string');
      expect(typeof s.description).toBe('string');
      expect([
        'code-edit',
        'config-change',
        'infra-change',
        'rollback',
        'investigation',
        'dependency-update',
        'test-add',
        'other',
      ]).toContain(s.type);
      expect(['XS', 'S', 'M', 'L', 'XL']).toContain(s.est_effort);
      expect(['low', 'medium', 'high']).toContain(s.risk);
    }

    // GET round-trip
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(detail.statusCode, detail.payload).toBe(200);
    const d = detail.json();
    expect(d.repair_plan_id).toBe(j.repair_plan_id);
    expect(Array.isArray(d.steps)).toBe(true);
    expect(d.steps.length).toBe(j.output.steps.length);
    expect(d.steps[0].rank).toBe(0);
    expect(d.steps[0].step_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // ---------------------------------------------------------------------------
  // TEST-013 — cross-tenant
  // ---------------------------------------------------------------------------
  it('TEST-013: tenant B cannot generate plan for tenant A intake -> 404', async () => {
    const intakeId = await createIntake(TENANT_A);
    await createRca(intakeId, TENANT_A);

    const attack = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_B, 'content-type': 'application/json' },
      payload: {},
    });
    expect(attack.statusCode, attack.payload).toBe(404);
    expect(attack.json().error.code).toBe('intake_not_found');

    // GET also blocked.
    const get = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(get.statusCode).toBe(404);
    expect(get.json().error.code).toBe('repair_plan_not_found');
  });

  // ---------------------------------------------------------------------------
  // TEST-014 — RCA missing
  // ---------------------------------------------------------------------------
  it('TEST-014: repair plan without prior RCA returns 412 rca_required', async () => {
    const intakeId = await createIntake(TENANT_A);
    // Skip createRca on purpose.

    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode, res.payload).toBe(412);
    expect(res.json().error.code).toBe('rca_required');
  });

  // ---------------------------------------------------------------------------
  // Negative cases
  // ---------------------------------------------------------------------------
  it('NEG-PLAN: invalid intake_id returns 400 invalid_intake_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake/not-a-uuid/repair-plan',
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_intake_id');
  });

  it('NEG-PLAN: missing X-Tenant-Id returns 401', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/repair-plan`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('NEG-PLAN: bad chat_mode returns 422', async () => {
    const intakeId = await createIntake(TENANT_A);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { chat_mode: 'no-such-mode' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_failed');
  });

  it('NEG-PLAN: GET before plan returns 404 repair_plan_not_found', async () => {
    const intakeId = await createIntake(TENANT_A);
    await createRca(intakeId, TENANT_A);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('repair_plan_not_found');
  });

  it('NEG-PLAN: unknown intake returns 404 intake_not_found', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/repair-plan`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('intake_not_found');
  });
});
