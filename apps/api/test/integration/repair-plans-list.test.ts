import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-012 GET /v1/repair-plans (CP-9.1e).
 *
 *   TEST-LST-PLAN-1 happy paginate (3 pages with limit=2 over 5 plans)
 *   TEST-LST-PLAN-2 filter by status=approved
 *   TEST-LST-PLAN-3 filter by overall_risk=medium
 *   TEST-LST-PLAN-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-PLAN-5 invalid cursor returns 400 invalid_cursor
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_URL = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function intakeBody(suffix = '') {
  return {
    provider: 'github',
    run_id: `lst-plan-${suffix}-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64(
        'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
      ),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'lst-plan-test' },
  };
}

describe('Repair plans List route (CP-9.1e integration)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;

  beforeAll(async () => {
    process.env.USE_MOCK_BOB = 'true';
    app = await buildApp(loadConfig());
    await app.ready();
    pool = new pg.Pool({ connectionString: ADMIN_URL });
    await pool.query(
      `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [TENANT_A, 'AcmePilot'],
    );
    await pool.query(
      `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
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
  });

  async function createPlan(
    tenant: string,
    opts: { suffix?: string; approve?: boolean } = {},
  ): Promise<{ intakeId: string; repairPlanId: string }> {
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-lst-plan-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: intakeBody(opts.suffix ?? ''),
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
      const sub = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/submit`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: {},
      });
      expect(sub.statusCode).toBe(200);
      const app1 = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/approve`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: { approver: 'a@x.test' },
      });
      expect(app1.statusCode).toBe(200);
    }
    return { intakeId, repairPlanId };
  }

  // -------------------------------------------------------------------------
  it('TEST-LST-PLAN-1: paginates with limit=2 over 5 plans; 3 pages', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { repairPlanId } = await createPlan(TENANT_A, { suffix: `pg-${i}` });
      ids.add(repairPlanId);
      await new Promise((r) => setTimeout(r, 2));
    }

    const p1 = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?limit=2',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p1.statusCode).toBe(200);
    const j1 = p1.json();
    expect(j1.items.length).toBe(2);
    expect(j1.next_cursor).toBeTruthy();

    const p2 = await app.inject({
      method: 'GET',
      url: `/v1/repair-plans?limit=2&cursor=${encodeURIComponent(j1.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p2.statusCode).toBe(200);
    const j2 = p2.json();
    expect(j2.items.length).toBe(2);

    const p3 = await app.inject({
      method: 'GET',
      url: `/v1/repair-plans?limit=2&cursor=${encodeURIComponent(j2.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p3.statusCode).toBe(200);
    const j3 = p3.json();
    expect(j3.items.length).toBe(1);
    expect(j3.next_cursor).toBeNull();

    const seen = [...j1.items, ...j2.items, ...j3.items].map(
      (r: { repair_plan_id: string }) => r.repair_plan_id,
    );
    expect(new Set(seen).size).toBe(5);
    seen.forEach((id) => expect(ids.has(id)).toBe(true));

    [...j1.items, ...j2.items, ...j3.items].forEach((row: any) => {
      expect(row.status).toBe('draft');
      expect(typeof row.step_count).toBe('number');
      expect(row.step_count).toBeGreaterThan(0);
      expect(row.intake_provider).toBe('github');
    });
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-PLAN-2: filters by status=approved', async () => {
    const approved = await createPlan(TENANT_A, { suffix: 'a', approve: true });
    await createPlan(TENANT_A, { suffix: 'd1' });
    await createPlan(TENANT_A, { suffix: 'd2' });

    const r = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?status=approved',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].repair_plan_id).toBe(approved.repairPlanId);
    expect(j.items[0].status).toBe('approved');
    expect(j.items[0].last_approval_action).toBe('approve');
    expect(j.items[0].last_approval_actor).toBe('a@x.test');
    expect(j.items[0].last_approval_at).toBeTruthy();

    // status=draft returns the other 2
    const r2 = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?status=draft',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().items.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-PLAN-3: filters by overall_risk (mock-Bob default)', async () => {
    // Mock-Bob default plan output has overall_risk='medium'. Create 2 plans
    // and verify filter matches.
    await createPlan(TENANT_A, { suffix: 'r1' });
    await createPlan(TENANT_A, { suffix: 'r2' });

    const r = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?overall_risk=medium',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(2);
    j.items.forEach((row: any) => expect(row.overall_risk).toBe('medium'));

    // overall_risk=high returns 0
    const r2 = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?overall_risk=high',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().items.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-PLAN-4: tenant B cannot see tenant A plans (RLS)', async () => {
    await createPlan(TENANT_A, { suffix: 'a1' });
    await createPlan(TENANT_A, { suffix: 'a2' });

    const r = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(0);
    expect(j.next_cursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-PLAN-5: malformed cursor returns 400 invalid_cursor', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/v1/repair-plans?cursor=not-a-valid-cursor!!!!',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_cursor');
  });
});
