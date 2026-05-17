import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-001 (POST /intake) + API-002 (GET /intake/:id).
 *
 * Anchors:
 *   TEST-001    happy path                BR-001
 *   TEST-001-A  idempotency replay        RT-015
 *   TEST-002    schema validation -> 422  BR-001
 *   TEST-003    missing tenant   -> 401   BR-001 security
 *   TEST-004    oversized payload -> 413  BR-001
 *
 * Requires Postgres reachable at DATABASE_URL.
 */

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function validBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    provider: 'jenkins',
    run_id: `run-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: { type: 'log', body_base64: b64('OOM error at line 421: process killed\n') },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'ci-bot' },
    ...overrides,
  };
}

describe('Intake routes (CP-2 integration)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await buildApp(loadConfig());
    await app.ready();
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // Seed the tenant (RLS-bypass via direct pool; OK for test bootstrap).
    await pool.query(
      `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [TENANT, 'AcmePilot'],
    );
  });

  beforeEach(async () => {
    // Clean intake tables between tests for determinism.
    await pool.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]);
    await pool.query('DELETE FROM idempotency_keys WHERE tenant_id = $1', [TENANT]);
    await pool.query('DELETE FROM intake_meta WHERE tenant_id = $1', [TENANT]);
    await pool.query('DELETE FROM raw_intake WHERE tenant_id = $1', [TENANT]);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // TEST-001 — Happy path
  // ---------------------------------------------------------------------------
  it('TEST-001: happy path returns 201 with intake_id + masked status', async () => {
    const t0 = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': `k-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validBody(),
    });
    const elapsed = Date.now() - t0;

    expect(res.statusCode, res.payload).toBe(201);
    const json = res.json();
    expect(json.intake_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.status).toBe('masked');
    expect(json.mask_policy_version).toBe('v1.0.0');
    expect(elapsed).toBeLessThan(5_000); // p95 5s soft target

    // GET /intake/:id (API-002) returns the masked detail.
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${json.intake_id}`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(detail.statusCode, detail.payload).toBe(200);
    const dj = detail.json();
    expect(dj.intake_id).toBe(json.intake_id);
    expect(dj.intake_meta.provider).toBe('jenkins');
  });

  it('TEST-001 (masking): AWS access key is masked in body_masked_preview', async () => {
    const body = validBody({
      artifact: {
        type: 'log',
        body_base64: b64('config: AKIAIOSFODNN7EXAMPLE was the secret. nothing else.'),
      },
    });
    const post = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': `k-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: body,
    });
    expect(post.statusCode).toBe(201);
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${post.json().intake_id}`,
      headers: { 'x-tenant-id': TENANT },
    });
    const preview = detail.json().body_masked_preview as string;
    expect(preview).toContain('AKIA****');
    expect(preview).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  // ---------------------------------------------------------------------------
  // TEST-001-A — Idempotency replay (RT-015)
  // ---------------------------------------------------------------------------
  it('TEST-001-A: replaying the same (provider, run_id, attempt_id) returns the same intake_id', async () => {
    const payload = validBody({ run_id: 'replay-run-1', attempt_id: 'attempt-7' });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': 'replay-key-1',
        'content-type': 'application/json',
      },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const id1 = first.json().intake_id;

    const second = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': 'replay-key-1',
        'content-type': 'application/json',
      },
      payload,
    });
    expect(second.statusCode).toBe(200); // replay returns 200, not 201
    expect(second.json().intake_id).toBe(id1);

    // Confirm exactly ONE row exists.
    await pool.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]);
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM intake_meta WHERE run_id = $1 AND attempt_id = $2',
      ['replay-run-1', 'attempt-7'],
    );
    expect(count.rows[0].n).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // TEST-002 — Schema validation
  // ---------------------------------------------------------------------------
  it('TEST-002: malformed body returns 422 with validation_errors[]', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': `k-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: { provider: 'unsupported-ci', run_id: '', attempt_id: '' },
    });
    expect(res.statusCode).toBe(422);
    const j = res.json();
    expect(j.error.code).toBe('validation_failed');
    expect(Array.isArray(j.error.validation_errors)).toBe(true);
    expect(j.error.validation_errors.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // TEST-003 — Missing / invalid tenant -> 401
  // ---------------------------------------------------------------------------
  it('TEST-003: missing X-Tenant-Id header returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': `k-${randomUUID()}`, 'content-type': 'application/json' },
      payload: validBody(),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toMatch(/unauthorized|missing/i);
  });

  it('TEST-003 (invalid tenant): non-UUID X-Tenant-Id returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': 'not-a-uuid',
        'idempotency-key': `k-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validBody(),
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // TEST-004 — Oversized payload -> 413
  // ---------------------------------------------------------------------------
  it('TEST-004: artifact larger than 50 MB returns 413', async () => {
    // Build a payload whose decoded body is just over 50 MB. We don't need full
    // 50 MB on the wire; we craft a small base64 *claiming* >50 MB after decode.
    // Approach: 50 MB + 1 of "A".
    const oversize = Buffer.alloc(50 * 1024 * 1024 + 16, 'A').toString('base64');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': TENANT,
        'idempotency-key': `k-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validBody({ artifact: { type: 'log', body_base64: oversize } }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toMatch(/payload_too_large|artifact_exceeds/i);
  });

  // ---------------------------------------------------------------------------
  // Idempotency-Key header required
  // ---------------------------------------------------------------------------
  it('TEST-015: missing Idempotency-Key returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
      payload: validBody(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toMatch(/idempotency|bad_request/i);
  });
});
