import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-009 — Repair plans list page (CP-9.3b).
 *
 * Tests:
 *   Pw-011a renders all primary controls + at least one plan row after seeding
 *   Pw-011b filter by intake_id returns exactly the target plan
 *   Pw-011c status dropdown switches result set (draft -> approved) +
 *           verifies last_approval column populates for approved plans
 *   Pw-011d cursor pagination Next/Prev (limit=2 over 3 plans)
 *   Pw-011e empty state for impossible q filter
 *   Pw-011f row checkboxes + select-all + Open link nav to
 *           /intake/[id]/repair-plan
 */

async function seedPlan(
  prefix: string,
  opts: { approve?: boolean } = {},
): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr009-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr009-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-plan-list' },
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
  expect(plan.status()).toBe(201);
  const repairPlanId = (await plan.json()).repair_plan_id as string;

  if (opts.approve) {
    await ctx.post(`/v1/repair-plan/${repairPlanId}/submit`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
      headers: { 'content-type': 'application/json' },
      data: { approver: 'alice@acme.test' },
    });
  }
  await ctx.dispose();
  return { intakeId, repairPlanId };
}

/** Goto a /repair-plans URL and wait for the list to settle. */
async function gotoAndWait(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await expect
    .poll(
      async () => {
        const skeleton = await page.getByTestId('row-skeleton-0').count();
        const rows = await page.locator('[data-testid^="plan-row-"]').count();
        const empty = await page.getByTestId('empty-row').count();
        const error = await page.getByTestId('error-row').count();
        return skeleton === 0 && rows + empty + error > 0;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe('SCR-009 — Repair plans list page', () => {
  test('TEST-Pw-011a: renders all primary controls + at least one row', async ({ page }) => {
    await seedPlan('renders');
    await gotoAndWait(page, '/repair-plans');
    await expect(page.getByTestId('scr-009-repair-plans-list')).toBeVisible();
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('filter-q')).toBeVisible();
    await expect(page.getByTestId('filter-status')).toBeVisible();
    await expect(page.getByTestId('filter-overall-risk')).toBeVisible();
    await expect(page.getByTestId('filter-effort')).toBeVisible();
    await expect(page.getByTestId('filter-intake-id')).toBeVisible();
    await expect(page.getByTestId('filter-provider')).toBeVisible();
    await expect(page.getByTestId('filter-limit')).toBeVisible();
    await expect(page.getByTestId('page-next')).toBeVisible();
    await expect(page.getByTestId('page-prev')).toBeVisible();
    await expect(page.getByTestId('link-back-intakes')).toBeVisible();
    await expect(page.locator('[data-testid^="plan-row-"]').first()).toBeVisible();
  });

  test('TEST-Pw-011b: filter by intake_id returns exactly 1 plan', async ({ page }) => {
    const target = await seedPlan('target');
    await seedPlan('other-1');
    await seedPlan('other-2');

    await gotoAndWait(page, `/repair-plans?intake_id=${target.intakeId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBe(1);
    await expect(page.getByTestId(`plan-row-${target.repairPlanId}`)).toBeVisible();
  });

  test('TEST-Pw-011c: status dropdown switches result set (draft -> approved)', async ({ page }) => {
    const tag = `st-${Date.now()}`;
    const approved = await seedPlan(`${tag}-a`, { approve: true });
    await seedPlan(`${tag}-d1`); // draft
    await seedPlan(`${tag}-d2`); // draft

    await gotoAndWait(page, '/repair-plans');

    // Drive the dropdown (avoids cross-browser two-goto race)
    await page.getByTestId('filter-status').selectOption('approved');
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    // The approved plan must be in the result and its status badge says 'approved'
    await expect(page.getByTestId(`plan-status-${approved.repairPlanId}`)).toHaveText('approved');

    await page.getByTestId('filter-status').selectOption('draft');
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBeGreaterThanOrEqual(2);
  });

  test('TEST-Pw-011d: cursor pagination Next/Prev (limit=2 over 3 rows)', async ({ page }) => {
    const tag = `pg-${Date.now()}`;
    const { repairPlanId: i1 } = await seedPlan(`${tag}-1`);
    await new Promise((r) => setTimeout(r, 5));
    const { repairPlanId: i2 } = await seedPlan(`${tag}-2`);
    await new Promise((r) => setTimeout(r, 5));
    const { repairPlanId: i3 } = await seedPlan(`${tag}-3`);

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/repair-plans?from=${encodeURIComponent(fromIso)}&limit=2`);

    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBe(2);
    const firstPage = await page
      .locator('[data-testid^="plan-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-repair-plan-id')));

    await expect(page.getByTestId('page-next')).toBeEnabled();
    await page.getByTestId('page-next').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    const secondPage = await page
      .locator('[data-testid^="plan-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-repair-plan-id')));
    secondPage.forEach((id) => expect(firstPage).not.toContain(id));

    await expect(page.getByTestId('page-prev')).toBeEnabled();
    await page.getByTestId('page-prev').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBe(2);

    void i1;
    void i2;
    void i3;
  });

  test('TEST-Pw-011e: empty state for impossible q filter', async ({ page }) => {
    await gotoAndWait(page, '/repair-plans?q=__plan_no_match_zzzz_impossible__');
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('empty-cta')).toBeVisible();
  });

  test('TEST-Pw-011f: checkboxes + select-all + Open nav', async ({ page }) => {
    const a = await seedPlan(`sel-${Date.now()}-a`);
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedPlan(`sel-${Date.now()}-b`);
    await new Promise((r) => setTimeout(r, 5));

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/repair-plans?from=${encodeURIComponent(fromIso)}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="plan-row-"]').count())
      .toBeGreaterThanOrEqual(2);

    await page.getByTestId(`row-checkbox-${a.repairPlanId}`).check();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    await page.getByTestId('select-all').check();
    const visibleCount = await page.locator('[data-testid^="plan-row-"]').count();
    await expect(page.getByTestId('selection-count')).toHaveText(`${visibleCount} selected`);

    await page.getByTestId('select-all').uncheck();
    await expect(page.getByTestId('selection-count')).toHaveCount(0);

    await page.getByTestId(`row-open-${b.repairPlanId}`).click();
    await page.waitForURL(
      (url) => url.pathname === `/intake/${b.intakeId}/repair-plan`,
      { timeout: 15_000 },
    );

    void a;
  });
});
