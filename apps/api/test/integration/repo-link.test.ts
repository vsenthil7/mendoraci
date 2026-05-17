import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp, loadConfig } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/**
 * Integration tests for API-003 (POST + GET /v1/intake/:id/link-repo / /repo).
 *
 * Anchors (per docs/MendoraCI_Traceability.md RT-002):
 *   TEST-005   happy link with commits   -> 201
 *   TEST-006   duplicate link            -> 409 repo_already_linked
 *   TEST-007   cross-tenant link attempt -> 404 intake_not_found (RLS)
 *
 * Cross-cuts:
 *   - RT-013 RLS (TEST-007 proves isolation: tenant B cannot link tenant A's intake)
 *   - RT-014 perm (CP-10) — for CP-4, any authenticated tenant member can link
 *   - RT-008 mask is not relevant here (no log body); repo URLs are stored as-is
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function validIntakeBody() {
  return {
    provider: 'github',
    run_id: `run-${randomUUID()}`,
    attempt_id: 'attempt-1',
    artifact: { type: 'log', body_base64: b64('build failed at step 3\n') },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'ci-bot' },
  };
}

function validRepoLinkBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    repo_provider: 'github',
    repo_url: 'https://github.com/acme/widget',
    default_branch: 'main',
    commits: [
      {
        commit_sha: 'abc1234567890def',
        message: 'fix: handle null in parser',
        author: 'jane@acme.test',
        authored_at: '2026-05-17T08:00:00Z',
        parents: ['deadbeef0123456'],
      },
      {
        commit_sha: 'fedcba0987654321',
        message: 'refactor: simplify retry loop',
        author: 'bob@acme.test',
        authored_at: '2026-05-17T07:30:00Z',
        parents: [],
      },
    ],
    ...overrides,
  };
}

describe('Repo Linking routes (CP-4 integration)', () => {
  let app: FastifyInstance;
  let pool: pg.Pool;

  beforeAll(async () => {
    app = await buildApp(loadConfig());
    await app.ready();
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // Seed both tenants for TEST-007 cross-tenant.
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
    // Clean repo + intake tables between tests. Direct pool == superuser (bypasses RLS).
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

  // Helper: create an intake for the given tenant, return intake_id.
  async function createIntake(tenant: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'x-tenant-id': tenant,
        'idempotency-key': `k-rl-${randomUUID()}`,
        'content-type': 'application/json',
      },
      payload: validIntakeBody(),
    });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json().intake_id as string;
  }

  // ---------------------------------------------------------------------------
  // TEST-005 — happy link with commits
  // ---------------------------------------------------------------------------
  it('TEST-005: links a repo to an intake with commits and returns 201', async () => {
    const intakeId = await createIntake(TENANT_A);

    const link = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: validRepoLinkBody(),
    });

    expect(link.statusCode, link.payload).toBe(201);
    const j = link.json();
    expect(j.repo_link_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j.intake_id).toBe(intakeId);
    expect(j.repo_provider).toBe('github');
    expect(j.repo_url).toBe('https://github.com/acme/widget');
    expect(j.default_branch).toBe('main');
    expect(j.commits_captured).toBe(2);

    // GET /v1/intake/:id/repo round-trips
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/repo`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(detail.statusCode, detail.payload).toBe(200);
    const d = detail.json();
    expect(d.repo_link_id).toBe(j.repo_link_id);
    expect(d.commits).toHaveLength(2);
    // Most recent first (authored_at DESC)
    expect(d.commits[0].commit_sha).toBe('abc1234567890def');
    expect(d.commits[1].commit_sha).toBe('fedcba0987654321');
    expect(d.commits[0].parents).toEqual(['deadbeef0123456']);
  });

  it('TEST-005-A: link without commits returns 201 with commits_captured=0', async () => {
    const intakeId = await createIntake(TENANT_A);
    const link = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { repo_provider: 'github', repo_url: 'https://github.com/acme/widget' },
    });
    expect(link.statusCode, link.payload).toBe(201);
    expect(link.json().commits_captured).toBe(0);
    expect(link.json().default_branch).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // TEST-006 — duplicate link returns 409
  // ---------------------------------------------------------------------------
  it('TEST-006: linking the same intake twice returns 409 repo_already_linked', async () => {
    const intakeId = await createIntake(TENANT_A);

    const first = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: validRepoLinkBody(),
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: validRepoLinkBody({
        repo_url: 'https://github.com/acme/different-repo',
      }),
    });
    expect(second.statusCode, second.payload).toBe(409);
    expect(second.json().error.code).toBe('repo_already_linked');
  });

  // ---------------------------------------------------------------------------
  // TEST-007 — cross-tenant link attempt returns 404 (RLS hides the intake)
  // ---------------------------------------------------------------------------
  it('TEST-007: tenant B cannot link tenant A intake -> 404 intake_not_found', async () => {
    const tenantAIntake = await createIntake(TENANT_A);

    const attack = await app.inject({
      method: 'POST',
      url: `/v1/intake/${tenantAIntake}/link-repo`,
      headers: { 'x-tenant-id': TENANT_B, 'content-type': 'application/json' },
      payload: validRepoLinkBody(),
    });
    expect(attack.statusCode, attack.payload).toBe(404);
    expect(attack.json().error.code).toBe('intake_not_found');

    // GET also blocked (cross-tenant must not reveal existence)
    const get = await app.inject({
      method: 'GET',
      url: `/v1/intake/${tenantAIntake}/repo`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(get.statusCode).toBe(404);

    // Tenant A still sees no link (we never created one) -> 404
    const tenantAGet = await app.inject({
      method: 'GET',
      url: `/v1/intake/${tenantAIntake}/repo`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(tenantAGet.statusCode).toBe(404);
    expect(tenantAGet.json().error.code).toBe('repo_link_not_found');
  });

  // ---------------------------------------------------------------------------
  // Negative — validation & ids
  // ---------------------------------------------------------------------------
  it('NEG: invalid intake_id returns 400 invalid_intake_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/not-a-uuid/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: validRepoLinkBody(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_intake_id');
  });

  it('NEG: bad schema (non-url) returns 422', async () => {
    const intakeId = await createIntake(TENANT_A);
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${intakeId}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: { repo_provider: 'github', repo_url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_failed');
  });

  it('NEG: unknown intake returns 404 intake_not_found', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999';
    const res = await app.inject({
      method: 'POST',
      url: `/v1/intake/${ghost}/link-repo`,
      headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
      payload: validRepoLinkBody(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('intake_not_found');
  });

  it('NEG: GET /v1/intake/:id/repo with missing tenant -> 401', async () => {
    const intakeId = await createIntake(TENANT_A);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/intake/${intakeId}/repo`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });
});
