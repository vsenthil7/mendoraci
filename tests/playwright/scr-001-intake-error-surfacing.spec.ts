import { test, expect } from '@playwright/test';

/**
 * TEST-Pw-003 — SCR-001 server-error UI surfacing.
 * Anchors: BR-001 / RT-001 / UX requirement that user-visible errors are clear.
 *
 * Intercepts the /api/v1/intake call to simulate API errors and asserts that
 * the page displays the error JSON to the user (test-id 'intake-error') and
 * the status flips to 'error'.
 */
test.describe('SCR-001 — Intake page (error surfacing)', () => {
  test('TEST-Pw-003a: surfaces 500 from API into the UI', async ({ page }) => {
    await page.route('**/api/v1/intake', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }),
      }),
    );
    await page.goto('/');
    await page.getByTestId('submit-sample').click();
    await expect(page.getByTestId('intake-status')).toHaveText('error');
    const errText = await page.getByTestId('intake-error').textContent();
    expect(errText ?? '').toContain('internal_error');
  });

  test('TEST-Pw-003b: surfaces 422 validation_failed from API into the UI', async ({ page }) => {
    await page.route('**/api/v1/intake', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'validation_failed',
            message: 'request_body_invalid',
            validation_errors: [{ path: 'provider', message: 'Invalid enum value' }],
          },
        }),
      }),
    );
    await page.goto('/');
    await page.getByTestId('submit-sample').click();
    await expect(page.getByTestId('intake-status')).toHaveText('error');
    const errText = await page.getByTestId('intake-error').textContent();
    expect(errText ?? '').toContain('validation_failed');
  });

  test('TEST-Pw-003c: surfaces network failure (api down) into the UI', async ({ page }) => {
    await page.route('**/api/v1/intake', (route) => route.abort('failed'));
    await page.goto('/');
    await page.getByTestId('submit-sample').click();
    await expect(page.getByTestId('intake-status')).toHaveText('error');
  });
});
