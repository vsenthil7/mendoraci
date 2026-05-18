import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-011 — Evidence exports list page (CP-9.3d).
 *
 * Tests:
 *   Pw-013a renders all primary controls + at least one evidence row after seeding
 *   Pw-013b filter by intake_id returns exactly that intake's exports
 *   Pw-013c filter by repair_plan_id returns exactly that plan's exports
 *           (driven via page.goto, NOT .fill() - un-debounced UUID input,
 *           CP-9.3c Pw-012f lesson)
 *   Pw-013d cursor pagination Next/Prev (limit=2 over 3 exports)
 *   Pw-013e empty state for impossible intake_id filter
 *   Pw-013f checkboxes + select-all + Open link nav to /intake/[id]/evidence
 *
 * Seed pipeline: intake -> rca -> repair-plan -> submit -> approve -> evidence-export.
 * Mock-Bob path makes the pipeline deterministic.
 */

async function seedEvidence(
  prefix: string,
): Promise<{ intakeId: string; repairPlanId: string; evidenceExportId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr011-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr011-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-evd-list' },
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

  await ctx.post(`/v1/repair-plan/${repairPlanId}/submit`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
    headers: { 'content-type': 'application/json' },
    data: { approver: 'alice@acme.test' },
  });
  const evd = await ctx.post(`/v1/intake/${intakeId}/evidence-export`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(evd.status()).toBe(201);
  const evidenceExportId = (await evd.json()).evidence_export_id as string;
  await ctx.dispose();
  return { intakeId, repairPlanId, evidenceExportId };
}

async function gotoAndWait(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await expect
    .poll(
      async () => {
        const skeleton = await page.getByTestId('row-skeleton-0').count();
        const rows = await page.locator('[data-testid^="evidence-row-"]').count();
        const empty = await page.getByTestId('empty-row').count();
        const error = await page.getByTestId('error-row').count();
        return skeleton === 0 && rows + empty + error > 0;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe('SCR-011 — Evidence exports list page', () => {
  test('TEST-Pw-013a: renders all primary controls + at least one row', async ({ page }) => {
    await seedEvidence('renders');
    await gotoAndWait(page, '/evidence');
    await expect(page.getByTestId('scr-011-evidence-list')).toBeVisible();
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('filter-intake-id')).toBeVisible();
    await expect(page.getByTestId('filter-repair-plan-id')).toBeVisible();
    await expect(page.getByTestId('filter-from')).toBeVisible();
    await expect(page.getByTestId('filter-to')).toBeVisible();
    await expect(page.getByTestId('filter-limit')).toBeVisible();
    await expect(page.getByTestId('page-next')).toBeVisible();
    await expect(page.getByTestId('page-prev')).toBeVisible();
    await expect(page.getByTestId('link-back-intakes')).toBeVisible();
    await expect(page.locator('[data-testid^="evidence-row-"]').first()).toBeVisible();
  });

  test('TEST-Pw-013b: filter by intake_id returns exactly 1 export', async ({ page }) => {
    const target = await seedEvidence('target');
    await seedEvidence('other-1');
    await seedEvidence('other-2');

    await gotoAndWait(page, `/evidence?intake_id=${target.intakeId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBe(1);
    await expect(page.getByTestId(`evidence-row-${target.evidenceExportId}`)).toBeVisible();
    await expect(page.getByTestId(`sha256-${target.evidenceExportId}`)).toBeVisible();
  });

  test('TEST-Pw-013c: filter by repair_plan_id (via page.goto, un-debounced UUID input)', async ({ page }) => {
    const target = await seedEvidence('plan-target');
    await seedEvidence('plan-other-1');
    await seedEvidence('plan-other-2');

    await gotoAndWait(page, `/evidence?repair_plan_id=${target.repairPlanId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBe(1);
    const planIds = await page
      .locator('[data-testid^="evidence-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-repair-plan-id')));
    planIds.forEach((id) => expect(id).toBe(target.repairPlanId));
  });

  test('TEST-Pw-013d: cursor pagination Next/Prev (limit=2 over 3 exports)', async ({ page }) => {
    const tag = `pg-${Date.now()}`;
    await seedEvidence(`${tag}-1`);
    await new Promise((r) => setTimeout(r, 5));
    await seedEvidence(`${tag}-2`);
    await new Promise((r) => setTimeout(r, 5));
    await seedEvidence(`${tag}-3`);

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/evidence?from=${encodeURIComponent(fromIso)}&limit=2`);

    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBe(2);
    const firstPage = await page
      .locator('[data-testid^="evidence-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-evidence-export-id')));

    await expect(page.getByTestId('page-next')).toBeEnabled();
    await page.getByTestId('page-next').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    const secondPage = await page
      .locator('[data-testid^="evidence-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-evidence-export-id')));
    secondPage.forEach((id) => expect(firstPage).not.toContain(id));

    await expect(page.getByTestId('page-prev')).toBeEnabled();
    await page.getByTestId('page-prev').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBe(2);
  });

  test('TEST-Pw-013e: empty state for impossible intake_id filter', async ({ page }) => {
    await gotoAndWait(page, '/evidence?intake_id=00000000-0000-0000-0000-000000000000');
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('empty-cta')).toBeVisible();
  });

  test('TEST-Pw-013f: checkboxes + select-all + Open nav', async ({ page }) => {
    // Use SCR-008 pattern: ONE gotoAndWait at the start, no mid-test re-nav.
    // Filter by from-window so both seeded rows appear on the same page.
    const a = await seedEvidence(`sel-${Date.now()}-a`);
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedEvidence(`sel-${Date.now()}-b`);
    await new Promise((r) => setTimeout(r, 5));

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/evidence?from=${encodeURIComponent(fromIso)}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="evidence-row-"]').count())
      .toBeGreaterThanOrEqual(2);

    await page.getByTestId(`row-checkbox-${a.evidenceExportId}`).check();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    await page.getByTestId('select-all').check();
    const visibleCount = await page.locator('[data-testid^="evidence-row-"]').count();
    await expect(page.getByTestId('selection-count')).toHaveText(`${visibleCount} selected`);

    await page.getByTestId('select-all').uncheck();
    await expect(page.getByTestId('selection-count')).toHaveCount(0);

    // Click row b's Open link directly (no second navigation; b's row is
    // visible on the same page as a's because of the from-window filter).
    await page.getByTestId(`row-open-${b.evidenceExportId}`).click();
    await page.waitForURL((url) => url.pathname === `/intake/${b.intakeId}/evidence`, {
      timeout: 15_000,
    });
  });
});
