import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-014 GET /v1/evidence-exports (CP-9.1f).
 *
 *   TEST-LST-EVIDENCE-1 happy paginate (3 pages with limit=2 over 5 exports)
 *   TEST-LST-EVIDENCE-2 filter by intake_id
 *   TEST-LST-EVIDENCE-3 filter by from/to time range
 *   TEST-LST-EVIDENCE-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-EVIDENCE-5 invalid cursor returns 400 invalid_cursor
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
    run_id: `lst-evid-${suffix}-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64('INFO build 4421\nERROR OOM\n'),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'lst-evid-test' },
  };
}

describe('Evidence-exports List route (CP-9.1f integration)', () => {
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

  /**
   * Build a full pipeline: intake -> RCA -> repair plan -> submit -> approve
   * -> evidence-export. Returns the export id (and its intake_id) so tests
   * can filter.
   */
  async function createExport(
    tenant: string,
    suffix = '',
  ): Promise<{ intakeId: string; evidenceExportId: string }> {
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-lst-evid-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: intakeBody(suffix),
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
    const sub = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/submit`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(sub.statusCode).toBe(200);
    const approve = await app.inject({
      method: 'POST',
      url: `/v1/repair-plan/${repairPlanId}/approve`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: { approver: 'alice@acme.test' },
    });
    expect(approve.statusCode).toBe(200);
    const exp = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/evidence-export`,
      headers: { 'x-tenant-id': tenant, 'content-type': 'application/json' },
      payload: {},
    });
    expect(exp.statusCode, exp.payload).toBe(201);
    const evidenceExportId = exp.json().evidence_export_id as string;
    return { intakeId, evidenceExportId };
  }

  // -------------------------------------------------------------------------
  it('TEST-LST-EVIDENCE-1: paginates with limit=2 over 5 exports', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { evidenceExportId } = await createExport(TENANT_A, `pg-${i}`);
      ids.add(evidenceExportId);
      await new Promise((r) => setTimeout(r, 2));
    }

    const p1 = await app.inject({
      method: 'GET',
      url: '/v1/evidence-exports?limit=2',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p1.statusCode).toBe(200);
    const j1 = p1.json();
    expect(j1.items.length).toBe(2);
    expect(j1.next_cursor).toBeTruthy();

    const p2 = await app.inject({
      method: 'GET',
      url: `/v1/evidence-exports?limit=2&cursor=${encodeURIComponent(j1.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p2.statusCode).toBe(200);
    const j2 = p2.json();
    expect(j2.items.length).toBe(2);

    const p3 = await app.inject({
      method: 'GET',
      url: `/v1/evidence-exports?limit=2&cursor=${encodeURIComponent(j2.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p3.statusCode).toBe(200);
    const j3 = p3.json();
    expect(j3.items.length).toBe(1);
    expect(j3.next_cursor).toBeNull();

    const seen = [...j1.items, ...j2.items, ...j3.items].map(
      (r: { evidence_export_id: string }) => r.evidence_export_id,
    );
    expect(new Set(seen).size).toBe(5);
    seen.forEach((id) => expect(ids.has(id)).toBe(true));

    // Each row carries the expected shape
    [...j1.items, ...j2.items, ...j3.items].forEach((row: any) => {
      expect(row.intake_provider).toBe('github');
      expect(typeof row.byte_size).toBe('number');
      expect(row.byte_size).toBeGreaterThan(0);
      expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.s3_bucket).toBe('mendoraci-evidence');
      expect(row.s3_key).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-EVIDENCE-2: filter by intake_id', async () => {
    const target = await createExport(TENANT_A, 'tgt');
    await createExport(TENANT_A, 'o1');
    await createExport(TENANT_A, 'o2');

    const r = await app.inject({
      method: 'GET',
      url: `/v1/evidence-exports?intake_id=${target.intakeId}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].evidence_export_id).toBe(target.evidenceExportId);
    expect(j.items[0].intake_id).toBe(target.intakeId);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-EVIDENCE-3: filter by from/to time range', async () => {
    // 1 export before, 1 inside, 1 after
    await createExport(TENANT_A, 'before');
    await new Promise((r) => setTimeout(r, 50));
    const windowStart = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 5));
    const inside = await createExport(TENANT_A, 'inside');
    await new Promise((r) => setTimeout(r, 5));
    const windowEnd = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 50));
    await createExport(TENANT_A, 'after');

    const r = await app.inject({
      method: 'GET',
      url: `/v1/evidence-exports?from=${encodeURIComponent(windowStart)}&to=${encodeURIComponent(windowEnd)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].evidence_export_id).toBe(inside.evidenceExportId);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-EVIDENCE-4: tenant B cannot see tenant A exports (RLS)', async () => {
    await createExport(TENANT_A, 'a1');
    await createExport(TENANT_A, 'a2');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/evidence-exports',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(0);
    expect(j.next_cursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-EVIDENCE-5: malformed cursor returns 400 invalid_cursor', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/v1/evidence-exports?cursor=not-a-valid-cursor!!!!',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_cursor');
  });
});
