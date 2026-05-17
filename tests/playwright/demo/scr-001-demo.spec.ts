import { test, expect } from '@playwright/test';
import {
  showTitleCard,
  showSceneCard,
  showCaptionPill,
  clearOverlay,
} from './caption-overlay';

/**
 * MendoraCI 1-minute demo recording.
 * Drives SCR-001 intake + mask, captioned, recorded by Playwright as a webm.
 */
test.describe('MendoraCI 1-minute demo recording', () => {
  test.setTimeout(120_000);

  test('SCR-001 intake + mask, captioned, 60s total', async ({ page }) => {
    // 0:00 - 0:08 Opening title card
    await page.goto('about:blank');
    await showTitleCard(page, {
      title: 'MendoraCI',
      subtitle: 'Governed AI for CI/CD reliability.\nFrom a 4-hour fire drill to a 5-minute audited fix.',
      footnote: 'Powered by IBM Bob \u00b7 AT-Hack0020',
      durationMs: 8_000,
    });

    // 0:08 - 0:18 Scene card explaining what we are about to do
    await showSceneCard(page, {
      step: 'SCR-001 \u00b7 CI LOG INTAKE',
      given: 'A Jenkins log with an AWS access key in plaintext',
      when: 'I submit the intake artefact to MendoraCI',
      then: 'Mask Policy v1 redacts secrets BEFORE any AI inference',
      durationMs: 10_000,
    });

    // 0:18 - 0:30 Live page loads
    await page.goto('/');
    await clearOverlay(page);
    await expect(page.getByRole('heading', { name: 'CI Log Intake' })).toBeVisible();
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await showCaptionPill(page, {
      text: 'SCR-001 Intake \u2014 Mask Policy v1 runs BEFORE persist',
      tone: 'info',
    });
    await page.waitForTimeout(8_000);

    // 0:30 - 0:45 Click submit
    await showCaptionPill(page, {
      text: 'Submitting sample intake with AWS key in body...',
      tone: 'info',
    });

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/intake') && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-sample').click();
    const resp = await responsePromise;
    expect(resp.status()).toBe(201);

    const json = await resp.json();
    expect(json.status).toBe('masked');
    expect(json.mask_policy_version).toBe('v1.0.0');

    await expect(page.getByTestId('intake-status')).toHaveText('submitted');
    await expect(page.getByTestId('intake-response')).toBeVisible();
    await page.waitForTimeout(6_000);

    // 0:45 - 0:55 Highlight mask outcome
    await showCaptionPill(page, {
      text: '\u2713 Status: masked  \u00b7  Mask Policy v1.0.0  \u00b7  Zero secret leaks',
      tone: 'success',
    });

    const shown = await page.getByTestId('intake-response').textContent();
    expect(shown ?? '').not.toContain('AKIAIOSFODNN7EXAMPLE');
    await page.waitForTimeout(10_000);

    // 0:55 - 1:00 Closing title card
    await page.goto('about:blank');
    await showTitleCard(page, {
      title: 'MendoraCI',
      subtitle: 'EU AI Act Article 12 ready.\nSOC 2 \u00b7 ISO 27001 \u00b7 GDPR mapped.',
      footnote: 'Powered by IBM Bob \u00b7 github.com/vsenthil7/mendoraci',
      durationMs: 5_000,
    });
  });
});
