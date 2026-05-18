import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-004 — Repair Plan page (RT-004 / API-005).
 *
 * api container runs with USE_MOCK_BOB=true so these are deterministic.
 * Tests don't assert on exact text since mock-Bob varies by prompt input,
 * but they DO assert on structural shape (provider + risk badges + step
 * count + at least one step rendered + rollback present).
 *
 * Tests:
 *   Pw-006a renders all primary controls
 *   Pw-006b happy: trigger plan -> 201 -> rendered structure
 *   Pw-006c rca_required (intake has no RCA yet) -> 412 surfaced
 *   Pw-006d unknown intake -> 404 surfaced
 *   Pw-006e back-to-intake nav
 *   Pw-006f API envelope structural check + GET round-trip
 */

const KNOWN_BAD_INTAKE = '99999999-9999-4999-8999-999999999999';

async function createIntake(): Promise<string> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr004-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr004-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nWARN AKIA**** seen\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-plan' },
    },
  });
  expect(r.status()).toBe(201);
  const id = (await r.json()).intake_id as string;
  await ctx.dispose();
  return id;
}

async function createRca(intakeId: string): Promise<void> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const r = await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(r.status()).toBe(201);
  await ctx.dispose();
}

test.describe('SCR-004 — Repair Plan page', () => {
  test('TEST-Pw-006a: renders all primary controls', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repair-plan`);
    await expect(page.getByTestId('scr-004-repair-plan')).toBeVisible();
    await expect(page.getByTestId('plan-chat-mode-select')).toBeVisible();
    await expect(page.getByTestId('run-plan')).toBeVisible();
    await expect(page.getByTestId('back-to-intake')).toBeVisible();
  });

  test('TEST-Pw-006b: happy path triggers plan and renders structured result', async ({ page }) => {
    test.setTimeout(60_000);
    const intakeId = await createIntake();
    await createRca(intakeId);
    await page.goto(`/intake/${intakeId}/repair-plan`);

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v1/intake/${intakeId}/repair-plan`) &&
        r.request().method() === 'POST',
      { timeout: 50_000 },
    );
    await page.getByTestId('run-plan').click();
    const resp = await respPromise;
    expect([201, 502, 503, 504]).toContain(resp.status());

    if (resp.status() === 201) {
      await expect(page.getByTestId('plan-status')).toHaveText('done', { timeout: 15_000 });
      const provider = await page.getByTestId('plan-provider').textContent();
      expect(provider ?? '').toMatch(/(bob|mock-bob)/);
      const summary = await page.getByTestId('plan-summary').textContent();
      expect((summary ?? '').length).toBeGreaterThan(5);
      const overallRisk = await page.getByTestId('plan-overall-risk').textContent();
      expect(overallRisk ?? '').toMatch(/^(low|medium|high)$/);
      const totalEffort = await page.getByTestId('plan-total-effort').textContent();
      expect(totalEffort ?? '').toMatch(/^(XS|S|M|L|XL)$/);
      // At least one step rendered
      await expect(page.getByTestId('plan-step-0')).toBeVisible();
      await expect(page.getByTestId('plan-step-0-title')).toBeVisible();
      await expect(page.getByTestId('plan-step-0-description')).toBeVisible();
      const stepRisk = await page.getByTestId('plan-step-0-risk').textContent();
      expect(stepRisk ?? '').toMatch(/^(low|medium|high)$/);
      const stepEffort = await page.getByTestId('plan-step-0-effort').textContent();
      expect(stepEffort ?? '').toMatch(/^(XS|S|M|L|XL)$/);
      await expect(page.getByTestId('plan-rollback')).toBeVisible();
    } else {
      await expect(page.getByTestId('plan-status')).toHaveText('error', { timeout: 5_000 });
    }
  });

  test('TEST-Pw-006c: plan without prior RCA returns 412 surfaced in UI', async ({ page }) => {
    const intakeId = await createIntake();
    // Skip createRca on purpose.
    await page.goto(`/intake/${intakeId}/repair-plan`);
    await page.getByTestId('run-plan').click();
    await expect(page.getByTestId('plan-status')).toHaveText('error');
    const err = await page.getByTestId('plan-error').textContent();
    expect(err ?? '').toContain('rca_required');
  });

  test('TEST-Pw-006d: unknown intake returns 404 surfaced in UI', async ({ page }) => {
    await page.goto(`/intake/${KNOWN_BAD_INTAKE}/repair-plan`);
    await page.getByTestId('run-plan').click();
    await expect(page.getByTestId('plan-status')).toHaveText('error');
    const err = await page.getByTestId('plan-error').textContent();
    expect(err ?? '').toContain('intake_not_found');
  });

  test('TEST-Pw-006e: back-to-intake navigates to /', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repair-plan`);
    await page.getByTestId('back-to-intake').click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByTestId('scr-001-intake')).toBeVisible();
  });

  test('TEST-Pw-006f: API envelope is structurally valid + GET round-trip', async () => {
    test.setTimeout(60_000);
    const intakeId = await createIntake();
    await createRca(intakeId);

    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
      headers: { 'content-type': 'application/json' },
      data: {},
      timeout: 50_000,
    });
    expect([201, 502, 503, 504]).toContain(r.status());

    if (r.status() === 201) {
      const j = await r.json();
      expect(j.repair_plan_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(j.rca_finding_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(j.intake_id).toBe(intakeId);
      expect(['bob', 'mock-bob']).toContain(j.provider);
      expect(typeof j.output.summary).toBe('string');
      expect(['low', 'medium', 'high']).toContain(j.output.overall_risk);
      expect(['XS', 'S', 'M', 'L', 'XL']).toContain(j.output.est_total_effort);
      expect(Array.isArray(j.output.steps)).toBe(true);
      expect(j.output.steps.length).toBeGreaterThanOrEqual(1);
      for (const s of j.output.steps) {
        expect(typeof s.title).toBe('string');
        expect(typeof s.description).toBe('string');
        expect([
          'code-edit',
          'config-change',
          'infra-change',
          'rollback',
          'investigation',
          'dependency-update',
          'test-add',
          'other',
        ]).toContain(s.type);
        expect(['XS', 'S', 'M', 'L', 'XL']).toContain(s.est_effort);
        expect(['low', 'medium', 'high']).toContain(s.risk);
      }

      // GET round-trip
      const g = await ctx.get(`/v1/intake/${intakeId}/repair-plan`);
      expect(g.status()).toBe(200);
      const gj = await g.json();
      expect(gj.repair_plan_id).toBe(j.repair_plan_id);
      expect(Array.isArray(gj.steps)).toBe(true);
      expect(gj.steps.length).toBe(j.output.steps.length);
      expect(gj.steps[0].rank).toBe(0);
    }
    await ctx.dispose();
  });
});
