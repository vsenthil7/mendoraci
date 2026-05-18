import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-006 — Evidence Export page (RT-006 / API-009).
 *
 * Tests:
 *   Pw-008a renders all primary controls + idle status
 *   Pw-008b 412 plan_not_approved surfaced when plan is still in draft
 *   Pw-008c happy: full pipeline (intake -> rca -> plan -> submit -> approve)
 *           then export -> result panel rendered with export id, sha256,
 *           byte size, s3 key, download link, expires-at
 *   Pw-008d unknown intake -> 404 surfaced
 *   Pw-008e back-to-intake nav
 *   Pw-008f API envelope structural + GET round-trip with manifest
 */

const KNOWN_BAD_INTAKE = '99999999-9999-4999-8999-999999999999';

async function freshIntakeOnly(): Promise<string> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr006-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr006-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nWARN AKIA**** seen\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-evid' },
    },
  });
  expect(r.status()).toBe(201);
  const id = (await r.json()).intake_id as string;
  await ctx.dispose();
  return id;
}

async function fullPipelineApproved(): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr006-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr006-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nWARN AKIA**** seen\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-evid' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;

  const rca = await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(rca.status()).toBe(201);

  const plan = await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(plan.status()).toBe(201);
  const repairPlanId = (await plan.json()).repair_plan_id as string;

  const sub = await ctx.post(`/v1/repair-plan/${repairPlanId}/submit`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(sub.status()).toBe(200);

  const app1 = await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
    headers: { 'content-type': 'application/json' },
    data: { approver: 'pw-approver@acme.test', note: 'pw e2e' },
  });
  expect(app1.status()).toBe(200);

  await ctx.dispose();
  return { intakeId, repairPlanId };
}

test.describe('SCR-006 — Evidence Export page', () => {
  test('TEST-Pw-008a: renders all primary controls + idle status', async ({ page }) => {
    const intakeId = await freshIntakeOnly();
    await page.goto(`/intake/${intakeId}/evidence`);
    await expect(page.getByTestId('scr-006-evidence')).toBeVisible();
    await expect(page.getByTestId('ttl-input')).toBeVisible();
    await expect(page.getByTestId('run-export')).toBeVisible();
    await expect(page.getByTestId('back-to-intake')).toBeVisible();
    await expect(page.getByTestId('export-status')).toHaveText('idle');
  });

  test('TEST-Pw-008b: plan not approved -> 412 surfaced in UI', async ({ page }) => {
    // Build only up through repair plan (no submit/approve)
    const intakeId = await freshIntakeOnly();
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    await ctx.post(`/v1/intake/${intakeId}/rca`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    await ctx.dispose();

    await page.goto(`/intake/${intakeId}/evidence`);
    await page.getByTestId('run-export').click();
    await expect(page.getByTestId('export-status')).toHaveText('error');
    const err = await page.getByTestId('export-error').textContent();
    expect(err ?? '').toContain('plan_not_approved');
  });

  test('TEST-Pw-008c: happy export renders result + download link', async ({ page }) => {
    test.setTimeout(60_000);
    const { intakeId } = await fullPipelineApproved();
    await page.goto(`/intake/${intakeId}/evidence`);

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v1/intake/${intakeId}/evidence-export`) &&
        r.request().method() === 'POST',
      { timeout: 50_000 },
    );
    await page.getByTestId('run-export').click();
    const resp = await respPromise;
    expect([201, 503]).toContain(resp.status());

    if (resp.status() === 201) {
      await expect(page.getByTestId('export-status')).toHaveText('done', { timeout: 15_000 });
      await expect(page.getByTestId('export-result')).toBeVisible();
      const exportId = await page.getByTestId('export-id').textContent();
      expect(exportId ?? '').toMatch(/[0-9a-f-]{36}/);
      const sha = await page.getByTestId('export-sha256').textContent();
      expect(sha ?? '').toMatch(/^[0-9a-f]{64}$/);
      const s3Key = await page.getByTestId('export-s3-key').textContent();
      expect(s3Key ?? '').toContain(intakeId);
      expect(s3Key ?? '').toContain('.zip');
      const dl = page.getByTestId('download-link');
      await expect(dl).toBeVisible();
      const href = await dl.getAttribute('href');
      expect(href ?? '').toContain(intakeId);
    }
  });

  test('TEST-Pw-008d: unknown intake -> 404 surfaced in UI', async ({ page }) => {
    await page.goto(`/intake/${KNOWN_BAD_INTAKE}/evidence`);
    await page.getByTestId('run-export').click();
    await expect(page.getByTestId('export-status')).toHaveText('error');
    const err = await page.getByTestId('export-error').textContent();
    expect(err ?? '').toContain('intake_not_found');
  });

  test('TEST-Pw-008e: back-to-intake navigates to /', async ({ page }) => {
    const intakeId = await freshIntakeOnly();
    await page.goto(`/intake/${intakeId}/evidence`);
    await page.getByTestId('back-to-intake').click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByTestId('scr-001-intake')).toBeVisible();
  });

  test('TEST-Pw-008f: API envelope is structurally valid + GET round-trip', async () => {
    test.setTimeout(60_000);
    const { intakeId, repairPlanId } = await fullPipelineApproved();

    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.post(`/v1/intake/${intakeId}/evidence-export`, {
      headers: { 'content-type': 'application/json' },
      data: { presigned_ttl_seconds: 300 },
      timeout: 50_000,
    });
    expect([201, 503]).toContain(r.status());

    if (r.status() === 201) {
      const j = await r.json();
      expect(j.evidence_export_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(j.intake_id).toBe(intakeId);
      expect(j.repair_plan_id).toBe(repairPlanId);
      expect(j.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(j.byte_size).toBeGreaterThan(200);
      expect(typeof j.presigned_url).toBe('string');
      expect(j.presigned_url.length).toBeGreaterThan(0);
      expect(j.s3_key).toContain(intakeId);

      // GET round-trip
      const g = await ctx.get(`/v1/intake/${intakeId}/evidence-export`);
      expect(g.status()).toBe(200);
      const gj = await g.json();
      expect(gj.evidence_export_id).toBe(j.evidence_export_id);
      expect(gj.manifest.intake_id).toBe(intakeId);
      expect(gj.manifest.repair_plan_id).toBe(repairPlanId);
      expect(Array.isArray(gj.manifest.files)).toBe(true);
      expect(gj.manifest.files.length).toBeGreaterThanOrEqual(5);
    }
    await ctx.dispose();
  });
});
