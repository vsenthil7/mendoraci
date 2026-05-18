import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-011 GET /v1/rca-findings (CP-9.1d).
 *
 *   TEST-LST-RCA-1 happy paginate (3 pages with limit=2 over 5 RCA rows)
 *   TEST-LST-RCA-2 filter by confidence=high
 *   TEST-LST-RCA-3 filter by intake_id (returns the 1 RCA for that intake)
 *   TEST-LST-RCA-4 cross-tenant returns empty (RLS proof)
 *   TEST-LST-RCA-5 invalid cursor returns 400 invalid_cursor
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
    run_id: `lst-rca-${suffix}-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: {
      type: 'log',
      body_base64: b64(
        'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
      ),
    },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'lst-rca-test' },
  };
}

describe('RCA findings List route (CP-9.1d integration)', () => {
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

  async function createIntakeAndRca(
    tenant: string,
    suffix = '',
  ): Promise<{ intakeId: string; rcaFindingId: string }> {
    const intake = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-lst-rca-${randomUUID()}`,
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
    expect(rca.statusCode, rca.payload).toBe(201);
    const rcaFindingId = rca.json().rca_finding_id as string;
    return { intakeId, rcaFindingId };
  }

  // -------------------------------------------------------------------------
  it('TEST-LST-RCA-1: paginates with limit=2 over 5 RCAs; 3 pages, no overlap', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { rcaFindingId } = await createIntakeAndRca(TENANT_A, `pg-${i}`);
      ids.add(rcaFindingId);
      await new Promise((r) => setTimeout(r, 2));
    }

    const p1 = await app.inject({
      method: 'GET',
      url: '/v1/rca-findings?limit=2',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p1.statusCode).toBe(200);
    const j1 = p1.json();
    expect(j1.items.length).toBe(2);
    expect(j1.next_cursor).toBeTruthy();

    const p2 = await app.inject({
      method: 'GET',
      url: `/v1/rca-findings?limit=2&cursor=${encodeURIComponent(j1.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p2.statusCode).toBe(200);
    const j2 = p2.json();
    expect(j2.items.length).toBe(2);
    expect(j2.next_cursor).toBeTruthy();

    const p3 = await app.inject({
      method: 'GET',
      url: `/v1/rca-findings?limit=2&cursor=${encodeURIComponent(j2.next_cursor)}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(p3.statusCode).toBe(200);
    const j3 = p3.json();
    expect(j3.items.length).toBe(1);
    expect(j3.next_cursor).toBeNull();

    const seen = [...j1.items, ...j2.items, ...j3.items].map(
      (r: { rca_finding_id: string }) => r.rca_finding_id,
    );
    expect(new Set(seen).size).toBe(5);
    seen.forEach((id) => expect(ids.has(id)).toBe(true));

    // Sanity: each row has intake context + counts
    [...j1.items, ...j2.items, ...j3.items].forEach((row: any) => {
      expect(row.intake_provider).toBe('github');
      expect(typeof row.evidence_count).toBe('number');
      expect(typeof row.recommended_actions_count).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-RCA-2: filters by confidence=high', async () => {
    // Mock-Bob always returns confidence='high' so create a couple of RCAs
    // and verify they all come back.
    await createIntakeAndRca(TENANT_A, 'c1');
    await createIntakeAndRca(TENANT_A, 'c2');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/rca-findings?confidence=high',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(2);
    j.items.forEach((row: any) => expect(row.confidence).toBe('high'));

    // Negative case: filter by 'low' should return empty for mock-Bob output
    const r2 = await app.inject({
      method: 'GET',
      url: '/v1/rca-findings?confidence=low',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().items.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-RCA-3: filters by intake_id', async () => {
    const targetIntake = await createIntakeAndRca(TENANT_A, 'target');
    await createIntakeAndRca(TENANT_A, 'other-1');
    await createIntakeAndRca(TENANT_A, 'other-2');

    const r = await app.inject({
      method: 'GET',
      url: `/v1/rca-findings?intake_id=${targetIntake.intakeId}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].rca_finding_id).toBe(targetIntake.rcaFindingId);
    expect(j.items[0].intake_id).toBe(targetIntake.intakeId);
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-RCA-4: tenant B cannot see tenant A RCAs (RLS)', async () => {
    await createIntakeAndRca(TENANT_A, 'a1');
    await createIntakeAndRca(TENANT_A, 'a2');

    const r = await app.inject({
      method: 'GET',
      url: '/v1/rca-findings',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.items.length).toBe(0);
    expect(j.next_cursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('TEST-LST-RCA-5: malformed cursor returns 400 invalid_cursor', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/v1/rca-findings?cursor=not-a-valid-cursor!!!!',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_cursor');
  });
});
