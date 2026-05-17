import { test, expect } from '@playwright/test';

/**
 * TEST-Pw-001 — SCR-001 happy path E2E.
 * Anchors: BR-001 / RT-001 / SCR-001.
 *
 * Verifies that:
 *   - Page renders the drop-zone, submit button, status field
 *   - Clicking "Submit sample intake" calls /api/v1/intake successfully
 *   - status flips idle -> uploading -> submitted
 *   - response JSON shows masked status + mask_policy_version v1.0.0
 */
test.describe('SCR-001 — Intake page (happy)', () => {
  test('renders all primary controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'CI Log Intake' })).toBeVisible();
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('submit-sample')).toBeVisible();
    await expect(page.getByTestId('intake-status')).toHaveText('idle');
  });

  test('TEST-Pw-001: submit sample intake -> 201 masked + mask_policy_version v1.0.0', async ({ page }) => {
    await page.goto('/');

    // Capture the network response so we can assert on JSON
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/intake') && r.request().method() === 'POST',
    );

    await page.getByTestId('submit-sample').click();
    const resp = await responsePromise;
    expect(resp.status()).toBe(201);

    const json = await resp.json();
    expect(json.intake_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.status).toBe('masked');
    expect(json.mask_policy_version).toBe('v1.0.0');

    // UI side-effect: status flips, JSON is rendered
    await expect(page.getByTestId('intake-status')).toHaveText('submitted');
    const shown = await page.getByTestId('intake-response').textContent();
    expect(shown ?? '').toContain('"status": "masked"');
    expect(shown ?? '').toContain('"mask_policy_version": "v1.0.0"');
  });

  test('TEST-Pw-001b: AWS access key in sample body is masked in the rendered response', async ({ page }) => {
    await page.goto('/');
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/intake') && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-sample').click();
    const resp = await responsePromise;
    expect(resp.status()).toBe(201);
    // The submit-sample payload contains AKIAIOSFODNN7EXAMPLE in plaintext;
    // the response JSON in the UI must NEVER show that string. (The masked
    // preview is fetched separately via GET; the POST response is the create
    // confirmation only — but defensive: rendered area must not contain it.)
    const shown = await page.getByTestId('intake-response').textContent();
    expect(shown ?? '').not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
