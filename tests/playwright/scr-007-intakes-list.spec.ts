import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-007 — Intakes list page (CP-9.2).
 *
 * Tests:
 *   Pw-009a renders all primary controls + at least one row (after seeding)
 *   Pw-009b free-text q narrows the list to a single matching run_id
 *   Pw-009c plan_status=approved filter restricts rows to the approved one
 *   Pw-009d cursor pagination: limit=2 yields a Next button; clicking it
 *           shows non-overlapping rows; Prev returns to original page
 *   Pw-009e empty state for a tenant with no data (filter that returns 0)
 *   Pw-009f row checkboxes + select-all surface selection count badge;
 *           clicking Open → navigates to /intake/[id]/rca
 *
 * Seeding strategy: each test seeds ITS OWN intakes via the API so we don't
 * depend on shared state. Each test uses a unique run_id prefix so the q
 * filter can deterministically isolate them in a shared DB.
 */

async function seedIntake(
  prefix: string,
  opts: { rca?: boolean; plan?: boolean; approve?: boolean; exportZip?: boolean } = {},
): Promise<string> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr007-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr007-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-list' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;

  if (opts.rca || opts.plan || opts.approve || opts.exportZip) {
    await ctx.post(`/v1/intake/${intakeId}/rca`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
  }
  if (opts.plan || opts.approve || opts.exportZip) {
    const plan = await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    const repairPlanId = (await plan.json()).repair_plan_id as string;
    if (opts.approve || opts.exportZip) {
      await ctx.post(`/v1/repair-plan/${repairPlanId}/submit`, {
        headers: { 'content-type': 'application/json' },
        data: {},
      });
      await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
        headers: { 'content-type': 'application/json' },
        data: { approver: 'pw-approver@acme.test' },
      });
    }
    if (opts.exportZip) {
      await ctx.post(`/v1/intake/${intakeId}/evidence-export`, {
        headers: { 'content-type': 'application/json' },
        data: {},
      });
    }
  }
  await ctx.dispose();
  return intakeId;
}

test.describe('SCR-007 — Intakes list page', () => {
  test('TEST-Pw-009a: renders all primary controls + at least one row', async ({ page }) => {
    await seedIntake('renders');
    await page.goto('/intakes');
    await expect(page.getByTestId('scr-007-intakes-list')).toBeVisible();
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('filter-q')).toBeVisible();
    await expect(page.getByTestId('filter-provider')).toBeVisible();
    await expect(page.getByTestId('filter-plan-status')).toBeVisible();
    await expect(page.getByTestId('filter-has-rca')).toBeVisible();
    await expect(page.getByTestId('filter-has-plan')).toBeVisible();
    await expect(page.getByTestId('filter-has-export')).toBeVisible();
    await expect(page.getByTestId('filter-limit')).toBeVisible();
    await expect(page.getByTestId('page-next')).toBeVisible();
    await expect(page.getByTestId('page-prev')).toBeVisible();
    await expect(page.getByTestId('cta-new-intake')).toBeVisible();
    // At least one row visible (we just seeded one) - skeleton has been
    // replaced by real rows, so loop until either a real row or empty row
    // shows up.
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count() > 0
    ).toBe(true);
  });

  test('TEST-Pw-009b: free-text q narrows list to matching run_id', async ({ page }) => {
    const needle = `needle-${Date.now()}`;
    await seedIntake(needle);
    await seedIntake('haystack-a');
    await seedIntake('haystack-b');
    await page.goto('/intakes');

    // Type into the search box; debounce will fire after ~250ms
    await page.getByTestId('filter-q').fill(needle);
    // Wait until the URL reflects the filter (driven by useEffect on filters)
    await page.waitForURL((url) => url.searchParams.get('q') === needle);
    // Wait for the list to settle to exactly 1 row
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(1);
    const onlyRow = page.locator('[data-testid^="intake-row-"]').first();
    await expect(onlyRow).toContainText(needle);
  });

  test('TEST-Pw-009c: plan_status=approved filter restricts to approved rows', async ({ page }) => {
    const tag = `approved-${Date.now()}`;
    const approvedId = await seedIntake(tag, { approve: true });
    await seedIntake(`plain-${tag}`); // no rca, no plan

    await page.goto(`/intakes?q=${encodeURIComponent(tag)}&plan_status=approved`);
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(1);
    const row = page.getByTestId(`intake-row-${approvedId}`);
    await expect(row).toBeVisible();
    await expect(page.getByTestId(`plan-status-${approvedId}`)).toHaveText('approved');
  });

  test('TEST-Pw-009d: cursor pagination Next/Prev (limit=2 over 3 rows)', async ({ page }) => {
    const tag = `pg-${Date.now()}`;
    await seedIntake(`${tag}-1`);
    await new Promise((r) => setTimeout(r, 5));
    await seedIntake(`${tag}-2`);
    await new Promise((r) => setTimeout(r, 5));
    await seedIntake(`${tag}-3`);

    await page.goto(`/intakes?q=${encodeURIComponent(tag)}&limit=2`);
    // Wait until exactly 2 rows render (limit=2)
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(2);
    const firstPageIds = await page
      .locator('[data-testid^="intake-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-intake-id')));

    // Next page
    await expect(page.getByTestId('page-next')).toBeEnabled();
    await page.getByTestId('page-next').click();
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(1);
    const secondPageIds = await page
      .locator('[data-testid^="intake-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-intake-id')));
    // No overlap between pages
    secondPageIds.forEach((id) => expect(firstPageIds).not.toContain(id));

    // Prev should re-show the first page
    await expect(page.getByTestId('page-prev')).toBeEnabled();
    await page.getByTestId('page-prev').click();
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(2);
    const backIds = await page
      .locator('[data-testid^="intake-row-"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).getAttribute('data-intake-id')));
    expect(new Set(backIds)).toEqual(new Set(firstPageIds));
  });

  test('TEST-Pw-009e: empty state for filter with no matches', async ({ page }) => {
    // A run_id that cannot exist
    await page.goto('/intakes?q=__none_will_ever_match_this_string_zzzz__');
    await expect(page.getByTestId('empty-row')).toBeVisible();
    await expect(page.getByTestId('empty-cta')).toBeVisible();
    await expect(page.locator('[data-testid^="intake-row-"]')).toHaveCount(0);
  });

  test('TEST-Pw-009f: row checkboxes + select-all + Open link nav', async ({ page }) => {
    const tag = `sel-${Date.now()}`;
    const id1 = await seedIntake(`${tag}-1`);
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await seedIntake(`${tag}-2`);

    await page.goto(`/intakes?q=${encodeURIComponent(tag)}`);
    await expect.poll(async () =>
      await page.locator('[data-testid^="intake-row-"]').count()
    ).toBe(2);

    // Per-row checkbox
    await page.getByTestId(`row-checkbox-${id1}`).check();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    // Select all
    await page.getByTestId('select-all').check();
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');

    // Unselect-all
    await page.getByTestId('select-all').uncheck();
    await expect(page.getByTestId('selection-count')).toHaveCount(0);

    // Click Open → /intake/[id]/rca
    await page.getByTestId(`row-open-${id2}`).click();
    await page.waitForURL((url) => url.pathname === `/intake/${id2}/rca`);
  });
});
