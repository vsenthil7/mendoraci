import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-008 — RCA findings list page (CP-9.3a).
 *
 * Tests:
 *   Pw-010a renders all primary controls + at least one RCA row after seeding
 *   Pw-010b filter by intake_id returns exactly the target RCA
 *   Pw-010c filter by confidence dropdown (high -> low) - tests dropdown
 *           interaction without doing two page.goto() calls (firefox
 *           aborts in-flight requests on rapid navigation)
 *   Pw-010d cursor pagination Next/Prev (limit=2 over 3 RCAs)
 *   Pw-010e empty state for impossible q filter
 *   Pw-010f row checkboxes + select-all + Open link nav to /intake/[id]/rca
 */

async function seedRca(prefix: string): Promise<{ intakeId: string; rcaFindingId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr008-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr008-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-rca-list' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;

  const rca = await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(rca.status()).toBe(201);
  const rcaFindingId = (await rca.json()).rca_finding_id as string;
  await ctx.dispose();
  return { intakeId, rcaFindingId };
}

/**
 * Goto a /rca URL and wait for the list to settle (skeleton gone + either
 * rows / empty-row / error-row present).
 */
async function gotoAndWait(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await expect
    .poll(
      async () => {
        const skeleton = await page.getByTestId('row-skeleton-0').count();
        const rows = await page.locator('[data-testid^="rca-row-"]').count();
        const empty = await page.getByTestId('empty-row').count();
        const error = await page.getByTestId('error-row').count();
        return skeleton === 0 && rows + empty + error > 0;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe('SCR-008 — RCA list page', () => {
  test('TEST-Pw-010a: renders all primary controls + at least one row', async ({ page }) => {
    await seedRca('renders');
    await gotoAndWait(page, '/rca');
    await expect(page.getByTestId('scr-008-rca-list')).toBeVisible();
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('filter-q')).toBeVisible();
    await expect(page.getByTestId('filter-confidence')).toBeVisible();
    await expect(page.getByTestId('filter-provider')).toBeVisible();
    await expect(page.getByTestId('filter-intake-id')).toBeVisible();
    await expect(page.getByTestId('filter-limit')).toBeVisible();
    await expect(page.getByTestId('page-next')).toBeVisible();
    await expect(page.getByTestId('page-prev')).toBeVisible();
    await expect(page.getByTestId('link-back-intakes')).toBeVisible();
    await expect(page.locator('[data-testid^="rca-row-"]').first()).toBeVisible();
  });

  test('TEST-Pw-010b: filter by intake_id returns exactly 1 RCA', async ({ page }) => {
    const target = await seedRca('target');
    await seedRca('other-1');
    await seedRca('other-2');

    await gotoAndWait(page, `/rca?intake_id=${target.intakeId}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBe(1);
    await expect(page.getByTestId(`rca-row-${target.rcaFindingId}`)).toBeVisible();
  });

  test('TEST-Pw-010c: confidence dropdown switches result set (high -> low -> empty)', async ({ page }) => {
    const tag = `conf-${Date.now()}`;
    await seedRca(tag);
    await seedRca(`${tag}-b`);

    // Land on /rca with no filter
    await gotoAndWait(page, '/rca');

    // Use the dropdown (mimics real-user behaviour). This avoids two page.goto()
    // calls that firefox sometimes aborts mid-flight with NS_BINDING_ABORTED.
    await page.getByTestId('filter-confidence').selectOption('high');
    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBeGreaterThanOrEqual(2);

    await page.getByTestId('filter-confidence').selectOption('low');
    await expect(page.getByTestId('empty-row')).toBeVisible({ timeout: 15_000 });
  });

  test('TEST-Pw-010d: cursor pagination Next/Prev (limit=2 over 3 rows)', async ({ page }) => {
    const tag = `pg-${Date.now()}`;
    const { intakeId: i1 } = await seedRca(`${tag}-1`);
    await new Promise((r) => setTimeout(r, 5));
    const { intakeId: i2 } = await seedRca(`${tag}-2`);
    await new Promise((r) => setTimeout(r, 5));
    const { intakeId: i3 } = await seedRca(`${tag}-3`);

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/rca?from=${encodeURIComponent(fromIso)}&limit=2`);

    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBe(2);
    const firstPage = await page
      .locator('[data-testid^="rca-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-rca-finding-id')));

    await expect(page.getByTestId('page-next')).toBeEnabled();
    await page.getByTestId('page-next').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBeGreaterThanOrEqual(1);
    const secondPage = await page
      .locator('[data-testid^="rca-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-rca-finding-id')));
    secondPage.forEach((id) => expect(firstPage).not.toContain(id));

    await expect(page.getByTestId('page-prev')).toBeEnabled();
    await page.getByTestId('page-prev').click();
    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBe(2);

    void i1;
    void i2;
    void i3;
  });

  test('TEST-Pw-010e: empty state for impossible q filter', async ({ page }) => {
    await gotoAndWait(page, '/rca?q=__rca_no_match_zzzz_impossible__');
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('empty-cta')).toBeVisible();
  });

  test('TEST-Pw-010f: checkboxes + select-all + Open nav', async ({ page }) => {
    const a = await seedRca(`sel-${Date.now()}-a`);
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedRca(`sel-${Date.now()}-b`);
    await new Promise((r) => setTimeout(r, 5));

    const fromIso = new Date(Date.now() - 60_000).toISOString();
    await gotoAndWait(page, `/rca?from=${encodeURIComponent(fromIso)}`);
    await expect
      .poll(async () => await page.locator('[data-testid^="rca-row-"]').count())
      .toBeGreaterThanOrEqual(2);

    await page.getByTestId(`row-checkbox-${a.rcaFindingId}`).check();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    await page.getByTestId('select-all').check();
    const visibleCount = await page.locator('[data-testid^="rca-row-"]').count();
    await expect(page.getByTestId('selection-count')).toHaveText(`${visibleCount} selected`);

    await page.getByTestId('select-all').uncheck();
    await expect(page.getByTestId('selection-count')).toHaveCount(0);

    await page.getByTestId(`row-open-${b.rcaFindingId}`).click();
    await page.waitForURL((url) => url.pathname === `/intake/${b.intakeId}/rca`, {
      timeout: 15_000,
    });

    void a;
  });
});
