import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-013 GET /v1/approvals (CP-9.1f).
 *
 *   TEST-LST-APPROVAL-1 happy paginate (3 pages with limit=2 over 5 audit rows)
 *   TEST-LST-APPROVAL-2 filter by action=approve
 *   TEST-LST-APPROVAL-3 filter by repair_plan_id
 *   TEST-LST-APPROVAL-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-APPROVAL-5 invalid cursor returns 400 invalid_cursor
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
    run_id: `lst-app-${suffix}-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64('INFO build 4421\nERROR OOM\n'),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'lst-app-test' },
  };
}

describe('Approvals List route (CP-9.1f integration)', () => {
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

  async function buildPlanThroughApproval(
    tenant: string,
    opts: { suffix?: string; action: 'submit' | 'approve' | 'reject' },
  ): Promise<{ intakeId: string; repairPlanId: string }> {
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-lst-app-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: intakeBody(opts.suffix ?? ''),
    });
    expect(intake.statusCode).toBe(201);
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

    // Always submit first to leave a submit row
    const sub = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(sub.statusCode).toBe(200);

    if (opts.action === 'approve') {
      const a = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/approve`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: { approver: 'alice@acme.test' },
      });
      expect(a.statusCode).toBe(200);
    } else if (opts.action === 'reject') {
      const r = await app.inject({
        method: 'POST',
        url: `/v1/repair-plan/${repairPlanId}/reject`,
        headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
        payload: { approver: 'bob@acme.test', reason: 'too risky' },
      });
      expect(r.statusCode).toBe(200);
    }
    return { intakeId, repairPlanId };
  }

  // -------------------------------------------------------------------------
  it('TEST-LST-APPROVAL-1: paginates with limit=2 over 5 audit rows', async () => {
    // Create plans that produce: 2 submit-only, 2 submit+approve, 1 submit+reject
    // -> 2 + 2*2 + 2 = 7 audit rows. Use limit=3 to make 3 pages.
    await buildPlanThroughApproval(TENANT_A, { suffix: 's1', action: 'submit' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 's2', action: 'submit' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a1', action: 'approve' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a2', action: 'approve' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'r1', action: 'reject' });
    // 2*1 + 2*2 + 1*2 = 8 audit rows total

    const p1 = await app.inject({
      method: 'GET',
      url: '/v1/approvals?limit=3',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p1.statusCode).toBe(200);
    const j1 = p1.json();
    expect(j1.items.length).toBe(3);
    expect(j1.next_cursor).toBeTruthy();

    const p2 = await app.inject({
      method: 'GET',
      url: `/v1/approvals?limit=3&cursor=${encodeURIComponent(j1.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p2.statusCode).toBe(200);
    const j2 = p2.json();
    expect(j2.items.length).toBe(3);

    const p3 = await app.inject({
      method: 'GET',
      url: `/v1/approvals?limit=3&cursor=${encodeURIComponent(j2.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p3.statusCode).toBe(200);
    const j3 = p3.json();
    expect(j3.items.length).toBe(2);
    expect(j3.next_cursor).toBeNull();

    const seen = [...j1.items, ...j2.items, ...j3.items];
    expect(seen.length).toBe(8);
    // Sanity: no duplicates
    const uniq = new Set(seen.map((r: { approval_id: string }) => r.approval_id));
    expect(uniq.size).toBe(8);
    // Each row carries intake context + plan summary
    seen.forEach((row: any) => {
      expect(row.intake_provider).toBe('github');
      expect(row.intake_run_id).toBeTruthy();
      expect(typeof row.plan_summary).toBe('string');
      expect(row.actor).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-APPROVAL-2: filter by action=approve', async () => {
    await buildPlanThroughApproval(TENANT_A, { suffix: 's', action: 'submit' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a1', action: 'approve' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a2', action: 'approve' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'r', action: 'reject' });

    const r = await app.inject({
      method: 'GET',
      url: '/v1/approvals?action=approve',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(2);
    j.items.forEach((row: any) => {
      expect(row.action).toBe('approve');
      expect(row.new_status).toBe('approved');
      expect(row.actor).toBe('alice@acme.test');
    });

    // action=reject returns 1
    const r2 = await app.inject({
      method: 'GET',
      url: '/v1/approvals?action=reject',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r2.statusCode).toBe(200);
    const j2 = r2.json();
    expect(j2.items.length).toBe(1);
    expect(j2.items[0].action).toBe('reject');
    expect(j2.items[0].new_status).toBe('rejected');
    expect(j2.items[0].actor).toBe('bob@acme.test');
    expect(j2.items[0].note).toBe('too risky');
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-APPROVAL-3: filter by repair_plan_id', async () => {
    const target = await buildPlanThroughApproval(TENANT_A, {
      suffix: 'tgt',
      action: 'approve',
    }); // target plan has 2 audit rows
    await buildPlanThroughApproval(TENANT_A, { suffix: 'o1', action: 'submit' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'o2', action: 'reject' });

    const r = await app.inject({
      method: 'GET',
      url: `/v1/approvals?repair_plan_id=${target.repairPlanId}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(2);
    j.items.forEach((row: any) => expect(row.repair_plan_id).toBe(target.repairPlanId));
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-APPROVAL-4: tenant B cannot see tenant A approvals (RLS)', async () => {
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a1', action: 'approve' });
    await buildPlanThroughApproval(TENANT_A, { suffix: 'a2', action: 'approve' });

    const r = await app.inject({
      method: 'GET',
      url: '/v1/approvals',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(0);
    expect(j.next_cursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-APPROVAL-5: malformed cursor returns 400 invalid_cursor', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/v1/approvals?cursor=not-a-valid-cursor!!!!',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_cursor');
  });
});
