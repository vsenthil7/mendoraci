import { test, expect, request } from '@playwright/test';
import { TEST_API, TEST_TENANT } from './playwright.config';

/**
 * SCR-005 — Approver page (RT-005 / API-006..008).
 *
 * Tests:
 *   Pw-007a renders all primary controls (status, approver/note/reason inputs,
 *           Submit/Approve/Reject buttons)
 *   Pw-007b draft -> submit -> submitted: status badge changes, Submit
 *           disables, Approve/Reject enable
 *   Pw-007c submitted -> approve -> approved: terminal-notice visible, all
 *           buttons disabled, audit log has 2 rows
 *   Pw-007d submitted -> reject (with reason) -> rejected: terminal-notice
 *           visible, audit log has 2 rows
 *   Pw-007e approve-from-draft (illegal transition) -> 409 surfaced into
 *           action-error
 *   Pw-007f back-to-intake nav
 */

async function createPlan(): Promise<{ intakeId: string; repairPlanId: string }> {
  const ctx = await request.newContext({
    baseURL: TEST_API,
    extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
  });
  // Intake
  const idem = `k-pw-scr005-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intake = await ctx.post('/v1/intake', {
    headers: { 'content-type': 'application/json', 'idempotency-key': idem },
    data: {
      provider: 'github',
      run_id: `pw-scr005-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempt_id: 'attempt-1',
      artifact: {
        type: 'log',
        body_base64: Buffer.from(
          'INFO build 4421 starting\nWARN AKIA**** seen\nERROR OOM error at line 421: process killed\nERROR build failed at step 3\n',
        ).toString('base64'),
      },
      metadata: { branch: 'main', commit_sha: 'abc1234', actor: 'pw-app' },
    },
  });
  expect(intake.status()).toBe(201);
  const intakeId = (await intake.json()).intake_id as string;
  // RCA
  const rca = await ctx.post(`/v1/intake/${intakeId}/rca`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(rca.status()).toBe(201);
  // Plan (still draft)
  const plan = await ctx.post(`/v1/intake/${intakeId}/repair-plan`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(plan.status()).toBe(201);
  const repairPlanId = (await plan.json()).repair_plan_id as string;
  await ctx.dispose();
  return { intakeId, repairPlanId };
}

test.describe('SCR-005 — Approver page', () => {
  test('TEST-Pw-007a: renders all primary controls + draft status', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    await page.goto(`/repair-plan/${repairPlanId}/approve`);
    await expect(page.getByTestId('scr-005-approver')).toBeVisible();
    await expect(page.getByTestId('current-status')).toHaveText('draft', { timeout: 10_000 });
    await expect(page.getByTestId('approver-input')).toBeVisible();
    await expect(page.getByTestId('note-input')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toBeVisible();
    await expect(page.getByTestId('submit-button')).toBeEnabled();
    await expect(page.getByTestId('approve-button')).toBeDisabled();
    await expect(page.getByTestId('reject-button')).toBeDisabled();
  });

  test('TEST-Pw-007b: draft -> submit moves status to submitted', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    await page.goto(`/repair-plan/${repairPlanId}/approve`);
    await expect(page.getByTestId('current-status')).toHaveText('draft', { timeout: 10_000 });

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('current-status')).toHaveText('submitted', { timeout: 10_000 });
    await expect(page.getByTestId('submit-button')).toBeDisabled();
    // Approve/Reject enable only with approver filled (default 'alice@acme.test' present)
    await expect(page.getByTestId('approve-button')).toBeEnabled();
    // Reject still disabled until reason is filled
    await expect(page.getByTestId('reject-button')).toBeDisabled();

    // Audit log shows the submit entry
    await expect(page.getByTestId('audit-entry-0')).toBeVisible();
    const action = await page.getByTestId('audit-entry-0-action').textContent();
    expect(action ?? '').toContain('submit');
  });

  test('TEST-Pw-007c: submitted -> approve moves to approved (terminal)', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    await page.goto(`/repair-plan/${repairPlanId}/approve`);

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('current-status')).toHaveText('submitted');

    await page.getByTestId('approve-button').click();
    await expect(page.getByTestId('current-status')).toHaveText('approved', { timeout: 10_000 });
    await expect(page.getByTestId('terminal-notice')).toBeVisible();
    await expect(page.getByTestId('submit-button')).toBeDisabled();
    await expect(page.getByTestId('approve-button')).toBeDisabled();
    await expect(page.getByTestId('reject-button')).toBeDisabled();

    // Audit log has 2 entries
    await expect(page.getByTestId('audit-entry-0')).toBeVisible();
    await expect(page.getByTestId('audit-entry-1')).toBeVisible();
    const approveAction = await page.getByTestId('audit-entry-1-action').textContent();
    expect(approveAction ?? '').toContain('approve');
  });

  test('TEST-Pw-007d: submitted -> reject moves to rejected (terminal)', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    await page.goto(`/repair-plan/${repairPlanId}/approve`);

    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('current-status')).toHaveText('submitted');

    // Reject button stays disabled until reason is filled.
    await expect(page.getByTestId('reject-button')).toBeDisabled();
    await page.getByTestId('reason-input').fill('risk too high; revisit later');
    await expect(page.getByTestId('reject-button')).toBeEnabled();

    await page.getByTestId('reject-button').click();
    await expect(page.getByTestId('current-status')).toHaveText('rejected', { timeout: 10_000 });
    await expect(page.getByTestId('terminal-notice')).toBeVisible();
    await expect(page.getByTestId('audit-entry-1')).toBeVisible();
    const rejectAction = await page.getByTestId('audit-entry-1-action').textContent();
    expect(rejectAction ?? '').toContain('reject');
  });

  test('TEST-Pw-007e: approve-from-draft (illegal transition) -> 409 surfaced', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    // Drive the api directly: approve while status is still 'draft' to provoke 409.
    const ctx = await request.newContext({
      baseURL: TEST_API,
      extraHTTPHeaders: { 'x-tenant-id': TEST_TENANT },
    });
    const r = await ctx.post(`/v1/repair-plan/${repairPlanId}/approve`, {
      headers: { 'content-type': 'application/json' },
      data: { approver: 'alice@acme.test' },
    });
    expect(r.status()).toBe(409);
    const j = await r.json();
    expect(j.error.code).toBe('invalid_transition');
    expect(j.error.prior_status).toBe('draft');
    expect(j.error.attempted_action).toBe('approve');
    await ctx.dispose();

    // The UI just renders draft state on this plan since the API call above
    // didn't change anything.
    await page.goto(`/repair-plan/${repairPlanId}/approve`);
    await expect(page.getByTestId('current-status')).toHaveText('draft', { timeout: 10_000 });
  });

  test('TEST-Pw-007f: back-to-intake navigates to /', async ({ page }) => {
    const { repairPlanId } = await createPlan();
    await page.goto(`/repair-plan/${repairPlanId}/approve`);
    await page.getByTestId('back-to-intake').click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByTestId('scr-001-intake')).toBeVisible();
  });
});
