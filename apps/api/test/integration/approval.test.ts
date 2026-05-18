import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-006..API-008 (submit/approve/reject) + GET log.
 *
 * Anchors (per docs/MendoraCI_Traceability.md RT-005):
 *   TEST-015  draft -> submit      -> 200 status submitted, 1 audit row
 *   TEST-016  submitted -> approve -> 200 status approved,  2 audit rows
 *   TEST-017  submitted -> reject  -> 200 status rejected,  2 audit rows
 *   TEST-018  invalid transition (approve from draft) -> 409 invalid_transition
 *   TEST-019  cross-tenant -> 404 repair_plan_not_found (RLS on repair_plans)
 *   NEG x5    invalid uuid 400, missing tenant 401, validation 422,
 *             audit log GET returns ordered entries, double-approve 409
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
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'approval-test' },
  };
}

describe('Approval workflow routes (CP-7 integration)', () => {
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

  async function makePlan(tenant: string): Promise<{ intakeId: string; repairPlanId: string }> {
    // Intake
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-app-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validIntakeBody(),
    });
    expect(intake.statusCode, intake.payload).toBe(201);
    const intakeId = intake.json().intake_id as string;

    // RCA
    const rca = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/rca`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(rca.statusCode, rca.payload).toBe(201);

    // Repair Plan
    const plan = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/repair-plan`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(plan.statusCode, plan.payload).toBe(201);
    return { intakeId, repairPlanId: plan.json().repair_plan_id as string };
  }

  // ---------------------------------------------------------------------------
  // TEST-015 — draft -> submit
  // ---------------------------------------------------------------------------
  it('TEST-015: submitting a draft plan returns 200 and moves to submitted', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { note: 'ready for review' },
    });
    expect(res.statusCode, res.payload).toBe(200);
    const j = res.json();
    expect(j.prior_status).toBe('draft');
    expect(j.new_status).toBe('submitted');
    expect(j.action).toBe('submit');
    expect(j.approval_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.actor).toBe('system');

    // Audit log has exactly 1 row
    const log = await app.inject({
      method: 'GET',
      url: `/v1/repair-plan/${repairPlanId}/approvals`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(log.statusCode).toBe(200);
    const lj = log.json();
    expect(lj.current_status).toBe('submitted');
    expect(lj.entries).toHaveLength(1);
    expect(lj.entries[0].action).toBe('submit');
    expect(lj.entries[0].new_status).toBe('submitted');
  });

  // ---------------------------------------------------------------------------
  // TEST-016 — submitted -> approve
  // ---------------------------------------------------------------------------
  it('TEST-016: approving a submitted plan returns 200 and writes 2 audit rows', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);

    const sub = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(sub.statusCode).toBe(200);

    const app1 = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'alice@acme.test', note: 'looks good' },
    });
    expect(app1.statusCode, app1.payload).toBe(200);
    const j = app1.json();
    expect(j.prior_status).toBe('submitted');
    expect(j.new_status).toBe('approved');
    expect(j.action).toBe('approve');
    expect(j.actor).toBe('alice@acme.test');

    const log = await app.inject({
      method: 'GET',
      url: `/v1/repair-plan/${repairPlanId}/approvals`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    const lj = log.json();
    expect(lj.current_status).toBe('approved');
    expect(lj.entries).toHaveLength(2);
    expect(lj.entries.map((e: any) => e.action)).toEqual(['submit', 'approve']);
  });

  // ---------------------------------------------------------------------------
  // TEST-017 — submitted -> reject
  // ---------------------------------------------------------------------------
  it('TEST-017: rejecting a submitted plan returns 200 and writes 2 audit rows', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);

    await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/reject`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'bob@acme.test', reason: 'risk too high; revisit' },
    });
    expect(res.statusCode, res.payload).toBe(200);
    expect(res.json().new_status).toBe('rejected');

    const log = await app.inject({
      method: 'GET',
      url: `/v1/repair-plan/${repairPlanId}/approvals`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(log.json().current_status).toBe('rejected');
    expect(log.json().entries).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // TEST-018 — invalid transition: approve from draft -> 409
  // ---------------------------------------------------------------------------
  it('TEST-018: approving a draft plan returns 409 invalid_transition', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'alice@acme.test' },
    });
    expect(res.statusCode, res.payload).toBe(409);
    const j = res.json();
    expect(j.error.code).toBe('invalid_transition');
    expect(j.error.prior_status).toBe('draft');
    expect(j.error.attempted_action).toBe('approve');
  });

  it('TEST-018b: double-approve returns 409 invalid_transition', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);
    await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'alice' },
    });
    const dup = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'alice' },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.prior_status).toBe('approved');
  });

  // ---------------------------------------------------------------------------
  // TEST-019 — cross-tenant: tenant B cannot submit/approve tenant A plan
  // ---------------------------------------------------------------------------
  it('TEST-019: tenant B cannot transition tenant A repair plan -> 404', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);

    const attack = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_B, 'content-type': 'application/json' },
      payload: {},
    });
    expect(attack.statusCode, attack.payload).toBe(404);
    expect(attack.json().error.code).toBe('repair_plan_not_found');

    // GET log also blocked
    const log = await app.inject({
      method: 'GET',
      url: `/v1/repair-plan/${repairPlanId}/approvals`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(log.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Negative cases
  // ---------------------------------------------------------------------------
  it('NEG-APP: invalid repair_plan_id returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/repair-plan/not-a-uuid/submit',
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_repair_plan_id');
  });

  it('NEG-APP: missing X-Tenant-Id returns 401', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${ghost}/submit`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('NEG-APP: approve without approver returns 422', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);
    await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_failed');
  });

  it('NEG-APP: reject without reason returns 422', async () => {
    const { repairPlanId } = await makePlan(TENANT_A);
    await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/reject`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { approver: 'bob' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('NEG-APP: GET unknown plan returns 404', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'GET',
      url: `/v1/repair-plan/${ghost}/approvals`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('repair_plan_not_found');
  });
});
