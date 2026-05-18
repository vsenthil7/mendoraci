import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-012 — Dashboard page (CP-9.4).
 *
 * Tests:
 *   Pw-014a renders heading + 4 KPI tiles + refresh button + activity stream
 *   Pw-014b after seeding intake + RCA, tile-1 (intakes 24h) and tile-3
 *           (RCAs 24h) both show >=1; clicking tile-1 navigates to /intakes
 *   Pw-014c after seeding pipeline through submit (no approve), tile-2
 *           (plans awaiting approval) shows >=1
 *   Pw-014d after seeding pipeline through approve, activity stream shows
 *           >=1 row with approve action badge; clicking "See all" link
 *           navigates to /approvals
 *
 * Mock-Bob path makes the seed pipeline deterministic.
 */

async function seedIntakeOnly(prefix: string): Promise<{ intakeId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr012-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr012-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-dash' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;
  await ctx.dispose();
  return { intakeId };
}

async function seedIntakePlusRca(prefix: string): Promise<{ intakeId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const { intakeId } = await seedIntakeOnly(prefix);
  await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  await ctx.dispose();
  return { intakeId };
}

async function seedThroughSubmit(prefix: string): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const { intakeId } = await seedIntakeOnly(prefix);
  await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  const plan = await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  const repairPlanId = (await plan.json()).repair_plan_id as string;
  await ctx.post(`/v1/repair-plan/${repairPlanId}/submit`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  await ctx.dispose();
  return { intakeId, repairPlanId };
}

async function seedThroughApprove(prefix: string): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const { intakeId, repairPlanId } = await seedThroughSubmit(prefix);
  await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
    headers: { 'content-type': 'application/json' },
    data: { approver: 'alice@acme.test' },
  });
  await ctx.dispose();
  return { intakeId, repairPlanId };
}

/**
 * Goto /dashboard and wait for all 4 tiles to finish loading (no animate-pulse
 * skeletons left) AND for the activity stream to settle (no "Loading…").
 */
async function gotoDashboardAndWait(page: import('@playwright/test').Page) {
  await page.goto('/dashboard', { waitUntil: 'load' });
  await expect(page.getByTestId('scr-012-dashboard')).toBeVisible();
  // Wait for all 4 tile values to settle (no pulse skeleton)
  await expect
    .poll(
      async () => {
        const pulse = await page.locator('[data-testid$="-value"] .animate-pulse').count();
        return pulse;
      },
      { timeout: 15_000 },
    )
    .toBe(0);
  // Wait for activity stream to settle (no Loading… spinner)
  await expect
    .poll(
      async () => {
        const loading = await page.getByTestId('activity-loading').count();
        return loading;
      },
      { timeout: 15_000 },
    )
    .toBe(0);
}

test.describe('SCR-012 — Dashboard page', () => {
  test('TEST-Pw-014a: renders heading + 4 tiles + refresh + activity stream', async ({ page }) => {
    await gotoDashboardAndWait(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('refresh-button')).toBeVisible();
    await expect(page.getByTestId('kpi-tiles')).toBeVisible();
    await expect(page.getByTestId('tile-1')).toBeVisible();
    await expect(page.getByTestId('tile-2')).toBeVisible();
    await expect(page.getByTestId('tile-3')).toBeVisible();
    await expect(page.getByTestId('tile-4')).toBeVisible();
    await expect(page.getByTestId('tile-1-value')).toBeVisible();
    await expect(page.getByTestId('tile-2-value')).toBeVisible();
    await expect(page.getByTestId('tile-3-value')).toBeVisible();
    await expect(page.getByTestId('tile-4-value')).toBeVisible();
    await expect(page.getByTestId('activity-stream')).toBeVisible();
    await expect(page.getByTestId('activity-see-all')).toBeVisible();
  });

  test('TEST-Pw-014b: intake + RCA bumps tile-1 (intakes 24h) and tile-3 (RCAs 24h); tile-1 nav', async ({ page }) => {
    await seedIntakePlusRca(`b-${Date.now()}`);

    await gotoDashboardAndWait(page);

    const intakeCount = Number(await page.getByTestId('tile-1-value').textContent());
    const rcaCount = Number(await page.getByTestId('tile-3-value').textContent());
    expect(intakeCount).toBeGreaterThanOrEqual(1);
    expect(rcaCount).toBeGreaterThanOrEqual(1);

    await page.getByTestId('tile-1').click();
    await page.waitForURL((url) => url.pathname === '/intakes', { timeout: 15_000 });
  });

  test('TEST-Pw-014c: pipeline through submit bumps tile-2 (plans awaiting approval)', async ({ page }) => {
    await seedThroughSubmit(`c-${Date.now()}`);

    await gotoDashboardAndWait(page);

    const submittedCount = Number(await page.getByTestId('tile-2-value').textContent());
    expect(submittedCount).toBeGreaterThanOrEqual(1);
  });

  test('TEST-Pw-014d: approval creates activity rows; See all navigates to /approvals', async ({ page }) => {
    await seedThroughApprove(`d-${Date.now()}`);

    await gotoDashboardAndWait(page);

    // Activity stream should have at least 1 row with approve badge
    await expect
      .poll(async () => await page.locator('[data-testid^="activity-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    // At least one visible action badge should say 'approve'
    const actionTexts = await page.locator('[data-testid^="activity-action-"]').allTextContents();
    expect(actionTexts.some((t) => t.trim() === 'approve')).toBe(true);

    await page.getByTestId('activity-see-all').click();
    await page.waitForURL((url) => url.pathname === '/approvals', { timeout: 15_000 });
  });
});
