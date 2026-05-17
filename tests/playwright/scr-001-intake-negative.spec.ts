import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * TEST-Pw-002 — SCR-001 negative E2E.
 * Anchors: BR-001 / TEST-002 / TEST-003 / TEST-004 / TEST-015.
 *
 * Drives the API contract from a real Node→Fastify HTTP path so we verify the
 * deployed stack. Each context is created fresh with explicit headers; no
 * reliance on Playwright's global `extraHTTPHeaders` (we removed that to stop
 * tenant header from leaking into negative tests — see playwright.config.ts).
 */
test.describe('SCR-001 — Intake API contract (negative, via deployed stack)', () => {
  test('TEST-Pw-002a: malformed body returns 422 validation_failed with validation_errors[]', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.post('/v1/intake', {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `k-pw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      data: { provider: 'not-a-valid-ci', run_id: '', attempt_id: '' },
    });
    expect(r.status()).toBe(422);
    const j = await r.json();
    expect(j.error.code).toBe('validation_failed');
    expect(Array.isArray(j.error.validation_errors)).toBe(true);
    expect(j.error.validation_errors.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('TEST-Pw-002b: missing X-Tenant-Id returns 401 unauthorized', async () => {
    // Truly clean context — no tenant header anywhere.
    const ctx = await request.newContext({ baseURL: TEST_API });
    const r = await ctx.post('/v1/intake', {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `k-pw-${Date.now()}-2`,
      },
      data: validBody(),
    });
    expect(r.status()).toBe(401);
    expect((await r.json()).error.code).toBe('unauthorized');
    await ctx.dispose();
  });

  test('TEST-Pw-002c: non-UUID X-Tenant-Id returns 401', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': 'not-a-uuid' },
    });
    const r = await ctx.post('/v1/intake', {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `k-pw-${Date.now()}-3`,
      },
      data: validBody(),
    });
    expect(r.status()).toBe(401);
    await ctx.dispose();
  });

  test('TEST-Pw-002d: missing Idempotency-Key returns 400 idempotency_key_required', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.post('/v1/intake', {
      headers: { 'content-type': 'application/json' },
      data: validBody(),
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error.code).toBe('idempotency_key_required');
    await ctx.dispose();
  });

  test('TEST-Pw-002e: oversized artifact (>50MB) returns 413 artifact_exceeds_50mb', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const oversize = Buffer.alloc(50 * 1024 * 1024 + 16, 'A').toString('base64');
    const r = await ctx.post('/v1/intake', {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `k-pw-${Date.now()}-5`,
      },
      data: validBody({ artifact: { type: 'log', body_base64: oversize } }),
    });
    expect(r.status()).toBe(413);
    expect((await r.json()).error.code).toMatch(/payload_too_large|artifact_exceeds/i);
    await ctx.dispose();
  });

  test('TEST-Pw-002f: GET /v1/intake/<bad-uuid> returns 400 invalid_intake_id', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.get('/v1/intake/not-a-uuid');
    expect(r.status()).toBe(400);
    expect((await r.json()).error.code).toBe('invalid_intake_id');
    await ctx.dispose();
  });

  test('TEST-Pw-002g: GET /v1/intake/<unknown-uuid> returns 404 intake_not_found', async () => {
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.get('/v1/intake/00000000-0000-4000-8000-000000000000');
    expect(r.status()).toBe(404);
    expect((await r.json()).error.code).toBe('intake_not_found');
    await ctx.dispose();
  });
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'jenkins',
    run_id: `pw-run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    attempt_id: 'attempt-1',
    artifact: { type: 'log', body_base64: Buffer.from('hello\n').toString('base64') },
    metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-test' },
    ...overrides,
  };
}
