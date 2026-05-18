import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-010 GET /v1/intakes (CP-9.1c).
 *
 * Anchors (per docs/MendoraCI_Traceability.md CP-9):
 *   TEST-LST-INTAKE-1 happy paginate (3 pages with limit=2 over 5 rows)
 *   TEST-LST-INTAKE-2 filter by plan_status='approved'
 *   TEST-LST-INTAKE-3 filter by has_rca=true
 *   TEST-LST-INTAKE-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-INTAKE-5 invalid cursor returns 400 invalid_cursor
 *   TEST-LST-INTAKE-6 free-text q matches run_id partial
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_URL = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function intakeBody(opts: { runIdSuffix: string } = { runIdSuffix: '' }) {
  return {
    provider: 'github',
    run_id: `pw-lst-${opts.runIdSuffix}-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64(
        'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
      ),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'lst-test' },
  };
}

describe('Intakes List route (CP-9.1c integration)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;

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
  });

  async function createIntake(
    tenant: string,
    runIdSuffix = '',
  ): Promise<string> {
    const r = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-lst-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: intakeBody({ runIdSuffix }),
    });
    expect(r.statusCode, r.payload).toBe(201);
    return r.json().intake_id as string;
  }

  async function createApprovedIntake(tenant: string): Promise<string> {
    const intakeId = await createIntake(tenant, 'approved');
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
    return intakeId;
  }

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-1: paginates with limit=2 over 5 intakes; 3 pages, no overlap', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      ids.add(await createIntake(TENANT_A, `pg-${i}`));
      // 1ms gap so created_at ordering is deterministic in beforeEach-cleared DB
      await new Promise((r) => setTimeout(r, 2));
    }

    // Page 1
    const p1 = await app.inject({
      method: 'GET',
      url: '/v1/intakes?limit=2',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p1.statusCode).toBe(200);
    const j1 = p1.json();
    expect(j1.items.length).toBe(2);
    expect(j1.next_cursor).toBeTruthy();

    // Page 2
    const p2 = await app.inject({
      method: 'GET',
      url: `/v1/intakes?limit=2&cursor=${encodeURIComponent(j1.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p2.statusCode).toBe(200);
    const j2 = p2.json();
    expect(j2.items.length).toBe(2);
    expect(j2.next_cursor).toBeTruthy();

    // Page 3 — last row, should NOT have next_cursor
    const p3 = await app.inject({
      method: 'GET',
      url: `/v1/intakes?limit=2&cursor=${encodeURIComponent(j2.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p3.statusCode).toBe(200);
    const j3 = p3.json();
    expect(j3.items.length).toBe(1);
    expect(j3.next_cursor).toBeNull();

    // No overlap between pages, all 5 ids accounted for
    const seen = [...j1.items, ...j2.items, ...j3.items].map(
      (r: { intake_id: string }) => r.intake_id,
    );
    expect(new Set(seen).size).toBe(5);
    seen.forEach((id) => expect(ids.has(id)).toBe(true));

    // All rows should be has_rca=false / has_plan=false / has_export=false
    [...j1.items, ...j2.items, ...j3.items].forEach((row: any) => {
      expect(row.has_rca).toBe(false);
      expect(row.has_plan).toBe(false);
      expect(row.has_export).toBe(false);
      expect(row.plan_status).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-2: filters by plan_status=approved', async () => {
    const approvedId = await createApprovedIntake(TENANT_A);
    await createIntake(TENANT_A, 'plain1'); // no rca, no plan
    await createIntake(TENANT_A, 'plain2');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/intakes?plan_status=approved',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].intake_id).toBe(approvedId);
    expect(j.items[0].has_rca).toBe(true);
    expect(j.items[0].has_plan).toBe(true);
    expect(j.items[0].plan_status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-3: filters by has_rca=true', async () => {
    const plainId = await createIntake(TENANT_A, 'plain');
    const withRcaId = await createIntake(TENANT_A, 'rca');
    const rca = await app.inject({
      method: 'POST',
      url: `/v1/intake/${withRcaId}/rca`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: {},
    });
    expect(rca.statusCode).toBe(201);

    const r = await app.inject({
      method: 'GET',
      url: '/v1/intakes?has_rca=true',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].intake_id).toBe(withRcaId);
    expect(j.items[0].has_rca).toBe(true);

    // Negative form returns the plain one
    const r2 = await app.inject({
      method: 'GET',
      url: '/v1/intakes?has_rca=false',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r2.statusCode).toBe(200);
    const j2 = r2.json();
    expect(j2.items.length).toBe(1);
    expect(j2.items[0].intake_id).toBe(plainId);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-4: tenant B cannot see tenant A intakes (RLS)', async () => {
    await createIntake(TENANT_A, 'a1');
    await createIntake(TENANT_A, 'a2');
    await createIntake(TENANT_A, 'a3');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/intakes',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(0);
    expect(j.next_cursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-5: malformed cursor returns 400 invalid_cursor', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/v1/intakes?cursor=not-a-real-cursor!!!!',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_cursor');
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-INTAKE-6: free-text q matches run_id partial', async () => {
    const ndlId = await createIntake(TENANT_A, 'needle-1234');
    await createIntake(TENANT_A, 'haystack-other');
    await createIntake(TENANT_A, 'haystack-other-2');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/intakes?q=needle',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].intake_id).toBe(ndlId);
    expect(j.items[0].run_id).toContain('needle');
  });
});
