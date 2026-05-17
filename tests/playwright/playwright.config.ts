import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for MendoraCI E2E (CP-3, RT-001 SCR-001 + cross-cuts).
 *
 * Strategy:
 *   - Runs against the LIVE docker stack (mendoraci-web + mendoraci-api).
 *   - WEB_BASE_URL / API_BASE_URL env vars override defaults so the same suite
 *     runs from host OR from inside the `test` compose service.
 *   - Headless by default, both chromium + firefox + webkit lanes.
 *   - All artefacts (trace, screenshot, video on failure) go to playwright-report/.
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
    extraHTTPHeaders: {
      // Test tenant; matches the one seeded by the integration test
      'x-tenant-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
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
  // Web/API are brought up by docker compose, not Playwright's webServer.
  // Health-gate is in scripts/cp3_run_e2e.py before invoking playwright.
  expect: {
    timeout: 10_000,
  },
});

export const TEST_API = API;
