import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-002 — Repo Linking page (RT-002 / API-003).
 *
 * Tests:
 *   Pw-004a renders all primary controls
 *   Pw-004b happy: submit -> 201 -> link-response visible
 *   Pw-004c duplicate link: 409 surfaced into the UI
 *   Pw-004d unknown intake: 404 surfaced
 *   Pw-004e invalid URL: 422 surfaced (server-side validation)
 *   Pw-004f back-to-intake button navigates to /
 *
 * Each test creates its own intake via the API so they're independent.
 */

const KNOWN_BAD_INTAKE = '99999999-9999-4999-8999-999999999999';

async function createIntake(): Promise<string> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  const idem = `k-pw-scr002-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr002-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: { type: 'log', body_base64: Buffer.from('build failed\n').toString('base64') },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw' },
    },
  });
  expect(r.status()).toBe(201);
  const id = (await r.json()).intake_id as string;
  await ctx.dispose();
  return id;
}

test.describe('SCR-002 — Repo Linking page', () => {
  test('TEST-Pw-004a: renders all primary controls', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repo`);
    await expect(page.getByTestId('scr-002-link-repo')).toBeVisible();
    await expect(page.getByTestId('provider-select')).toBeVisible();
    await expect(page.getByTestId('repo-url-input')).toBeVisible();
    await expect(page.getByTestId('default-branch-input')).toBeVisible();
    await expect(page.getByTestId('submit-link')).toBeVisible();
    await expect(page.getByTestId('back-to-intake')).toBeVisible();
  });

  test('TEST-Pw-004b: happy path links repo and renders 201 response', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repo`);

    const respPromise = page.waitForResponse(
      (r) => r.url().includes(`/api/v1/intake/${intakeId}/link-repo`) && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-link').click();
    const resp = await respPromise;
    expect(resp.status()).toBe(201);

    await expect(page.getByTestId('link-status')).toHaveText('linked');
    const text = await page.getByTestId('link-response').textContent();
    expect(text ?? '').toContain('repo_link_id');
    expect(text ?? '').toContain('github');
    expect(text ?? '').toContain(intakeId);
  });

  test('TEST-Pw-004c: duplicate link returns 409 surfaced in UI', async ({ page }) => {
    const intakeId = await createIntake();
    // First link (via API direct, no UI) to set up the conflict.
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const first = await ctx.post(`/v1/intake/${intakeId}/link-repo`, {
      headers: { 'content-type': 'application/json' },
      data: { repo_provider: 'github', repo_url: 'https://github.com/acme/widget', default_branch: 'main' },
    });
    expect(first.status()).toBe(201);
    await ctx.dispose();

    // Now the UI tries again.
    await page.goto(`/intake/${intakeId}/repo`);
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('link-status')).toHaveText('error');
    const err = await page.getByTestId('link-error').textContent();
    expect(err ?? '').toContain('repo_already_linked');
  });

  test('TEST-Pw-004d: unknown intake returns 404 surfaced in UI', async ({ page }) => {
    await page.goto(`/intake/${KNOWN_BAD_INTAKE}/repo`);
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('link-status')).toHaveText('error');
    const err = await page.getByTestId('link-error').textContent();
    expect(err ?? '').toContain('intake_not_found');
  });

  test('TEST-Pw-004e: invalid URL returns 422 surfaced in UI', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repo`);
    await page.getByTestId('repo-url-input').fill('not-a-real-url');
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('link-status')).toHaveText('error');
    const err = await page.getByTestId('link-error').textContent();
    expect(err ?? '').toContain('validation_failed');
  });

  test('TEST-Pw-004f: back-to-intake navigates to /', async ({ page }) => {
    const intakeId = await createIntake();
    await page.goto(`/intake/${intakeId}/repo`);
    await page.getByTestId('back-to-intake').click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByTestId('scr-001-intake')).toBeVisible();
  });
});
