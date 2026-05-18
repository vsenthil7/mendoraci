import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-010 — Approvals audit list page (CP-9.3c).
 *
 * Tests:
 *   Pw-012a renders all primary controls + at least one row after seeding
 *   Pw-012b filter by repair_plan_id returns exactly the rows for that plan
 *   Pw-012c action dropdown switches result set (approve vs reject)
 *   Pw-012d cursor pagination Next/Prev (limit=3 over 6 audit rows)
 *   Pw-012e empty state for impossible actor filter
 *   Pw-012f row checkboxes + select-all + Open link nav to
 *           /repair-plan/[id]/approve
 *
 * Note: filter-repair-plan-id is an UN-debounced input (because typing a
 * full UUID by hand is rare; users will paste or arrive via URL). Pw tests
 * therefore drive that filter via page.goto to avoid 36-keystroke fetch
 * races, NOT via .fill().
 */

async function seedPipeline(
  prefix: string,
  action: 'submit' | 'approve' | 'reject',
): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr010-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr010-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-appr-list' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;

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
  if (action === 'approve') {
    await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
      headers: { 'content-type': 'application/json' },
      data: { approver: 'alice@acme.test' },
    });
  } else if (action === 'reject') {
    await ctx.post(`/v1/repair-plan/${repairPlanId}/reject`, {
      headers: { 'content-type': 'application/json' },
      data: { approver: 'bob@acme.test', reason: 'too risky' },
    });
  }
  await ctx.dispose();
  return { intakeId, repairPlanId };
}

async function gotoAndWait(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await expect
    .poll(
      async () => {
        const skeleton = await page.getByTestId('row-skeleton-0').count();
        const rows = await page.locator('[data-testid^="approval-row-"]').count();
        const empty = await page.getByTestId('empty-row').count();
        const error = await page.getByTestId('error-row').count();
        return skeleton === 0 && rows + empty + error > 0;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe('SCR-010 — Approvals list page', () => {
  test('TEST-Pw-012a: renders all primary controls + at least one row', async ({ page }) => {
    await seedPipeline('renders', 'approve');
    await gotoAndWait(page, '/approvals');
    await expect(page.getByTestId('scr-010-approvals-list')).toBeVisible();
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('filter-actor')).toBeVisible();
    await expect(page.getByTestId('filter-action')).toBeVisible();
    await expect(page.getByTestId('filter-repair-plan-id')).toBeVisible();
    await expect(page.getByTestId('filter-intake-id')).toBeVisible();
    await expect(page.getByTestId('filter-limit')).toBeVisible();
    await expect(page.getByTestId('page-next')).toBeVisible();
    await expect(page.getByTestId('page-prev')).toBeVisible();
    await expect(page.getByTestId('link-back-intakes')).toBeVisible();
    await expect(page.locator('[data-testid^="approval-row-"]').first()).toBeVisible();
  });

  test('TEST-Pw-012b: filter by repair_plan_id returns exactly the rows for that plan', async ({ page }) => {
    const target = await seedPipeline('target', 'approve'); // creates 2 rows (submit + approve)
    await seedPipeline('other-1', 'submit');
    await seedPipeline('other-2', 'reject');

    await gotoAndWait(page, `/approvals?repair_plan_id=${target.repairPlanId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBe(2);
    const planIds = await page
      .locator('[data-testid^="approval-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-repair-plan-id')));
    planIds.forEach((id) => expect(id).toBe(target.repairPlanId));
  });

  test('TEST-Pw-012c: action dropdown switches result set (approve vs reject)', async ({ page }) => {
    const tag = `act-${Date.now()}`;
    await seedPipeline(`${tag}-a1`, 'approve');
    await seedPipeline(`${tag}-a2`, 'approve');
    await seedPipeline(`${tag}-r1`, 'reject');

    await gotoAndWait(page, '/approvals');

    // action=approve
    await page.getByTestId('filter-action').selectOption('approve');
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBeGreaterThanOrEqual(2);
    const approveActions = await page.locator('[data-testid^="action-"]').allTextContents();
    approveActions.forEach((t) => expect(t.trim()).toBe('approve'));

    // action=reject
    await page.getByTestId('filter-action').selectOption('reject');
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    const rejectActions = await page.locator('[data-testid^="action-"]').allTextContents();
    rejectActions.forEach((t) => expect(t.trim()).toBe('reject'));
  });

  test('TEST-Pw-012d: cursor pagination Next/Prev (limit=3 over 6 audit rows)', async ({ page }) => {
    const tag = `pg-${Date.now()}`;
    // Each approve plan creates 2 audit rows (submit + approve). Three plans = 6 rows.
    await seedPipeline(`${tag}-1`, 'approve');
    await new Promise((r) => setTimeout(r, 5));
    await seedPipeline(`${tag}-2`, 'approve');
    await new Promise((r) => setTimeout(r, 5));
    await seedPipeline(`${tag}-3`, 'approve');

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/approvals?from=${encodeURIComponent(fromIso)}&limit=3`);

    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBe(3);
    const firstPage = await page
      .locator('[data-testid^="approval-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-approval-id')));

    await expect(page.getByTestId('page-next')).toBeEnabled();
    await page.getByTestId('page-next').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    const secondPage = await page
      .locator('[data-testid^="approval-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-approval-id')));
    secondPage.forEach((id) => expect(firstPage).not.toContain(id));

    await expect(page.getByTestId('page-prev')).toBeEnabled();
    await page.getByTestId('page-prev').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBe(3);
  });

  test('TEST-Pw-012e: empty state for impossible actor filter', async ({ page }) => {
    await gotoAndWait(page, '/approvals?actor=__never_existed_zzzz__');
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('empty-cta')).toBeVisible();
  });

  test('TEST-Pw-012f: checkboxes + select-all + Open nav', async ({ page }) => {
    const a = await seedPipeline(`sel-${Date.now()}-a`, 'approve');
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedPipeline(`sel-${Date.now()}-b`, 'approve');
    await new Promise((r) => setTimeout(r, 5));

    // Scope to plan a (2 audit rows). filter-repair-plan-id is un-debounced
    // so we drive it via URL not .fill() to avoid per-keystroke fetch races.
    await gotoAndWait(page, `/approvals?repair_plan_id=${a.repairPlanId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBe(2);

    const firstApprovalId = await page
      .locator('[data-testid^="approval-row-"]')
      .first()
      .evaluate((n) => (n as HTMLElement).getAttribute('data-approval-id'));
    expect(firstApprovalId).toBeTruthy();

    await page.getByTestId(`row-checkbox-${firstApprovalId}`).check();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    await page.getByTestId('select-all').check();
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');

    await page.getByTestId('select-all').uncheck();
    await expect(page.getByTestId('selection-count')).toHaveCount(0);

    // Switch scope to plan b via URL navigation (no per-keystroke race)
    await gotoAndWait(page, `/approvals?repair_plan_id=${b.repairPlanId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="approval-row-"]').count())
      .toBe(2);
    const bApprovalId = await page
      .locator('[data-testid^="approval-row-"]')
      .first()
      .evaluate((n) => (n as HTMLElement).getAttribute('data-approval-id'));
    expect(bApprovalId).toBeTruthy();

    await page.getByTestId(`row-open-${bApprovalId}`).click();
    await page.waitForURL(
      (url) => url.pathname === `/repair-plan/${b.repairPlanId}/approve`,
      { timeout: 15_000 },
    );
  });
});
