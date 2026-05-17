import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for MendoraCI E2E (CP-3, RT-001 SCR-001 + cross-cuts).
 *
 * Strategy:
 *   - Runs against the LIVE docker stack (mendoraci-web + mendoraci-api).
 *   - WEB_BASE_URL / API_BASE_URL env vars override defaults so the same suite
 *     runs from host OR from inside the `test` compose service.
 *   - Headless by default, chromium + firefox + webkit lanes.
 *   - All artefacts (trace, screenshot, video on failure) go to playwright-report/.
 *
 * CP-3 fix (v2): removed global `extraHTTPHeaders.x-tenant-id` because it was
 * being inherited by `request.newContext()` inside negative tests, causing
 * TEST-Pw-002b to receive 201 instead of 401. Each spec now sets the tenant
 * header explicitly where it needs one, and the missing-tenant test gets a
 * truly clean context.
 */

const WEB = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const API = process.env.API_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false, // intake DB state shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
  ],
  use: {
    baseURL: WEB,
    // No global extraHTTPHeaders — see header note above.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
  expect: { timeout: 10_000 },
});

export const TEST_API = API;
export const TEST_TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
